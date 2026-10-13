const asset = name => `${import.meta.env.BASE_URL}assets/${name}`;

export const STORAGE_KEY = 'classFishTank.v1';
export const SESSION_KEY = 'classFishTank.unlocked';
/* global __PIN_HASH__, __PIN_SALT__ */
// Filled in at build time from the TEACHER_PIN secret (see vite.config.js).
export const PIN_HASH = __PIN_HASH__;
export const PIN_SALT = __PIN_SALT__;

export async function pinMatches(entry) {
  const bytes = new TextEncoder().encode(PIN_SALT + entry);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return hex === PIN_HASH;
}

// Every fish picture is blue-ish, so colors are applied as a hue shift from 210°.
export const TYPES = [
  { k: 'spotty', img: asset('spotty.png'), hue: 210 },
  { k: 'scales', img: asset('scales.png'), hue: 210 },
  { k: 'hearts', img: asset('hearts.png'), hue: 210 },
  { k: 'waves', img: asset('waves.png'), hue: 210 },
  { k: 'flowers', img: asset('flowers.png'), hue: 210 },
];

// Types from earlier versions, mapped onto the current ones when loading saved data.
export const OLD_TYPES = { clown: 'spotty', gold: 'spotty', puffer: 'scales', angel: 'hearts', betta: 'waves', tang: 'flowers' };

export const COLORS = [
  { c: '#FF9A4D', d: '#FF7A2E' }, { c: '#FFD95A', d: '#FFC233' }, { c: '#FF9EC0', d: '#FF7AA8' },
  { c: '#B99AF5', d: '#9C78EE' }, { c: '#6CB8F5', d: '#4A9BEB' }, { c: '#6FDCC4', d: '#45C7AB' },
  { c: '#9BDB7A', d: '#79C957' }, { c: '#EEF0FA', d: '#D3D6EE' }, { c: '#2B4C8C', d: '#1E3768' },
  { c: '#2F6FE0', d: '#1F55B8' }, { c: '#E03A3A', d: '#B82626' }, { c: '#2F8A4E', d: '#22693A' },
  { c: '#1F7A8C', d: '#165C6A' }, { c: '#4A4F5C', d: '#363A44' },
];
const HUES = [25, 47, 340, 265, 210, 170, 105, null, 225, 218, 0, 135, 190, null];
const HUE_EXTRA = {
  8: ' saturate(1.6) brightness(0.62)',
  9: ' saturate(1.8) brightness(0.85)',
  10: ' saturate(1.7) brightness(0.88)',
  11: ' saturate(1.4) brightness(0.62)',
  12: ' saturate(1.3) brightness(0.68)',
};
const CHARCOAL = 13;

export function fishFilter(s) {
  const ty = typeOf(s.type), target = HUES[s.color];
  if (s.color === CHARCOAL) return 'grayscale(1) brightness(0.55) contrast(1.15)';
  if (target == null) return 'saturate(0.12) brightness(1.18)';
  let d = target - ty.hue;
  d = ((d + 540) % 360) - 180;
  return (Math.abs(d) < 4 ? '' : `hue-rotate(${Math.round(d)}deg)`) + (HUE_EXTRA[s.color] || '') || 'none';
}

export const typeOf = k => TYPES.find(x => x.k === k) || TYPES[0];

export const DECOR = [
  { k: 'chest', swatch: '#E0A33A', img: asset('decor-chest.png'), h: 96 },
  { k: 'castle', swatch: '#8F93A8', img: asset('decor-castle.png'), h: 175 },
  { k: 'cave', swatch: '#6F7387', img: asset('decor-cave.png'), h: 130 },
  { k: 'coral', swatch: '#F48A8F', img: asset('decor-coral.png'), h: 125 },
  { k: 'seaweed', swatch: '#4FA35C', img: asset('decor-seaweed.png'), h: 185 },
  { k: 'seagrass', swatch: '#7CC05A', img: asset('decor-seagrass.png'), h: 140 },
  { k: 'rock', swatch: '#9A9BAE', img: asset('decor-rock.png'), h: 78 },
  { k: 'shell', swatch: '#F2A9B4', img: asset('decor-shell.png'), h: 62 },
  { k: 'star', swatch: '#F58A6E', img: asset('decor-star.png'), h: 56 },
];
export const decorOf = k => DECOR.find(x => x.k === k) || {};
export const DEFAULT_DECOR = [['seaweed', 5], ['rock', 14], ['chest', 28], ['shell', 40], ['coral', 55], ['seaweed', 68], ['cave', 84], ['seaweed', 95]];

