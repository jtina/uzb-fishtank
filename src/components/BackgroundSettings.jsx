import { useRef, useState } from 'react';
import { useTankBackground } from '../useTankBackground.js';
import { resizeImage } from '../imageResize.js';
import ConfirmDialog from './ConfirmDialog.jsx';

// Test aquarium only: pick or upload the Sunny Reef / Night Glow tank backgrounds, and copy them to every aquarium.
export default function BackgroundSettings({ L, cls }) {
  const { data } = cls;
  const [busy, setBusy] = useState(null); // 'day' | 'night' while uploading
  const [msg, setMsg] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const files = { day: useRef(null), night: useRef(null) };

  const set = (slot, value) => {
    setMsg('');
    return cls.setBackgrounds(slot === 'day' ? value : data.bgDay, slot === 'night' ? value : data.bgNight);
  };
  const onFile = slot => async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(slot); setMsg('');
    try {
      const id = await cls.uploadBackground(await resizeImage(file));
      if (!id || !(await set(slot, 'img:' + id))) setMsg(L.bgFailed);
    } catch (err) { setMsg(L.bgFailed); }
    setBusy(null);
  };

  return (
    <section className="settings-section">
      <div className="settings-head">{L.bgSection}</div>
      {['day', 'night'].map(slot => <BgRow key={slot} L={L} cls={cls} slot={slot} busy={busy === slot} onPick={v => set(slot, v)} onUpload={() => files[slot].current.click()} fileRef={files[slot]} onFile={onFile(slot)} />)}
      <button className="btn-outline small" onClick={() => setConfirmAll(true)}>{L.bgApplyAll}</button>
      {msg && <div className="settings-hint">{msg}</div>}
      {confirmAll && (
        <ConfirmDialog
          L={L} title={L.bgApplyTitle} body={L.bgApplyBody} confirmLabel={L.bgApplyConfirm} confirmClass="btn-primary"
          onCancel={() => setConfirmAll(false)}
          onConfirm={async () => { setConfirmAll(false); setMsg((await cls.applyBackgroundsToAll()) ? L.bgApplied : L.bgFailed); }}
        />
      )}
    </section>
  );
}

function BgRow({ L, cls, slot, busy, onPick, onUpload, fileRef, onFile }) {
  const value = slot === 'day' ? cls.data.bgDay : cls.data.bgNight;
  const url = useTankBackground(value, slot, cls.loadImage);
  const chip = (on, label, onClick) => <button className={'type-chip' + (on ? ' on' : '')} onClick={onClick} disabled={busy}>{label}</button>;
  return (
    <div className="bg-row">
      <div className="bg-thumb" style={{ backgroundImage: `url("${url}")` }}><span>{slot === 'day' ? L.bgDay : L.bgNight}</span></div>
      <div className="type-list">
        {chip(value === 'classic', L.bgClassic, () => onPick('classic'))}
        {chip(value === 'reef', L.bgReef, () => onPick('reef'))}
        {chip(value.startsWith('img:'), busy ? L.bgUploading : '⬆ ' + L.bgUpload, onUpload)}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>
    </div>
  );
}
