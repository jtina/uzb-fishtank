import { useState } from 'react';
import { COLORS, TYPES, fishFilter, typeOf } from '../constants.js';

// Phone view: add a student in a popup, with a picture of their fish since there is no tank to look at.
export default function FishEditor({ L, onCancel, onSave }) {
  const [name, setName] = useState('');
  const [type, setType] = useState(() => TYPES[Math.floor(Math.random() * TYPES.length)].k);
  const [color, setColor] = useState(() => Math.floor(Math.random() * COLORS.length));
  const save = () => { if (name.trim()) onSave({ name: name.trim(), type, color }); };

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog fish-editor" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="fish-preview">
          <img src={typeOf(type).img} alt="" style={{ filter: fishFilter({ type, color }) }} />
        </div>
        <div className="field">
          <div className="field-label">{L.name}</div>
          <input className="input" value={name} placeholder={L.newName} autoFocus onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); }} />
        </div>
        <div className="field">
          <div className="field-label">{L.fishType}</div>
          <div className="type-list">
            {TYPES.map(ty => (
              <button key={ty.k} className={'type-chip' + (ty.k === type ? ' on' : '')} onClick={() => setType(ty.k)}>{L.types[ty.k]}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <div className="field-label">{L.color}</div>
          <div className="color-list">
            {COLORS.map((c, i) => (
              <button
                key={i}
                className={'color-dot' + (i === color ? ' on' : '')}
                style={{ background: c.c, borderColor: i === color ? undefined : c.c }}
                aria-label={c.c}
                onClick={() => setColor(i)}
              />
            ))}
          </div>
        </div>
        <div className="dialog-actions">
          <button className="btn-outline" onClick={onCancel}>{L.cancel}</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={save}>{L.addFish}</button>
        </div>
      </div>
    </div>
  );
}
