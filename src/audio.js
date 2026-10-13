// Tiny Web Audio synth for the bloop / chime / plop effects.
let ctx = null;
let enabled = true;

export function setSoundEnabled(on) { enabled = on; }

function audio() {
  if (!enabled) return null;
  if (!ctx) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    ctx = new A();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(f1, f2, dur, type = 'sine', vol = 0.15, delay = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const bloop = () => tone(320, 950, 0.14, 'sine', 0.16);
export const chime = () => [523, 659, 784, 1046].forEach((n, i) => tone(n, n * 1.01, 0.35, 'triangle', 0.1, i * 0.09));
export const plop = () => tone(900, 500, 0.08, 'sine', 0.05);
