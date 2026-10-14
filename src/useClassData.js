import { useEffect, useRef, useState } from 'react';
import { SESSION_KEY, maxFeedOf, pinMatches } from './constants.js';
import { DEFAULT_TITLES } from './i18n.js';
import { loadSaved, save } from './storage.js';
import { api, remoteEnabled, watchChanges } from './remote.js';

const POLL_MS = 15000;
const readSession = () => { try { return sessionStorage.getItem(SESSION_KEY); } catch (e) { return null; } };
const writeSession = v => { try { if (v) sessionStorage.setItem(SESSION_KEY, v); else sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } };
// Remote mode keeps "pin|tank" for this tab; the PIN entered decides which aquarium (tank) is open.
const parseSession = v => { const m = /^(\d{4})\|([a-z0-9_-]+)$/.exec(v || ''); return m ? { pin: m[1], tank: m[2] } : null; };

// The cached copy may belong to another aquarium (e.g. the test one); don't flash it while loading.
function initialData(sess) {
  const d = loadSaved();
  if (!remoteEnabled || !sess || d.tank === sess.tank) return d;
  return { ...d, tank: sess.tank, students: [], decor: [], title: DEFAULT_TITLES[0], look: null, names: null };
}

/**
 * The class data (students, decorations, title, max size) plus this device's own settings
 * (language, tab). The look and names settings are shared too, so a phone can switch them on the class screen.
 *
 * Changes apply on screen right away. With Supabase configured they are also sent to the server, and
 * changes from other devices are pulled in. Without it, everything stays in this browser.
 */
