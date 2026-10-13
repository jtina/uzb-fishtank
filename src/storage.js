import { STORAGE_KEY, TYPES, OLD_TYPES, DEFAULT_MAX_FEED } from './constants.js';

// The settings and data that survive a reload. A new tank starts empty: no students, no decorations.
export function loadSaved() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { /* ignore */ }
  const base = { names: null, look: null, title: 'Our Class Aquarium', lang: 'uz', tab: 'list', maxFeed: DEFAULT_MAX_FEED };
  if (!saved || !saved.students) return { ...base, students: [], decor: [] };
  const keys = TYPES.map(x => x.k);
  return {
    students: saved.students.map(s => keys.includes(s.type) ? s : { ...s, type: OLD_TYPES[s.type] || 'spotty' }),
    decor: saved.decor || [],
    names: saved.names || null,
    look: saved.look === 'paper' ? null : (saved.look || null),
    title: saved.title || base.title,
    lang: saved.lang || 'uz',
    tab: saved.tab === 'decor' ? 'decor' : 'list',
    maxFeed: saved.maxFeed == null ? DEFAULT_MAX_FEED : saved.maxFeed,
  };
}

export function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}
