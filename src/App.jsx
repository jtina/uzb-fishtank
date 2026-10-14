import { useEffect, useRef, useState } from 'react';
import { COLORS, DECOR, LOOKS, THEMES, TYPES, maxFeedOf, themeVars, uid } from './constants.js';
import { DEFAULT_TITLES, strings } from './i18n.js';
import { useClassData } from './useClassData.js';
import Tank from './components/Tank.jsx';
import PinScreen from './components/PinScreen.jsx';
import LangSwitch from './components/LangSwitch.jsx';
import StudentRow from './components/StudentRow.jsx';
import ResetDialog from './components/ResetDialog.jsx';
import FishEditor from './components/FishEditor.jsx';

// Phones get a remote-control layout: the student list only, no tank and no Decorate tab.
const PHONE = '(max-width: 640px)';
function usePhone() {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE), onChange = () => setPhone(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return phone;
}

export default function App() {
  const tankApi = useRef(null), listRef = useRef(null);
  // Feeds made on another device (e.g. a phone) drop food here too, so the class sees the fish eat and grow.
  const cls = useClassData({
    onRemoteFeeds: fed => {
      if (!tankApi.current) return;
      let i = 0;
      fed.forEach(({ id, n }) => { for (let k = 0; k < Math.min(n, 3); k++) setTimeout(() => tankApi.current && tankApi.current.dropFood(id, true), 120 * i++); });
    },
  });
  const phone = usePhone();
  const [adding, setAdding] = useState(false);
  const { data, unlocked } = cls;
  const [open, setOpen] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [selDecor, setSelDecor] = useState(null);
  const [newName, setNewName] = useState('');
  const [resetOpen, setResetOpen] = useState(false);

  const { students, decor, lang } = data;
  const tab = phone ? 'list' : data.tab;
  const L = strings(lang);
  const look = data.look || 'sunny';
  const t = THEMES[look] || THEMES.sunny;
  const alwaysNames = (data.names || 'hover') === 'always';
  const maxFeed = maxFeedOf(data.maxFeed);

  useEffect(() => { document.body.style.background = t.pageBg; }, [t.pageBg]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const closeEdit = () => { setOpen(null); setConfirm(null); };
  const feed = id => tankApi.current ? tankApi.current.dropFood(id) : cls.changeFood(id, 1);

  const scrollToRow = id => requestAnimationFrame(() => requestAnimationFrame(() => {
    const list = listRef.current; if (!list) return;
    const row = list.querySelector(`[data-row-id="${id}"]`); if (!row) return;
    if (phone) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const top = row.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop - 8;
    list.scrollTo({ top, behavior: 'smooth' });
    const inp = row.querySelector('input'); if (inp) inp.focus({ preventScroll: true });
  }));

  const addStudent = () => {
    const name = newName.trim(); if (!name) return;
    const id = uid();
    cls.addStudent({ id, name, type: TYPES[Math.floor(Math.random() * TYPES.length)].k, color: Math.floor(Math.random() * COLORS.length), food: 0 });
    cls.setPrefs({ tab: 'list' });
    setNewName('');
    setOpen(id);
    setConfirm(null);
    scrollToRow(id);
  };

  const addFromPopup = ({ name, type, color }) => {
    const id = uid();
    cls.addStudent({ id, name, type, color, food: 0 });
    setAdding(false);
    scrollToRow(id);
  };

  const removeStudent = id => {
    if (confirm !== id) { setConfirm(id); return; }
    cls.removeStudent(id);
    closeEdit();
  };

  const moveLayer = (id, to) => { cls.moveLayer(id, to); setSelDecor(id); };
  const flipDecor = id => { cls.flipDecor(id); setSelDecor(id); };
  const removeDecor = id => { cls.removeDecor(id); setSelDecor(null); };
  const addDecor = kind => {
    const id = uid();
    cls.addDecor({ id, kind, x: 8 + Math.random() * 84 });
    setSelDecor(id);
  };

  const lockNow = () => {
    cls.lock();
    setOpen(null);
    setSelDecor(null);
  };

  const setLang = k => cls.setPrefs({ lang: k });
  const setTab = k => { cls.setPrefs({ tab: k }); setSelDecor(null); };
  const editing = tab === 'list' && !!open;
  const focusId = editing && students.some(s => s.id === open) ? open : null;
  const title = DEFAULT_TITLES.includes(data.title) ? L.title : data.title;
  const rows = students.slice().sort((a, b) => b.food - a.food || a.name.localeCompare(b.name));

  return (
    <div style={themeVars(t)}>
      {!unlocked && <PinScreen L={L} lang={lang} onLang={setLang} onUnlock={cls.unlock} />}
      <div className={'app' + (phone ? ' phone' : '')}>
        <div className="main">
          <div className="header">
            <div className="title-block">
              {data.tank === 'test' && <div className="test-badge">{L.testTank}</div>}
              <input
                className="title-input"
                value={title}
                aria-label="Class title"
                placeholder={L.className}
                onChange={e => cls.setTitle(e.target.value)}
                onBlur={() => { if (!data.title.trim()) cls.setTitle(L.title); }}
              />
              {!phone && <div className="hint">{L.hint}</div>}
            </div>
            <div className="controls">
              <LangSwitch lang={lang} onLang={setLang} />
              {!phone && (
                <div className="chips">
                  {LOOKS.map(k => (
                    <button key={k} className={'chip wide' + (k === look ? ' on' : '')} onClick={() => cls.setPrefs({ look: k })}>{L[k]}</button>
                  ))}
                </div>
              )}
              <button className="pill" onClick={() => cls.setNames(alwaysNames ? 'hover' : 'always')}>{alwaysNames ? L.namesAlways : L.namesHover}</button>
              <button className="pill" onClick={lockNow}>{L.lock}</button>
              <button className="feed-all" onClick={() => students.forEach((s, i) => setTimeout(() => feed(s.id), i * 40))}>{L.feedAll}</button>
            </div>
          </div>
          {cls.syncError && <div className="sync-error" role="status">{L.syncError}</div>}
          {!phone && <Tank
            ref={tankApi}
            students={students}
            decor={decor}
            decorating={tab === 'decor'}
            focusId={focusId}
            editing={editing}
            selDecor={selDecor}
            alwaysNames={alwaysNames}
            maxFeed={maxFeed}
            theme={t}
            L={L}
            isEmpty={students.length === 0}
            onAte={id => cls.changeFood(id, 1)}
            onCloseEdit={closeEdit}
            onTankClick={() => { if (open) closeEdit(); if (tab === 'decor') setSelDecor(null); }}
            setDecor={cls.moveDecorLive}
            onDecorCommit={cls.commitDecor}
            onSelectDecor={setSelDecor}
            onMoveLayer={moveLayer}
            onFlipDecor={flipDecor}
            onRemoveDecor={removeDecor}
          />}
        </div>

        <div className="panel">
          <div className="panel-top">
            {!phone && (
              <div className="chips">
                {[['list', L.students], ['decor', L.decorate]].map(([k, label]) => (
                  <button key={k} className={'chip tab' + (k === tab ? ' on' : '')} onClick={() => setTab(k)}>{label}</button>
                ))}
              </div>
            )}
            <div className="panel-tools">
              <div className="count">{L.fish(students.length)}</div>
              <label className="max-feed">
                {L.maxAt}
                <input
                  type="number"
                  min="2"
                  max="999"
                  className="input"
                  value={data.maxFeed}
                  aria-label={L.maxAt}
                  onChange={e => cls.setMaxFeed(e.target.value)}
                  onBlur={cls.commitMaxFeed}
                />
              </label>
              <button className="btn-outline small" onClick={() => setResetOpen(true)}>{L.resetSizes}</button>
            </div>
          </div>

          {tab === 'list' && (
            <>
              {phone ? (
                <button className="btn-primary add-big" onClick={() => setAdding(true)}>+ {L.addFish}</button>
              ) : <div className="add-row">
                <input
                  className="input big"
                  value={newName}
                  placeholder={L.newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addStudent(); }}
                />
                <button className="btn-primary" onClick={addStudent}>{L.addFish}</button>
              </div>}
              <div ref={listRef} className="list">
                {rows.map(s => (
                  <StudentRow
                    key={s.id}
                    s={s}
                    L={L}
                    open={open === s.id}
                    confirming={confirm === s.id}
                    onToggle={() => { setOpen(open === s.id ? null : s.id); setConfirm(null); }}
                    onFeed={() => feed(s.id)}
                    onMinus={() => cls.changeFood(s.id, -1)}
                    onChange={p => cls.updateStudent(s.id, p)}
                    onRemove={() => removeStudent(s.id)}
                  />
                ))}
              </div>
            </>
          )}

          {tab === 'decor' && (
            <>
              <div className="decor-help">{L.decorHelp}</div>
              <div className="catalog">
                {DECOR.map(c => (
                  <button key={c.k} className="catalog-item" onClick={() => addDecor(c.k)}>
                    <div className="catalog-swatch" style={{ background: c.swatch }} />
                    <span>{L.decor[c.k]}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {adding && <FishEditor L={L} onCancel={() => setAdding(false)} onSave={addFromPopup} />}
        {resetOpen && (
          <ResetDialog
            L={L}
            onCancel={() => setResetOpen(false)}
            onConfirm={() => { cls.resetFood(); setResetOpen(false); }}
          />
        )}
      </div>
    </div>
  );
}