// onRemoteFeeds([{ id, n }]) is called when another device fed fish (n feeds each), so they can be animated here.
export function useClassData({ onRemoteFeeds } = {}) {
  const remoteFeeds = useRef(onRemoteFeeds);
  remoteFeeds.current = onRemoteFeeds;
  const [sess] = useState(() => (remoteEnabled ? parseSession(readSession()) : null));
  const [data, setData] = useState(() => initialData(sess));
  const [unlocked, setUnlocked] = useState(() => (remoteEnabled ? !!sess : readSession() === '1'));
  const [syncError, setSyncError] = useState(null); // null | 'network' | 'needs_update'
  const pin = useRef(sess ? sess.pin : null);
  const dataRef = useRef(data);
  dataRef.current = data;

  // Writes in flight and debounced writes waiting to go. While any exist, server snapshots are ignored
  // so they can't undo what was just typed.
  const pending = useRef(0), timers = useRef(new Map()), writeGen = useRef(0);
  const watcher = useRef({ notify() {}, close() {} });
  const busy = () => pending.current > 0 || timers.current.size > 0;

  // Local copy: the whole state in remote mode is a cache that makes reloads instant.
  useEffect(() => { save(data); }, [data]);
  useEffect(() => {
    const onHide = () => save(dataRef.current);
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  const applySnapshot = snap => setData(d => ({
    ...d,
    tank: snap.tank,
    students: snap.students,
    decor: snap.decor,
    title: snap.title || DEFAULT_TITLES[0],
    maxFeed: snap.maxFeed,
    // Each aquarium has its own look and names setting; never carry them over from another one.
    names: snap.names || 'hover',
    look: snap.look || 'sunny',
  }));

  const lock = () => {
    writeSession(null);
    pin.current = null;
    timers.current.forEach(t => clearTimeout(t));
    timers.current.clear();
    setUnlocked(false);
  };

  const onError = e => { if (e.code === 'wrong_pin') lock(); else setSyncError(e.code === 'needs_update' ? 'needs_update' : 'network'); };

  const refresh = async () => {
    if (!remoteEnabled || !pin.current || busy()) return;
    const gen = writeGen.current;
    try {
      const snap = await api.load(pin.current);
      if (!busy() && gen === writeGen.current) {
        const before = new Map(dataRef.current.students.map(s => [s.id, s.food]));
        const fed = snap.students.filter(s => before.has(s.id) && s.food > before.get(s.id)).map(s => ({ id: s.id, n: s.food - before.get(s.id) }));
        applySnapshot(snap);
        if (fed.length && remoteFeeds.current) remoteFeeds.current(fed);
      }
      setSyncError(err => (err === 'network' ? null : err)); // a working load proves the connection, not a missing update
    } catch (e) { onError(e); }
  };

  const write = async fn => {
    if (!remoteEnabled || !pin.current) return;
    pending.current++;
    writeGen.current++;
    let failed = false;
    try { await fn(pin.current); setSyncError(null); } catch (e) { failed = true; onError(e); }
    pending.current--;
    if (!busy()) { if (failed) refresh(); else watcher.current.notify(); }
  };

  const later = (key, ms, fn) => {
    if (!remoteEnabled) return;
    clearTimeout(timers.current.get(key));
    timers.current.set(key, setTimeout(() => { timers.current.delete(key); write(fn); }, ms));
  };
  const cancel = key => { clearTimeout(timers.current.get(key)); timers.current.delete(key); };

  // Pull changes from other devices: on a ping, every 15 s, and when the tab comes back into view.
  useEffect(() => {
    if (!remoteEnabled || !unlocked) return;
    refresh();
    watcher.current = watchChanges(data.tank, refresh);
    const iv = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
    const onVis = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
      watcher.current.close();
      watcher.current = { notify() {}, close() {} };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, data.tank]);

  // Resolves to 'ok' or an error code: 'wrong_pin' | 'too_many_attempts' | 'pin_not_set' | 'network'.
  const unlock = async entry => {
    if (!remoteEnabled) {
      if (!(await pinMatches(entry))) return 'wrong_pin';
      writeSession('1');
      setUnlocked(true);
      return 'ok';
    }
    try {
      const snap = await api.load(entry);
      pin.current = entry;
      writeSession(entry + '|' + snap.tank);
      applySnapshot(snap);
      setSyncError(null);
      setUnlocked(true);
      return 'ok';
    } catch (e) { return e.code; }
  };

  // ---------- Changes ----------

  const setStudents = fn => setData(d => ({ ...d, students: fn(d.students) }));
  const setDecor = fn => setData(d => ({ ...d, decor: fn(d.decor) }));
  const findStudent = id => dataRef.current.students.find(s => s.id === id);
  const findDecor = id => dataRef.current.decor.find(d => d.id === id);
  const serverTitle = t => (DEFAULT_TITLES.includes(t) || !t.trim() ? null : t);
  const saveConfig = p => api.saveConfig(p, serverTitle(dataRef.current.title), maxFeedOf(dataRef.current.maxFeed));

  const actions = {
    setPrefs: p => setData(d => ({ ...d, ...p })),

    addStudent: s => { setStudents(ss => ss.concat(s)); write(p => api.saveStudent(p, s)); },
    updateStudent: (id, patch) => {
      const cur = findStudent(id); if (!cur) return;
      const next = { ...cur, ...patch };
      setStudents(ss => ss.map(s => s.id === id ? { ...s, ...patch } : s));
      // Name edits wait for a pause in typing; type and color go straight away (with the latest name).
      if ('name' in patch) later('student:' + id, 600, p => api.saveStudent(p, findStudent(id) || next));
      else { cancel('student:' + id); write(p => api.saveStudent(p, next)); }
    },
    removeStudent: id => {
      cancel('student:' + id);
      setStudents(ss => ss.filter(s => s.id !== id));
      write(p => api.deleteStudent(p, id));
    },
    // Test aquarium only (the server refuses it for any other aquarium).
    removeAllStudents: () => {
      dataRef.current.students.forEach(s => cancel('student:' + s.id));
      setStudents(() => []);
      write(p => api.deleteAllStudents(p));
    },
    changeFood: (id, delta) => {
      setStudents(ss => ss.map(s => s.id === id ? { ...s, food: Math.max(0, s.food + delta) } : s));
      write(p => api.addFood(p, id, delta));
    },
    resetFood: () => { setStudents(ss => ss.map(s => ({ ...s, food: 0 }))); write(p => api.resetFood(p)); },

    addDecor: d => { setDecor(ds => ds.concat(d)); write(p => api.saveDecor(p, d)); },
    // While dragging or resizing: on screen only. commitDecor sends the result when the pointer lifts.
    moveDecorLive: fn => setDecor(fn),
    commitDecor: id => { const d = findDecor(id); if (d) write(p => api.saveDecor(p, d)); },
    flipDecor: id => {
      const d = findDecor(id); if (!d) return;
      const next = { ...d, flip: !d.flip };
      setDecor(ds => ds.map(x => x.id === id ? next : x));
      write(p => api.saveDecor(p, next));
    },
    removeDecor: id => { setDecor(ds => ds.filter(x => x.id !== id)); write(p => api.deleteDecor(p, id)); },
    // Moves a decoration to position `to` in the drawing order (0 = back).
    moveLayer: (id, to) => {
      const a = dataRef.current.decor.slice(), i = a.findIndex(d => d.id === id);
      if (i < 0 || to < 0 || to >= a.length || to === i) return;
      a.splice(to, 0, a.splice(i, 1)[0]);
      setDecor(() => a);
      write(p => api.orderDecor(p, a.map(d => d.id)));
    },

    setLook: look => { setData(d => ({ ...d, look })); write(p => api.saveLook(p, look)); },
    setNames: names => { setData(d => ({ ...d, names })); write(p => api.saveNames(p, names)); },
    setTitle: title => { setData(d => ({ ...d, title })); later('config', 700, saveConfig); },
    setMaxFeed: raw => {
      setData(d => ({ ...d, maxFeed: raw }));
      if (parseInt(raw, 10) >= 2) later('config', 900, saveConfig);
    },
    commitMaxFeed: () => {
      setData(d => ({ ...d, maxFeed: maxFeedOf(d.maxFeed) }));
      later('config', 0, saveConfig);
    },
  };

  return { data, unlocked, unlock, lock, syncError, remote: remoteEnabled, ...actions };
}
