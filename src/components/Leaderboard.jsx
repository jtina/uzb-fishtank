import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { COLORS, CROWNS, addDays, dayKey, placesOf } from '../constants.js';

const DAYS_BACK = 90; // how far back the date bar goes (the database keeps a year)

// Feedings for one day (picked from a scrollable date bar) or the last 7 days, ranked, crowns for places 1-3.
export default function Leaderboard({ L, students, history, dayFeeds, ready }) {
  const today = dayKey();
  const [sel, setSel] = useState(today); // a day, or 'week'
  const [older, setOlder] = useState({}); // day -> feeds, for days before the week the snapshot carries
  const barRef = useRef(null);
  const days = Array.from({ length: DAYS_BACK }, (_, i) => addDays(today, i - DAYS_BACK + 1)); // oldest first
  const weekStart = addDays(today, -6);

  // Start scrolled to today (the right end).
  useLayoutEffect(() => { const bar = barRef.current; if (bar) bar.scrollLeft = bar.scrollWidth; }, []);
  const scrollBy = dir => { const bar = barRef.current; if (bar) bar.scrollBy({ left: dir * bar.clientWidth * 0.8, behavior: 'smooth' }); };

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
        <div className="date-scroll" ref={barRef}>
          {days.map(d => {
            const c = card(d);
            return (
              <button key={d} className={'date-card' + (sel === d ? ' on' : '')} onClick={() => setSel(d)}>
                <span>{c.top}</span><strong>{c.bottom}</strong>
              </button>
            );
          })}
        </div>
        <button className="date-arrow" aria-label="›" onClick={() => scrollBy(1)}>›</button>
      </div>
      <button className={'day-chip week' + (sel === 'week' ? ' on' : '')} onClick={() => setSel('week')}>{L.week}</button>

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
