import { COLORS, TYPES, uid } from './constants.js';
import { STRINGS } from './i18n.js';

// The fish list as a CSV file that opens in Excel: name, type, color (1-14), feeds.
// Import accepts the same file (or one typed by hand in Excel); only the name column is required.

const quote = v => (/[",;\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

export function exportFish(students, withFeeds) {
  const header = withFeeds ? ['name', 'type', 'color', 'feeds'] : ['name', 'type', 'color'];
  const rows = students.map(s => {
    const r = [s.name, s.type, s.color + 1];
    if (withFeeds) r.push(s.food);
    return r.map(quote).join(',');
  });
  // The BOM makes Excel read the file as UTF-8, so Uzbek letters and apostrophes come through.
  const blob = new Blob(['﻿' + [header.join(','), ...rows].join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fish-${withFeeds ? 'with-feeds' : 'no-feeds'}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Minimal CSV reader: quoted fields, "" escapes, CRLF, and ";" as the separator (Excel uses it in some regions).
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const sep = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

// Type may be the key (spotty) or its English / Uzbek name; color is 1-14. Anything else is picked at random.
const typeKey = v => {
  const t = String(v || '').trim().toLowerCase();
  const found = TYPES.find(ty => ty.k === t || Object.values(STRINGS).some(L => L.types[ty.k].toLowerCase() === t));
  return found ? found.k : TYPES[Math.floor(Math.random() * TYPES.length)].k;
};
const colorIndex = v => {
  const n = parseInt(v, 10);
  return n >= 1 && n <= COLORS.length ? n - 1 : Math.floor(Math.random() * COLORS.length);
};

// Returns { fish: [{ id, name, type, color, food }], hasFeeds }.
export function parseFishFile(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { fish: [], hasFeeds: false };
  const head = rows[0].map(h => h.trim().toLowerCase());
  const known = ['name', 'ism', 'type', 'color', 'feeds'];
  const hasHeader = head.some(h => known.includes(h));
  const col = name => head.indexOf(name);
  const nameCol = hasHeader ? Math.max(col('name'), col('ism')) : 0;
  const typeCol = hasHeader ? col('type') : 1, colorCol = hasHeader ? col('color') : 2, feedsCol = hasHeader ? col('feeds') : 3;
  const body = hasHeader ? rows.slice(1) : rows;
  const fish = body
    .map((r, i) => ({
      id: uid() + i,
      name: String(r[nameCol] ?? '').trim().slice(0, 60),
      type: typeKey(r[typeCol]),
      color: colorIndex(r[colorCol]),
      food: Math.max(0, Math.min(1000, parseInt(r[feedsCol], 10) || 0)),
    }))
    .filter(f => f.name);
  return { fish, hasFeeds: feedsCol >= 0 && fish.some(f => f.food > 0) };
}
