import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { COLORS, CROWNS, addDays, dayKey, placesOf } from '../constants.js';

const DAYS_BACK = 366; // the date bar covers the year of feedings the database keeps

// Feedings for one day (picked from a scrollable date bar) or the last 7 days, ranked, crowns for places 1-3.
export default function Leaderboard({ L, students, history, dayFeeds, ready }) {
  const today = dayKey();
  const [sel, setSel] = useState(today); // a day, or 'week'
  const [older, setOlder] = useState({}); // day -> feeds, for days before the week the snapshot carries
  const barRef = useRef(null);
  const days = Array.from({ length: DAYS_BACK }, (_, i) => addDays(today, i - DAYS_BACK + 1)); // oldest first
  const weekStart = addDays(today, -6);

  // Keeps the picked day in view (at the right end for today), e.g. after Today or a calendar pick.
  const showDay = (d, smooth) => {
    const bar = barRef.current, el = bar && bar.querySelector(`[data-day="${d}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect(), br = bar.getBoundingClientRect();
    const left = d === today ? bar.scrollWidth : bar.scrollLeft + (r.left - br.left) - (bar.clientWidth - r.width) / 2;
    const far = Math.abs(left - bar.scrollLeft) > bar.clientWidth * 3; // long jumps (e.g. from the calendar) are instant
    bar.scrollTo({ left, behavior: smooth && !far ? 'smooth' : 'auto' });
  };
  useLayoutEffect(() => { showDay(today, false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = d => { setSel(d); setCalOpen(false); requestAnimationFrame(() => showDay(d, true)); };
  const scrollBy = dir => { const bar = barRef.current; if (bar) bar.scrollBy({ left: dir * bar.clientWidth * 0.8, behavior: 'smooth' }); };

  // Click-and-drag scrolling with a mouse (touch screens scroll natively). A drag doesn't count as a click.
  const drag = useRef(null);
  const onPointerDown = e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag.current = { x: e.clientX, left: barRef.current.scrollLeft, moved: false };
  };
  const onPointerMove = e => {
    const g = drag.current; if (!g) return;
    const dx = e.clientX - g.x;
    if (!g.moved && Math.abs(dx) > 5) { g.moved = true; barRef.current.classList.add('dragging'); barRef.current.setPointerCapture(e.pointerId); }
    if (g.moved) barRef.current.scrollLeft = g.left - dx;
  };
  const onPointerUp = () => {
    const g = drag.current; drag.current = null;
    if (g && g.moved) { barRef.current.classList.remove('dragging'); barRef.current.dataset.dragged = '1'; setTimeout(() => { if (barRef.current) delete barRef.current.dataset.dragged; }, 0); }
  };
  const onCardClick = d => { if (!barRef.current.dataset.dragged) pick(d); };

  const [calOpen, setCalOpen] = useState(false);

  useEffect(() => {
    if (sel === 'week' || sel >= weekStart || older[sel]) return;
    let live = true;
    dayFeeds(sel).then(f => { if (live) setOlder(o => ({ ...o, [sel]: f })); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const entries = sel === 'week' ? history.filter(h => h.d >= weekStart)
    : sel >= weekStart ? history.filter(h => h.d === sel) : older[sel];
  const loading = !entries;
  const scores = {};
  students.forEach(s => { scores[s.id] = 0; });
  (entries || []).forEach(h => { if (h.id in scores) scores[h.id] += h.n; });
  const places = placesOf(scores);
  const rows = students.filter(s => places[s.id]).sort((a, b) => places[a.id] - places[b.id] || a.name.localeCompare(b.name));

  const card = d => {
    const dt = new Date(d + 'T00:00:00Z');
    return {
      top: d === today ? L.today : L.weekdays[dt.getUTCDay()],
      bottom: L.months[dt.getUTCMonth()] + ' ' + dt.getUTCDate(),
    };
  };

  return (
    <div className="board">
      <div className="date-bar">
        <button className="date-arrow" aria-label="‹" onClick={() => scrollBy(-1)}>‹</button>
        <div className="date-scroll" ref={barRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {days.map(d => {
            const c = card(d);
            return (
              <button key={d} data-day={d} className={'date-card' + (sel === d ? ' on' : '')} onClick={() => onCardClick(d)} draggable="false">
                <span>{c.top}</span><strong>{c.bottom}</strong>
              </button>
            );
          })}
        </div>
        <button className="date-arrow" aria-label="›" onClick={() => scrollBy(1)}>›</button>
      </div>
      <div className="board-tools">
        <button className={'day-chip' + (sel === today ? ' on' : '')} onClick={() => pick(today)}>{L.today}</button>
        <button className={'day-chip' + (sel === 'week' ? ' on' : '')} onClick={() => setSel('week')}>{L.week}</button>
        <div className="cal-wrap">
          <button className={'day-chip' + (calOpen ? ' on' : '')} onClick={() => setCalOpen(o => !o)} aria-label={L.calendar}>📅 {L.calendar}</button>
        </div>
        {calOpen && <Calendar L={L} today={today} sel={sel === 'week' ? today : sel} minDay={days[0]} onPick={pick} onClose={() => setCalOpen(false)} />}
      </div>

      {!ready ? (
        <div className="board-empty">{L.boardNeedsUpdate}</div>
      ) : loading ? (
        <div className="board-empty">…</div>
      ) : rows.length === 0 ? (
        <div className="board-empty">{L.noFeedings}</div>
      ) : (
        <div className="board-list">
          {rows.map(s => {
            const col = COLORS[s.color] || COLORS[0], place = places[s.id];
            return (
              <div key={s.id} className={'board-row' + (place <= 3 ? ' top' : '')}>
                <div className="board-place">
                  {place <= 3 ? <img src={CROWNS[place]} alt={'#' + place} /> : <span>{place}</span>}
                </div>
                <div className="row-swatch small" style={{ background: col.c, borderColor: col.d }} />
                <div className="board-name">{s.name}</div>
                <div className="board-feeds">{scores[s.id]}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// A month view for picking a day. Weeks start on Monday; days after today or before minDay are disabled.
function Calendar({ L, today, sel, minDay, onPick, onClose }) {
  const [month, setMonth] = useState(sel.slice(0, 7)); // 'YYYY-MM'
  const ref = useRef(null);
  useEffect(() => {
    const away = e => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.cal-wrap')) onClose(); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);

  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const key = d => `${month}-${String(d).padStart(2, '0')}`;
  const shift = n => { const dt = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(dt.toISOString().slice(0, 7)); };
  const weekdays = [1, 2, 3, 4, 5, 6, 0].map(i => L.weekdays[i]);

  return (
    <div className="calendar" ref={ref}>
      <div className="cal-head">
        <button onClick={() => shift(-1)} disabled={key(1) <= minDay} aria-label="‹">‹</button>
        <strong>{L.monthsLong[m - 1]} {y}</strong>
        <button onClick={() => shift(1)} disabled={month >= today.slice(0, 7)} aria-label="›">›</button>
      </div>
      <div className="cal-grid">
        {weekdays.map(w => <span key={w} className="cal-wd">{w}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={'x' + i} />)}
        {Array.from({ length: count }, (_, i) => {
          const d = key(i + 1);
          return (
            <button key={d} className={'cal-day' + (d === sel ? ' on' : '') + (d === today ? ' today' : '')} disabled={d > today || d < minDay} onClick={() => onPick(d)}>
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
