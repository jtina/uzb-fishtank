import { STORAGE_KEY, TYPES, OLD_TYPES, DEFAULT_DECOR, SEED_NAMES, COLORS, DEFAULT_MAX_FEED, uid } from './constants.js';

const seedStudents = () => SEED_NAMES.map((name, i) => ({
  id: uid() + i, name, type: TYPES[i % TYPES.length].k, color: (i * 5) % COLORS.length, food: Math.floor(Math.random() * 13),
}));
const defaultDecor = () => DEFAULT_DECOR.map(([kind, x], i) => ({ id: 'd' + i + uid(), kind, x }));

// The settings and data that survive a reload.
export function loadSaved() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { /* ignore */ }
  const base = { names: null, sound: true, look: null, title: 'Our Class Aquarium', lang: 'uz', tab: 'list', maxFeed: DEFAULT_MAX_FEED };
  if (!saved || !saved.students) return { ...base, students: seedStudents(), decor: defaultDecor() };
  const keys = TYPES.map(x => x.k);
  return {
    students: saved.students.map(s => keys.includes(s.type) ? s : { ...s, type: OLD_TYPES[s.type] || 'spotty' }),
    decor: saved.decor || defaultDecor(),
    names: saved.names || null,
    sound: saved.sound !== false,
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
