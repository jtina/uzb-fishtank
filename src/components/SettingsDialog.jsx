import { useEffect, useRef, useState } from 'react';
import { DEFAULT_MAX_SIZE, DEFAULT_MIN_SIZE, DEFAULT_SPEED, SPEED_LIMITS, fishSettingsOf, typeOf } from '../constants.js';
import { exportFish, parseFishFile } from '../fishList.js';
import ConfirmDialog from './ConfirmDialog.jsx';

const pct = v => String(Math.round(v * 100));

/**
 * Per-aquarium settings: fish size range, feeds to reach the biggest size, swim speed, export / import of the
 * fish list, delete all fish, and Lock. Everything except export applies to the open aquarium only.
 */
export default function SettingsDialog({ L, cls, onClose, onLock }) {
  const { data } = cls;
  const fs = fishSettingsOf(data);
  // Text boxes keep what is being typed; valid numbers go to the aquarium straight away, and leaving a box
  // tidies it up (e.g. a biggest size below the smallest is raised to match).
  const [draft, setDraft] = useState(() => ({ min: pct(fs.minSize), max: pct(fs.maxSize), feeds: String(fs.maxFeed) }));
  const editing = useRef(null);
  useEffect(() => {
    if (editing.current) return;
    setDraft({ min: pct(fs.minSize), max: pct(fs.maxSize), feeds: String(fs.maxFeed) });
  }, [fs.minSize, fs.maxSize, fs.maxFeed]);

  const [confirm, setConfirm] = useState(null); // 'delete' | { fish, hasFeeds }
  const [keepFeeds, setKeepFeeds] = useState(true);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef(null);
  const count = data.students.length;

  const onNum = (key, field, toValue) => e => {
    const raw = e.target.value;
    setDraft(d => ({ ...d, [key]: raw }));
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0) cls.setFishSettings({ [field]: toValue(n) });
  };
  const box = (key, field, toValue, suffix, props = {}) => (
    <div className="setting-input">
      <input
        type="number"
        inputMode="numeric"
        className="input"
        value={draft[key]}
        onFocus={() => { editing.current = key; }}
        onChange={onNum(key, field, toValue)}
        onBlur={() => { editing.current = null; cls.commitFishSettings(); }}
        {...props}
      />
      <span style={suffix ? undefined : { visibility: 'hidden' }}>{suffix || '%'}</span>
    </div>
  );

  const resetDefaults = () => {
    editing.current = null;
    cls.setFishSettings({ minSize: DEFAULT_MIN_SIZE, maxSize: DEFAULT_MAX_SIZE, speed: DEFAULT_SPEED });
    cls.commitFishSettings();
  };

  const onFile = async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setImportMsg('');
    const { fish, hasFeeds } = parseFishFile(await file.text());
    if (!fish.length) { setImportMsg(L.importNone); return; }
    setKeepFeeds(hasFeeds);
    setConfirm({ fish, hasFeeds });
  };

  const previewFish = data.students[0] ? typeOf(data.students[0].type).img : typeOf('spotty').img;
  const previewW = s => Math.min(260, Math.round(90 * s));

  return (
    <>
      <div className="overlay" onClick={onClose}>
        <div className="dialog settings" role="dialog" aria-modal="true" aria-label={L.settings} onClick={e => e.stopPropagation()}>
          <div className="dialog-title">{L.settings}</div>

          <section className="settings-section">
            <div className="settings-head">{L.sizeSection}</div>
            <div className="size-preview">
              <div><img src={previewFish} alt="" style={{ width: previewW(fs.minSize) }} /><span>{L.minSize}</span></div>
              <div><img src={previewFish} alt="" style={{ width: previewW(fs.maxSize) }} /><span>{L.maxSize}</span></div>
            </div>
            <label className="setting-row">{L.minSize}{box('min', 'minSize', n => n / 100, '%', { min: 20, max: 400 })}</label>
            <label className="setting-row">{L.maxSize}{box('max', 'maxSize', n => n / 100, '%', { min: 20, max: 400 })}</label>
            <label className="setting-row">{L.feedsToMax}{box('feeds', 'maxFeed', n => String(Math.round(n)), '', { min: 2, max: 999 })}</label>
          </section>

          <section className="settings-section">
            <div className="settings-head">{L.speedSection}</div>
            <label className="setting-row">
              {L.speed}
              <span className="speed-value">{pct(fs.speed)}%</span>
            </label>
            <input
              type="range"
              className="speed-slider"
              min={SPEED_LIMITS.min}
              max={SPEED_LIMITS.max}
              step="0.25"
              value={fs.speed}
              aria-label={L.speed}
              onChange={e => cls.setFishSettings({ speed: parseFloat(e.target.value) })}
            />
            <button className="btn-outline small" onClick={resetDefaults}>{L.resetDefaults}</button>
          </section>

          <section className="settings-section">
            <div className="settings-head">{L.listSection}</div>
            <div className="settings-buttons">
              <button className="btn-outline small" disabled={!count} onClick={() => exportFish(data.students, true)}>{L.exportWith}</button>
              <button className="btn-outline small" disabled={!count} onClick={() => exportFish(data.students, false)}>{L.exportWithout}</button>
              <button className="btn-outline small" onClick={() => fileRef.current.click()}>{L.importFish}</button>
              <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" hidden onChange={onFile} />
            </div>
            <div className="settings-hint">{importMsg || L.importHint}</div>
          </section>

          <section className="settings-section">
            <div className="settings-head">{L.dangerSection}</div>
            <div className="settings-buttons">
              <button className="btn-outline small danger" disabled={!count} onClick={() => setConfirm('delete')}>{L.deleteAll}</button>
            </div>
          </section>

          <div className="dialog-actions">
            <button className="btn-outline lock-btn" onClick={onLock}>🔒 {L.lock}</button>
            <button className="btn-primary" onClick={onClose}>{L.done}</button>
          </div>
        </div>
      </div>

      {confirm === 'delete' && (
        <ConfirmDialog
          L={L} title={L.deleteAllTitle} body={L.deleteAllBody} confirmLabel={L.deleteAllConfirm(count)}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { cls.removeAllStudents(); setConfirm(null); }}
        />
      )}
      {confirm && confirm.fish && (
        <ConfirmDialog
          L={L}
          title={L.importTitle(confirm.fish.length)}
          body={
            <>
              {L.importBody}
              {confirm.hasFeeds && (
                <label className="check-row">
                  <input type="checkbox" checked={keepFeeds} onChange={e => setKeepFeeds(e.target.checked)} />
                  {L.importKeepFeeds}
                </label>
              )}
            </>
          }
          confirmLabel={L.importConfirm}
          confirmClass="btn-primary"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            cls.importStudents(keepFeeds ? confirm.fish : confirm.fish.map(f => ({ ...f, food: 0 })));
            setConfirm(null);
          }}
        />
      )}
    </>
  );
}
