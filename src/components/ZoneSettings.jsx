import { useRef, useState } from 'react';

// Top fish zone: drag a line on a picture of the tank. Only the top N fish swim above it.
export default function ZoneSettings({ L, cls }) {
  const { data } = cls;
  const line = data.zoneLine || 0, on = line > 0, top = data.zoneTop || 5;
  const last = useRef(on ? line : 0.4);
  const boxRef = useRef(null);
  const [topDraft, setTopDraft] = useState(null);
  // Same shape as the real tank, so the line sits where it will in the tank.
  const tank = document.querySelector('.tank');
  const ratio = tank && tank.clientHeight ? tank.clientWidth / tank.clientHeight : 16 / 9;

  const setLine = v => { last.current = v; cls.setZone({ zoneLine: v }); };
  const fromPointer = e => {
    const r = boxRef.current.getBoundingClientRect();
    return Math.round(Math.min(0.9, Math.max(0.1, (e.clientY - r.top) / r.height)) * 100) / 100;
  };
  const onDown = e => {
    if (!on) return;
    e.preventDefault();
    boxRef.current.setPointerCapture(e.pointerId);
    setLine(fromPointer(e));
  };
  const onMove = e => { if (on && boxRef.current.hasPointerCapture(e.pointerId)) setLine(fromPointer(e)); };

  return (
    <section className="settings-section">
      <div className="settings-head">{L.zoneSection}</div>
      <label className="switch-row">
        <span>{L.zoneOn}</span>
        <input type="checkbox" role="switch" className="switch" checked={on} onChange={e => cls.setZone({ zoneLine: e.target.checked ? last.current : 0 })} />
      </label>
      <div
        ref={boxRef}
        className={'zone-box' + (on ? '' : ' off')}
        style={{ aspectRatio: String(ratio) }}
        onPointerDown={onDown}
        onPointerMove={onMove}
      >
        {on && (
          <>
            <div className="zone-label above">👑 {L.zoneAbove(top)}</div>
            <div className="zone-line" style={{ top: line * 100 + '%' }}><span className="zone-handle" /></div>
            <div className="zone-label below" style={{ top: `calc(${line * 100}% + 10px)` }}>{L.zoneBelow}</div>
          </>
        )}
      </div>
      {on && (
        <>
          <div className="settings-hint">{L.zoneHelp}</div>
          <label className="setting-row">
            {L.zoneTop}
            <div className="setting-input">
              <input
                type="number" inputMode="numeric" min="1" max="50" className="input"
                value={topDraft ?? top}
                onChange={e => { setTopDraft(e.target.value); const n = parseInt(e.target.value, 10); if (n >= 1 && n <= 50) cls.setZone({ zoneTop: n }); }}
                onBlur={() => setTopDraft(null)}
              />
              <span style={{ visibility: 'hidden' }}>%</span>
            </div>
          </label>
        </>
      )}
    </section>
  );
}
