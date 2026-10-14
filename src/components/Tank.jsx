import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { decorOf, fishFilter, growScale, typeOf } from '../constants.js';

const TOP = 50;

function retarget(f, W, top, bottom) {
  f.tx = 40 + Math.random() * (W - 80);
  f.ty = top + Math.random() * (bottom - top);
}

/**
 * The aquarium: swimming fish (animated directly on the DOM each frame), food pellets,
 * bubbles, and the draggable / resizable decorations.
 */
const Tank = forwardRef(function Tank(props, ref) {
  const { students, decor, decorating, focusId, selDecor, L, isEmpty } = props;
  const tankRef = useRef(null), fxRef = useRef(null);
  const fishEls = useRef(new Map());
  const decorEls = useRef(new Map());
  const sim = useRef({}), pellets = useRef([]), hovered = useRef(null);
  const live = useRef(props);
  live.current = props;

  const popup = (x, y, text, size) => {
    const fx = fxRef.current; if (!fx) return;
    const t = live.current.theme;
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,0);font-family:${t.font};font-size:${size}px;font-weight:700;color:${t.pop};text-shadow:${t.popShadow};white-space:nowrap;transition:transform 1.1s ease-out,opacity 1.1s ease-in;opacity:1`;
    fx.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-46px)'; el.style.opacity = '0'; }));
    setTimeout(() => el.remove(), 1200);
  };

  const bubble = (x, y, size) => {
    const fx = fxRef.current, tank = tankRef.current;
    if (!fx || !tank || document.hidden) return;
    const sz = size || 6 + Math.random() * 10;
    const bx = x != null ? x : Math.random() * tank.clientWidth;
    const by = y != null ? y : tank.clientHeight - 50;
    const el = document.createElement('div');
    el.className = 'bubble';
    el.style.cssText = `left:${bx}px;top:${by}px;width:${sz}px;height:${sz}px;border-color:${live.current.theme.bubble};animation-duration:${5 + Math.random() * 3}s`;
    el.addEventListener('animationend', () => el.remove());
    fx.appendChild(el);
  };

  // remote: the feed already happened on another device and is counted; only show the fish eating it.
  const dropFood = (id, remote = false) => {
    const f = sim.current[id], fx = fxRef.current, tank = tankRef.current;
    if (!f || !fx || !tank) { if (!remote) live.current.onAte(id); return; }
    const el = document.createElement('div');
    el.className = 'pellet';
    fx.appendChild(el);
    const W = tank.clientWidth;
    const x = Math.max(20, Math.min(W - 20, f.x + (Math.random() - 0.5) * 60));
    pellets.current.push({ x, y: -10, floor: tank.clientHeight - 64, fishId: id, el, vy: 0.8 + Math.random() * 0.4, remote });
  };

  const removePellet = p => { p.el.remove(); pellets.current = pellets.current.filter(q => q !== p); };

  const eat = (s, p, f) => {
    removePellet(p);
    f.show = performance.now() + 2500;
    f.gulp = 1;
    if (!p.remote) live.current.onAte(s.id);
    popup(f.x, f.y - 30 * f.sc - 30, '+1', 22);
    for (let i = 0; i < 3; i++) setTimeout(() => bubble(f.x + 20 * f.dir, f.y - 8, 6 + i * 2), i * 120);
  };

  useImperativeHandle(ref, () => ({ dropFood }));

  // Animation loop + ambient bubbles.
  useEffect(() => {
    let last = performance.now(), raf;
    const tick = now => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(3, (now - last) / 16.67); last = now;
      const tank = tankRef.current; if (!tank) return;
      const { students, focusId, decorating, alwaysNames, maxFeed } = live.current;
      const W = tank.clientWidth, H = tank.clientHeight, bottom = H - 90;
      const ids = {};
      for (const s of students) {
        ids[s.id] = 1;
        const el = fishEls.current.get(s.id); if (!el) continue;
        const focus = s.id === focusId;
        // Feeds from another device are already in s.food; hold that growth back until the fish eats them.
        const unseen = pellets.current.filter(q => q.fishId === s.id && q.remote).length;
        const base = growScale(Math.max(0, s.food - unseen), maxFeed), target = focus ? Math.max(2, base * 1.4) : base;
        let f = sim.current[s.id];
        if (!f) {
          f = sim.current[s.id] = { x: 40 + Math.random() * (W - 80), y: TOP + Math.random() * Math.max(1, bottom - TOP), vx: 0, vy: 0, sp: 0.5 + Math.random() * 0.5, dir: Math.random() < 0.5 ? 1 : -1, ph: Math.random() * 6.28, sc: target, show: 0, gulp: 0 };
          retarget(f, W, TOP, bottom);
        }
        const p = pellets.current.find(q => q.fishId === s.id);
        let tx = f.tx, ty = f.ty, sp = f.sp;
        if (p) { tx = p.x; ty = p.y; sp = 2.6; } else if (focus) { tx = W / 2; ty = H * 0.45; sp = 3.2; }
        const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) || 1;
        if (!p && !focus && (d < 24 || Math.random() < 0.003 * dt)) retarget(f, W, TOP, bottom);
        const k = 0.04 * dt;
        f.vx += (dx / d * sp - f.vx) * k;
        f.vy += (dy / d * sp * 0.7 - f.vy) * k;
        f.x = Math.max(30, Math.min(W - 30, f.x + f.vx * dt));
        f.y = Math.max(TOP, Math.min(bottom, f.y + f.vy * dt));
        const frozen = focus && !p;
        if (frozen) {
          // The fish being edited glides to the middle and holds still, facing right.
          const ax = W / 2, ay = H * 0.45;
          if (Math.hypot(ax - f.x, ay - f.y) < 3) { f.x = ax; f.y = ay; }
          else { f.x += (ax - f.x) * 0.12 * dt; f.y += (ay - f.y) * 0.12 * dt; }
          f.vx = 0; f.vy = 0; f.dir = 1;
        } else if (Math.abs(f.vx) > 0.12) f.dir = f.vx > 0 ? 1 : -1;
        f.sc += (target - f.sc) * 0.05 * dt;
        f.gulp = Math.max(0, f.gulp - 0.035 * dt);
        const sc = f.sc * (1 + 0.14 * Math.sin(Math.PI * f.gulp)); // quick swell when it eats
        if (p && d < 14 + 22 * f.sc) eat(s, p, f);
        const bob = frozen ? 0 : Math.sin(now / 450 + f.ph) * 3;
        const tilt = frozen ? 0 : Math.max(-14, Math.min(14, f.vy * 10));
        el.style.transform = `translate(${f.x}px,${f.y + bob}px)`;
        el.style.zIndex = focus ? '40' : String(Math.round(f.sc * 10));
        el.style.pointerEvents = decorating ? 'none' : 'auto';
        el.style.opacity = decorating ? '0.5' : '1';
        const body = el.firstChild, lab = el.lastChild;
        body.style.transform = `translate(-50%,-50%) rotate(${tilt}deg) scale(${f.dir * sc},${sc})`;
        lab.style.transform = `translate(-50%,${-(30 * f.sc + 34)}px)`;
        lab.style.opacity = (focus || alwaysNames || hovered.current === s.id || now < f.show) ? '1' : '0';
      }
      for (const id of Object.keys(sim.current)) if (!ids[id]) delete sim.current[id];
      for (const p of pellets.current.slice()) {
        if (!ids[p.fishId]) { removePellet(p); continue; }
        if (p.y < p.floor) p.y += p.vy * dt;
        p.x += Math.sin(now / 300 + p.vy * 10) * 0.2;
        p.el.style.transform = `translate(${p.x - 5}px,${p.y - 5}px)`;
      }
    };
    raf = requestAnimationFrame(tick);
    const bt = setInterval(() => bubble(), 900);
    return () => { cancelAnimationFrame(raf); clearInterval(bt); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Full screen for the tank alone (e.g. on the smartboard). Esc also exits.
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === tankRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  const toggleFullscreen = e => {
    e.stopPropagation();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else tankRef.current.requestFullscreen().catch(() => {});
  };

  const onFishTap = (e, id) => {
    e.stopPropagation();
    if (live.current.editing) { live.current.onCloseEdit(); return; }
    const f = sim.current[id]; if (f) f.show = performance.now() + 2500;
    dropFood(id);
  };

  const startDrag = (id, e) => {
    if (!decorating) return;
    e.preventDefault();
    e.stopPropagation();
    const r = tankRef.current.getBoundingClientRect();
    let moved = false;
    const move = ev => {
      moved = true;
      const x = Math.max(3, Math.min(97, (ev.clientX - r.left) / r.width * 100));
      props.setDecor(ds => ds.map(d => d.id === id ? { ...d, x } : d));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (moved) props.onDecorCommit(id); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    props.onSelectDecor(id);
  };

  // side: 1 = right handle, -1 = left handle. Up/outward grows, down/inward shrinks.
  const startResize = (item, e, side) => {
    e.preventDefault();
    e.stopPropagation();
    const s0 = item.size || 1, x0 = e.clientX, y0 = e.clientY, base = decorOf(item.kind).h || 80;
    const move = ev => {
      const delta = ((ev.clientX - x0) * side + (y0 - ev.clientY)) / 2;
      const size = Math.max(0.4, Math.min(2.5, s0 + delta / base));
      props.setDecor(ds => ds.map(d => d.id === item.id ? { ...d, size } : d));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); props.onDecorCommit(item.id); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    props.onSelectDecor(item.id);
  };

  const decorHeight = d => Math.round((decorOf(d.kind).h || 80) * (d.size || 1));
  const selItem = decorating ? decor.find(d => d.id === selDecor) : null;

  // New position in the drawing order for Front (dir 1) / Back (dir -1): just past the nearest decoration
  // it actually overlaps, so every press makes a visible change. If nothing overlaps, one step.
  const layerTarget = (id, dir) => {
    const i = decor.findIndex(d => d.id === id), el = decorEls.current.get(id);
    const r = el && el.getBoundingClientRect();
    const overlaps = d => {
      const o = decorEls.current.get(d.id), q = o && o.getBoundingClientRect();
      return r && q && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top;
    };
    for (let j = i + dir; j >= 0 && j < decor.length; j += dir) if (overlaps(decor[j])) return j;
    return i + dir;
  };

  const stop = e => e.stopPropagation();
  const act = fn => e => { e.stopPropagation(); fn(); };

  return (
    <div ref={tankRef} className="tank" onClick={props.onTankClick}>
      <div className="ray" style={{ left: '12%', width: 70, height: '75%', '--a': '.32' }} />
      <div className="ray" style={{ left: '30%', width: 34, height: '65%', '--a': '.26' }} />
      <div className="ray" style={{ left: '58%', width: 90, height: '80%', '--a': '.22' }} />
      <div className="sand" />
      <div className="pebble" style={{ left: '22%', bottom: 10, width: 16, height: 9, background: 'var(--rock)' }} />
      <div className="pebble" style={{ left: '47%', bottom: 6, width: 12, height: 7, background: 'var(--rock2)' }} />
      <div className="pebble" style={{ left: '66%', bottom: 12, width: 14, height: 8, background: 'var(--rock)' }} />

      {/* While a decoration is selected, decorations draw above the fish so its menu stays readable. */}
      {/* stop: a press that starts on a decoration and ends on the overlay that just appeared is reported as a
          click on this layer; without it the tank would treat it as a tap on empty water and deselect. */}
      <div className="decor-layer" style={{ zIndex: decorating && selDecor ? 55 : 1 }} onClick={stop}>
        {decor.map((d, i) => {
          const cat = decorOf(d.kind);
          return (
            <div
              key={d.id}
              ref={el => { if (el) decorEls.current.set(d.id, el); else decorEls.current.delete(d.id); }}
              className={'decor' + (decorating ? ' editable' : '')}
              style={{ left: d.x + '%', zIndex: i + 1 }}
              onPointerDown={e => startDrag(d.id, e)}
              onClick={act(() => { if (selDecor !== d.id) props.onSelectDecor(d.id); })}
              onDoubleClick={act(() => props.onFlipDecor(d.id))}
            >
              <div style={{ transform: `scaleX(${d.flip ? -1 : 1})`, transition: 'transform .25s' }}>
                {cat.img && <img src={cat.img} alt="" draggable="false" style={{ height: decorHeight(d) }} />}
              </div>
            </div>
          );
        })}

        {/* The selected decoration stays at its real layer so Front / Back visibly change it. Its outline,
            menu and handles sit on this overlay (an invisible copy of the same size) so they are never covered. */}
        {selItem && (() => {
          const d = selItem, i = decor.indexOf(d), cat = decorOf(d.kind);
          return (
            <div
              className="decor decor-overlay"
              style={{ left: d.x + '%', zIndex: decor.length + 10 }}
              onPointerDown={e => startDrag(d.id, e)}
              onClick={stop}
              onDoubleClick={act(() => props.onFlipDecor(d.id))}
            >
              {cat.img && <img src={cat.img} alt="" draggable="false" style={{ height: decorHeight(d), visibility: 'hidden' }} />}
              <div className="decor-menu" onPointerDown={stop} onClick={stop} onDoubleClick={stop}>
                <button title={L.forward} aria-label={L.forward} disabled={i === decor.length - 1} onClick={act(() => props.onMoveLayer(d.id, layerTarget(d.id, 1)))}>↑ {L.forwardShort}</button>
                <button title={L.backward} aria-label={L.backward} disabled={i === 0} onClick={act(() => props.onMoveLayer(d.id, layerTarget(d.id, -1)))}>↓ {L.backShort}</button>
                <button onClick={act(() => props.onFlipDecor(d.id))}>{L.flip}</button>
                <button className="danger" onClick={act(() => props.onRemoveDecor(d.id))}>{L.remove}</button>
                <div className="decor-menu-tip" />
              </div>
              <div className="handle right" onPointerDown={e => startResize(d, e, 1)} />
              <div className="handle left" onPointerDown={e => startResize(d, e, -1)} />
            </div>
          );
        })()}
      </div>

      {focusId && <div className="focus-dim" />}

      {students.map(s => (
        <div
          key={s.id}
          ref={el => { if (el) fishEls.current.set(s.id, el); else fishEls.current.delete(s.id); }}
          className="fish"
          onClick={e => onFishTap(e, s.id)}
          onPointerEnter={() => { hovered.current = s.id; }}
          onPointerLeave={() => { if (hovered.current === s.id) hovered.current = null; }}
        >
          <div className="fish-body">
            <img src={typeOf(s.type).img} alt="" draggable="false" style={{ filter: fishFilter(s) }} />
          </div>
          <div className="fish-label">{s.name}</div>
        </div>
      ))}

      <div ref={fxRef} className="fx" />
      {isEmpty && <div className="tank-empty">{L.empty}</div>}
      {canFullscreen && (
        <button className="fullscreen-btn" onClick={toggleFullscreen} aria-label={fullscreen ? L.exitFullscreen : L.fullscreen} title={fullscreen ? L.exitFullscreen : L.fullscreen}>
          {fullscreen ? '✕' : '⛶'} <span>{fullscreen ? L.exitFullscreen : L.fullscreen}</span>
        </button>
      )}
      <div className="rim-top" />
      <div className="rim-bottom" />
      <div className="glass" />
    </div>
  );
});

export default Tank;
