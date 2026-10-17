import { useEffect, useRef, useState } from 'react';
import { DEFAULT_MAX_SIZE, DEFAULT_MIN_SIZE, DEFAULT_SPEED, SESSION_KEY, addDays, dayKey, fishSettingsOf, maxFeedOf, pinMatches } from './constants.js';
import { DEFAULT_TITLES } from './i18n.js';
import { loadSaved, save } from './storage.js';
import { api, remoteEnabled, watchChanges } from './remote.js';

const POLL_MS = 15000;

// Uploaded backgrounds are fetched once and kept (in memory and, if there is room, in this browser).
const images = new Map();
const IMG_KEY = 'classFishTank.img.';
function cachedImage(id) {
  if (images.has(id)) return images.get(id);
  try { const v = localStorage.getItem(IMG_KEY + id); if (v) { images.set(id, v); return v; } } catch (e) { /* ignore */ }
  return null;
}
function cacheImage(id, data) {
  images.set(id, data);
  try { localStorage.setItem(IMG_KEY + id, data); } catch (e) { /* storage full: memory only */ }
}
const readSession = () => { try { return sessionStorage.getItem(SESSION_KEY); } catch (e) { return null; } };
const writeSession = v => { try { if (v) sessionStorage.setItem(SESSION_KEY, v); else sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } };
// Remote mode keeps "pin|tank" for this tab; the PIN entered decides which aquarium (tank) is open.
const parseSession = v => { const m = /^(\d{4})\|([a-z0-9_-]+)$/.exec(v || ''); return m ? { pin: m[1], tank: m[2] } : null; };

// Local-only mode: a new day (from 23:59 Tashkent time) puts every fish back to the starting size, and a year of
// feedings is kept for the leaderboard. (With Supabase the database does both; the app just reloads.)
function rollLocal(d) {
  const today = dayKey(), keep = addDays(today, -366);
  const history = (d.history || []).filter(h => h.d >= keep);
  if (d.foodDay === today) return { ...d, history };
  return { ...d, history, foodDay: today, students: d.foodDay ? d.students.map(s => (s.food ? { ...s, food: 0 } : s)) : d.students };
}

// The cached copy may belong to another aquarium (e.g. the test one); don't flash it while loading.
function initialData(sess) {
  const d = loadSaved();
  if (!remoteEnabled) return rollLocal(d);
  if (!sess || d.tank === sess.tank) return d;
  return { ...d, tank: sess.tank, students: [], decor: [], history: [], title: DEFAULT_TITLES[0], look: null, names: null, bgDay: 'classic', bgNight: 'classic', zoneLine: 0, zoneTop: 5, zoneDive: false, minSize: DEFAULT_MIN_SIZE, maxSize: DEFAULT_MAX_SIZE, speed: DEFAULT_SPEED };
}

