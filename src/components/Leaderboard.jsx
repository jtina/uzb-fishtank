import { useState } from 'react';
import { COLORS, CROWNS, addDays, dayKey, placesOf } from '../constants.js';

// Feedings over the last 7 days (or one of those days), ranked, with crowns for places 1-3.
export default function Leaderboard({ L, students, history, ready }) {
  const [sel, setSel] = useState('week');
  const today = dayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  const dayLabel = (d, i) => {
    if (i === 0) return L.today;
    if (i === 1) return L.yesterday;
    const dt = new Date(d + 'T00:00:00Z');
    return L.weekdays[dt.getUTCDay()] + ' ' + dt.getUTCDate();
  };

  const picked = sel === 'week' ? days : [sel];
  const scores = {};
  students.forEach(s => { scores[s.id] = 0; });
  history.forEach(h => { if (picked.includes(h.d) && h.id in scores) scores[h.id] += h.n; });
  const places = placesOf(scores);
  const rows = students.filter(s => places[s.id]).sort((a, b) => places[a.id] - places[b.id] || a.name.localeCompare(b.name));

  return (
    <div className="board">
      <div className="board-days">
        <button className={'day-chip' + (sel === 'week' ? ' on' : '')} onClick={() => setSel('week')}>{L.week}</button>
        {days.map((d, i) => (
          <button key={d} className={'day-chip' + (sel === d ? ' on' : '')} onClick={() => setSel(d)}>{dayLabel(d, i)}</button>
        ))}
      </div>
      {!ready ? (
        <div className="board-empty">{L.boardNeedsUpdate}</div>
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
      <div className="board-note">{L.boardNote}</div>
    </div>
  );
}