export const SEED_NAMES = ['Ava', 'Liam', 'Mia', 'Noah', 'Zoe', 'Eli', 'Lily', 'Leo', 'Ivy', 'Max', 'Nora', 'Owen', 'Ruby', 'Sam', 'Maya', 'Theo', 'Ella', 'Jack', 'Aria', 'Finn', 'Luna', 'Kai'];

export const DEFAULT_MAX_FEED = 12;
export function maxFeedOf(raw) {
  const v = parseInt(raw, 10);
  return v >= 2 ? Math.min(v, 999) : DEFAULT_MAX_FEED;
}
// Little → Grown (half way) → Big (max).
export function stagesFor(maxFeed) {
  return [{ min: 0, scale: 0.6 }, { min: Math.max(1, Math.round(maxFeed / 2)), scale: 0.95 }, { min: maxFeed, scale: 1.5 }];
}
export function stageOf(food, stages) {
  let i = 0;
  stages.forEach((s, j) => { if (food >= s.min) i = j; });
  return i;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const THEMES = {
  sunny: {
    font: "'Fredoka',sans-serif", pageBg: '#DDF2FA', ink: '#2B3A4A', sub: '#5F7183', panelBg: '#FCF8F1', border: '#E5D9C6', rim: '#2F4C6B',
    tankBg: `url(${asset('tank-bg.png')}) center bottom / cover no-repeat, #5BBDE6`,
    sand: 'transparent', sandEdge: 'transparent', sandDot: 'transparent', rays: '0',
    rock: '#A9AFB8', rock2: '#8B929C', rockLine: '#5E6672',
    accent: '#F7889A', accentShadow: '#DD6A7F', accentInk: '#FFFFFF',
    rowBg: '#FFFFFF', rowBorder: '#EFE5D6', rowOpen: '#F7889A', inputBg: '#FFFFFF', inputBorder: '#E9DFCF',
    glow: 'drop-shadow(0 3px 0 rgba(30,70,110,.12))', labelBg: 'rgba(255,255,255,.95)', labelInk: '#2B3A4A', bubble: 'rgba(255,255,255,.8)',
    btnBg: '#2F4C6B', btnInk: '#FFFFFF', chip: '#F3EADC', pipOff: '#EFE5D6', pipOn: '#F7889A',
    tankShadow: '0 6px 0 rgba(47,76,107,.18)', pop: '#FFFFFF', popShadow: '0 2px 0 #2F4C6B',
  },
  night: {
    font: "'Fredoka',sans-serif", pageBg: '#0E1430', ink: '#EEF1FF', sub: '#A3ABD6', panelBg: '#161E42', border: '#2E3A78', rim: '#2E3A78',
    tankBg: 'linear-gradient(#173E74,#0B1F47 70%,#081535)',
    sand: '#232A55', sandEdge: '#2E3668', sandDot: 'rgba(255,255,255,.08)', rays: '1',
    rock: '#2F3769', rock2: '#262D5A', rockLine: '#1A2048',
    accent: '#7CF2D2', accentShadow: '#3FBFA0', accentInk: '#0E1430',
    rowBg: '#1C2550', rowBorder: '#2A346A', rowOpen: '#7CF2D2', inputBg: '#0F1736', inputBorder: '#2E3A78',
    glow: 'drop-shadow(0 0 10px rgba(160,220,255,.55))', labelBg: 'rgba(14,20,48,.88)', labelInk: '#EEF1FF', bubble: 'rgba(150,220,255,.55)',
    btnBg: '#7CF2D2', btnInk: '#0E1430', chip: '#222B5C', pipOff: '#2E3A78', pipOn: '#7CF2D2',
    tankShadow: '0 0 60px rgba(60,140,255,.25)', pop: '#7CF2D2', popShadow: '0 0 12px rgba(124,242,210,.8)',
  },
};
export const LOOKS = ['sunny', 'night'];

// Theme tokens exposed as CSS custom properties (--ink, --panelBg, …).
export const themeVars = t => Object.fromEntries(Object.entries(t).map(([k, v]) => ['--' + k, v]));
