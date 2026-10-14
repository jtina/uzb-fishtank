import { COLORS, TYPES } from '../constants.js';

export default function StudentRow({ s, L, open, confirming, onToggle, onFeed, onMinus, onChange, onRemove }) {
  const col = COLORS[s.color] || COLORS[0];

  return (
    <div data-row-id={s.id} className={'row' + (open ? ' open' : '')}>
      <div className="row-head">
        <div className="row-main" onClick={onToggle}>
          <div className="row-swatch" style={{ background: col.c, borderColor: col.d }} />
          <div className="row-text">
            <div className="row-name">{s.name}</div>
            <div className="row-meta">
              <span>{L.types[s.type] || L.types.spotty}</span>
            </div>
          </div>
        </div>
        <div className="row-food">{s.food}</div>
        <button className="feed-one" onClick={onFeed}>+1</button>
      </div>
      {open && (
        <div className="row-edit">
          <div className="field" style={{ paddingTop: 10 }}>
            <div className="field-label">{L.name}</div>
            <input className="input" value={s.name} onChange={e => onChange({ name: e.target.value })} />
          </div>
          <div className="field">
            <div className="field-label">{L.fishType}</div>
            <div className="type-list">
              {TYPES.map(ty => (
                <button key={ty.k} className={'type-chip' + (ty.k === s.type ? ' on' : '')} onClick={() => onChange({ type: ty.k })}>{L.types[ty.k]}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <div className="field-label">{L.color}</div>
            <div className="color-list">
              {COLORS.map((c, i) => (
                <button
                  key={i}
                  className={'color-dot' + (i === s.color ? ' on' : '')}
                  style={{ background: c.c, borderColor: i === s.color ? undefined : c.c }}
                  aria-label={c.c}
                  onClick={() => onChange({ color: i })}
                />
              ))}
            </div>
          </div>
          <div className="row-actions">
            <button className="btn-outline small" onClick={onMinus}>{L.undo}</button>
            <button className={'btn-remove' + (confirming ? ' confirming' : '')} onClick={onRemove}>{confirming ? L.tapAgain : L.removeFish}</button>
          </div>
        </div>
      )}
    </div>
  );
}