// Today's feedings for one student go up or down with every feed / minus ball.
function logFeed(history, id, delta) {
  const today = dayKey(), i = history.findIndex(h => h.d === today && h.id === id);
  if (i < 0) return delta > 0 ? history.concat({ d: today, id, n: delta }) : history;
  return history.map((h, j) => (j === i ? { ...h, n: Math.max(0, h.n + delta) } : h));
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
    // Each aquarium has its own settings; never carry them over from another one.
    names: snap.names || 'hover',
    look: snap.look || 'sunny',
    minSize: snap.minSize ?? DEFAULT_MIN_SIZE,
    maxSize: snap.maxSize ?? DEFAULT_MAX_SIZE,
    speed: snap.speed ?? DEFAULT_SPEED,
    bgDay: snap.bgDay || 'classic',
    bgNight: snap.bgNight || 'classic',
    zoneLine: snap.zoneLine || 0,
    zoneTop: snap.zoneTop || 5,
    zoneDive: !!snap.zoneDive,
    history: snap.history || [],
    boardReady: !!snap.today, // false until supabase/fishtank.sql with the leaderboard has been run
    foodDay: snap.today || d.foodDay,
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

  // At 23:59 Tashkent time a new day starts: reload (the database resets the sizes) or reset here.
  useEffect(() => {
    if (!unlocked) return;
    let asked = null; // ask the server once per new day, even if this device's clock is a little off
    const iv = setInterval(() => {
      const today = dayKey();
      if (dataRef.current.foodDay === today || asked === today) return;
      asked = today;
      if (remoteEnabled) refresh(); else setData(rollLocal);
    }, 20000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

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
      setData(d => ({ ...d, students: d.students.filter(s => s.id !== id), history: (d.history || []).filter(h => h.id !== id) }));
      write(p => api.deleteStudent(p, id));
    },
    // Adds many students at once (from an imported file). Feeds are set with add_food, the only way feeds change.
    importStudents: list => {
      setStudents(ss => ss.concat(list));
      write(async p => {
        await Promise.all(list.map(s => api.saveStudent(p, s)));
        await Promise.all(list.filter(s => s.food > 0).map(s => api.addFood(p, s.id, s.food, false)));
      });
    },
    // Only this aquarium's students; the server can't reach other aquariums with this PIN.
    removeAllStudents: () => {
      dataRef.current.students.forEach(s => cancel('student:' + s.id));
      setData(d => ({ ...d, students: [], history: [] }));
      write(p => api.deleteAllStudents(p));
    },
    changeFood: (id, delta) => {
      setData(d => ({
        ...d,
        students: d.students.map(s => (s.id === id ? { ...s, food: Math.max(0, s.food + delta) } : s)),
        history: logFeed(d.history || [], id, delta),
      }));
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

    // Top fish zone (line 0 = off). Sent after a short pause, so dragging the line doesn't flood the server.
    setZone: patch => {
      setData(d => ({ ...d, ...patch }));
      later('zone', 500, p => api.saveZone(p, dataRef.current.zoneLine || 0, dataRef.current.zoneTop || 5, !!dataRef.current.zoneDive));
    },
    setLook: look => { setData(d => ({ ...d, look })); write(p => api.saveLook(p, look)); },
    setNames: names => { setData(d => ({ ...d, names })); write(p => api.saveNames(p, names)); },
    setTitle: title => { setData(d => ({ ...d, title })); later('config', 700, saveConfig); },
    // Size range, swim speed and feeds-to-max, typed in Settings. Values may be half-typed while editing.
    setFishSettings: patch => {
      setData(d => ({ ...d, ...patch }));
      if ('maxFeed' in patch) { if (parseInt(patch.maxFeed, 10) >= 2) later('config', 900, saveConfig); }
      else later('fish', 700, p => api.saveFishSettings(p, fishSettingsOf(dataRef.current)));
    },
    commitFishSettings: () => {
      setData(d => ({ ...d, ...fishSettingsOf(d) }));
      later('config', 0, saveConfig);
      later('fish', 0, p => api.saveFishSettings(p, fishSettingsOf(dataRef.current)));
    },
  };

  // Feedings on one day: from the week the snapshot carries, or asked from the server for older days.
  const dayFeeds = async day => {
    const local = (dataRef.current.history || []).filter(h => h.d === day);
    if (!remoteEnabled || !pin.current || day > addDays(dayKey(), -7)) return local;
    try { return (await api.dayFeeds(pin.current, day)).feeds || []; } catch (e) { onError(e); return local; }
  };

  // Backgrounds (test aquarium): returns false if the server refused or the upload failed.
  const setBackgrounds = async (bgDay, bgNight) => {
    setData(d => ({ ...d, bgDay, bgNight }));
    pending.current++; writeGen.current++;
    try { await api.saveBg(pin.current, bgDay, bgNight); watcher.current.notify(); return true; }
    catch (e) { onError(e); return false; }
    finally { pending.current--; }
  };
  const uploadBackground = async dataUrl => {
    try { const r = await api.uploadImage(pin.current, dataUrl); cacheImage(r.id, dataUrl); return r.id; }
    catch (e) { onError(e); return null; }
  };
  const applyBackgroundsToAll = async () => {
    try { await api.applyBgAll(pin.current); return true; } catch (e) { onError(e); return false; }
  };
  const loadImage = async id => {
    const cached = cachedImage(id); if (cached) return cached;
    if (!remoteEnabled || !pin.current) return null;
    try { const r = await api.getImage(pin.current, id); if (r.data) cacheImage(id, r.data); return r.data || null; }
    catch (e) { return null; }
  };

  return { data, unlocked, unlock, lock, syncError, remote: remoteEnabled, dayFeeds, setBackgrounds, uploadBackground, applyBackgroundsToAll, loadImage, ...actions };
}
