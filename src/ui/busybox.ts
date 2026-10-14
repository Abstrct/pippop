/* The busy box: a toddler's activity board that rolls in while a toy is being unwrapped (its proof of
 * work is grinding). A peekaboo door hides the toy that is coming, with its ring filling up; a flower
 * spinner to flick; beads to push along a wavy wire; three switches that light three lamps; a knob that
 * clicks round. Playing helps for real: every twirl tells the engine to hash on every spare core for a
 * little while (pow.boost), and the sparkle in the corner shines while it does. */
import { pow, type PowTask } from '../pow/pow';
import { empire } from '../game/empire';
import { audio } from '../core/audio';
import { icon, iconSvg } from './icons';
import { toy, fmtWait } from '../lore';

const NS = 'http://www.w3.org/2000/svg';
const COL = { red: '#E4002B', sun: '#FFC72C', blue: '#0077C8', leaf: '#43B02A', peach: '#FF8F1C', plum: '#8246AF', sky: '#41B6E6', ink: '#1D2A5C', cream: '#FFF8E7', pink: '#FF8FB1' };
const ROOMS = new Set(['mat', 'toys', 'sky', 'fridge']);

function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, ...kids: SVGElement[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...kids);
  return el;
}
const svgUri = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

export function mountBusyBox() {
  const box = document.createElement('div');
  box.className = 'busybox'; box.hidden = true;
  box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Busy');
  const tab = document.createElement('button');
  tab.type = 'button'; tab.className = 'busytab'; tab.hidden = true; tab.setAttribute('aria-label', 'Busy');
  tab.append(icon('gift', 32));
  const shut = document.createElement('button');
  shut.type = 'button'; shut.className = 'round busy-x'; shut.setAttribute('aria-label', 'Close'); shut.append(icon('close', 26));
  const spark = document.createElement('span'); spark.className = 'busy-spark'; spark.append(icon('sparkle', 30));
  document.body.append(box);
  // the gift button leads the tray of work chips (the hud's .busy)
  const dockTab = () => { const tray = document.querySelector('.busy'); if (tray && tray.firstElementChild !== tab) tray.prepend(tab); };

  /* ── the board ── */
  const svg = s('svg', { viewBox: '0 0 300 330', class: 'busy-board' });
  const defs = s('defs');
  const clip = s('clipPath', { id: 'bb-win' }, s('rect', { x: 22, y: 22, width: 116, height: 116, rx: 22 }));
  defs.append(clip);
  svg.append(defs);
  // the plastic frame
  svg.append(s('rect', { x: 4, y: 4, width: 292, height: 322, rx: 34, fill: COL.red }));
  svg.append(s('rect', { x: 12, y: 12, width: 276, height: 306, rx: 28, fill: COL.cream }));

  // 1. peekaboo: the toy that is coming, behind a sliding door
  const win = s('g');
  win.append(s('rect', { x: 22, y: 22, width: 116, height: 116, rx: 22, fill: '#CDEBFF' }));
  const ringBg = s('circle', { cx: 80, cy: 80, r: 44, fill: 'none', stroke: '#FFFFFF', 'stroke-width': 9 });
  const ring = s('circle', { cx: 80, cy: 80, r: 44, fill: 'none', stroke: COL.leaf, 'stroke-width': 9, 'stroke-linecap': 'round', transform: 'rotate(-90 80 80)', 'stroke-dasharray': `${2 * Math.PI * 44}`, 'stroke-dashoffset': `${2 * Math.PI * 44}` });
  const toyImg = s('image', { x: 52, y: 48, width: 56, height: 56 });
  const wait = s('text', { x: 80, y: 128, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: COL.ink, 'font-family': 'inherit' });
  win.append(ringBg, ring, toyImg, wait);
  const door = s('g', { class: 'bb-grab' });
  door.append(s('rect', { x: 22, y: 22, width: 116, height: 116, rx: 22, fill: COL.sun }),
    s('circle', { cx: 120, cy: 80, r: 9, fill: COL.peach }),
    s('path', { d: 'M48 64 q8 -10 16 0 M96 64 q8 -10 16 0', stroke: COL.ink, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }),
    s('path', { d: 'M62 96 q18 16 36 0', stroke: COL.ink, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }));
  const doorWrap = s('g', { 'clip-path': 'url(#bb-win)' }, door);
  svg.append(win, doorWrap, s('rect', { x: 22, y: 22, width: 116, height: 116, rx: 22, fill: 'none', stroke: COL.blue, 'stroke-width': 6 }));

  // 2. the flower spinner
  const flower = s('g', { class: 'bb-grab' });
  const petals = [COL.red, COL.sun, COL.blue, COL.leaf, COL.peach, COL.plum];
  petals.forEach((c, i) => flower.append(s('ellipse', { cx: 0, cy: -30, rx: 17, ry: 27, fill: c, transform: `rotate(${i * 60})` })));
  flower.append(s('circle', { cx: 0, cy: 0, r: 17, fill: COL.cream, stroke: COL.ink, 'stroke-width': 3 }),
    s('circle', { cx: -5, cy: -3, r: 2.6, fill: COL.ink }), s('circle', { cx: 5, cy: -3, r: 2.6, fill: COL.ink }),
    s('path', { d: 'M-6 4 q6 6 12 0', stroke: COL.ink, 'stroke-width': 2.6, fill: 'none', 'stroke-linecap': 'round' }));
  const flowerAt = s('g', { transform: 'translate(220 80)' }, s('circle', { r: 62, fill: '#FFE9A8' }), flower);
  svg.append(flowerAt);

  // 3. beads on a wavy wire
  const wire = s('path', { d: 'M30 196 C 70 136, 110 252, 150 194 S 232 140, 270 196', fill: 'none', stroke: COL.ink, 'stroke-width': 7, 'stroke-linecap': 'round' });
  svg.append(s('circle', { cx: 30, cy: 196, r: 9, fill: COL.blue }), s('circle', { cx: 270, cy: 196, r: 9, fill: COL.blue }), wire);
  const beadCols = [COL.red, COL.sun, COL.leaf, COL.plum];
  const beads = beadCols.map((c) => { const b = s('circle', { r: 16, fill: c, stroke: COL.ink, 'stroke-width': 3, class: 'bb-grab' }); svg.append(b); return b; });

  // 4. three switches and their lamps, and a clicky knob
  const lampCols = [COL.red, COL.sun, COL.blue];
  const lamps: SVGCircleElement[] = [], levers: SVGRectElement[] = [];
  const on = [false, false, false];
  lampCols.forEach((c, i) => {
    const x = 50 + i * 52;
    const lamp = s('circle', { cx: x, cy: 248, r: 13, fill: '#E9E2D0', stroke: COL.ink, 'stroke-width': 3, 'data-c': c });
    const base = s('rect', { x: x - 17, y: 268, width: 34, height: 46, rx: 12, fill: COL.ink });
    const lever = s('rect', { x: x - 12, y: 272, width: 24, height: 22, rx: 8, fill: '#FFFFFF' });
    const sw = s('g', { class: 'bb-grab', tabindex: 0, role: 'switch', 'aria-checked': 'false', 'aria-label': 'Light' }, base, lever);
    sw.addEventListener('pointerdown', (e) => { e.preventDefault(); flip(i); });
    sw.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') { e.preventDefault(); flip(i); } });
    svg.append(lamp, sw);
    lamps.push(lamp); levers.push(lever);
  });
  const knob = s('g', { class: 'bb-grab', tabindex: 0, role: 'slider', 'aria-label': 'Knob', 'aria-valuemin': '0', 'aria-valuemax': '5', 'aria-valuenow': '0' });
  for (let i = 0; i < 6; i++) knob.append(s('circle', { cx: 0, cy: -38, r: 5, fill: petals[i], transform: `rotate(${i * 60})` }));
  const dial = s('g');
  dial.append(s('circle', { r: 28, fill: COL.peach, stroke: COL.ink, 'stroke-width': 3 }), s('rect', { x: -5, y: -26, width: 10, height: 22, rx: 5, fill: COL.cream }));
  knob.append(dial);
  const knobAt = s('g', { transform: 'translate(240 270)' }, knob);
  svg.append(knobAt);

  box.append(svg, shut, spark);

  /* ── playing ── */
  // the board's own coordinates for a pointer
  const pt = (e: PointerEvent) => { const m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 }; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); return { x: p.x, y: p.y }; };
  let lastHelp = 0;
  function help(e?: { clientX: number; clientY: number }) {
    pow.boost();
    paintSpark();
    const now = performance.now();
    if (e && now - lastHelp > 180) {
      lastHelp = now;
      // a little star flies from the finger into the peekaboo window
      const r = svg.getBoundingClientRect(), k = r.width / 300;
      const st = document.createElement('span'); st.className = 'busy-star'; st.append(icon('star', 22));
      st.style.left = e.clientX + 'px'; st.style.top = e.clientY + 'px';
      document.body.append(st);
      const to = { x: r.left + 80 * k, y: r.top + 80 * k };
      st.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${to.x - e.clientX}px), calc(-50% + ${to.y - e.clientY}px)) scale(.4)`, opacity: 0.2 }], { duration: 650, easing: 'cubic-bezier(.5,0,.6,1)' }).onfinish = () => st.remove();
    }
  }
  const drag = (el: Element, f: { down?: (e: PointerEvent) => void; move: (e: PointerEvent) => void; up?: (e: PointerEvent) => void }) => {
    el.addEventListener('pointerdown', (ev) => {
      const e = ev as PointerEvent; e.preventDefault(); e.stopPropagation();
      (el as Element).setPointerCapture?.(e.pointerId);
      f.down?.(e);
      const mv = (x: Event) => f.move(x as PointerEvent);
      const up = (x: Event) => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); f.up?.(x as PointerEvent); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  };

  // the door slides open (and creeps shut again after a while: peekaboo!)
  let doorX = 0, doorFrom = 0, grabX = 0, shutTimer = 0;
  const setDoor = (x: number) => { doorX = Math.max(0, Math.min(104, x)); door.setAttribute('transform', `translate(${doorX} 0)`); };
  drag(door, {
    down: (e) => { grabX = pt(e).x; doorFrom = doorX; clearTimeout(shutTimer); door.getAnimations?.().forEach((a) => a.cancel()); },
    move: (e) => { const was = doorX; setDoor(doorFrom + pt(e).x - grabX); if (was < 90 && doorX >= 90) { audio.chime('boing'); help(e); } else if (Math.abs(doorX - was) > 4) help(e); },
    up: () => { if (doorX > 50) setDoor(104); else setDoor(0); shutTimer = window.setTimeout(closeDoor, 6000); },
  });
  function closeDoor() {
    const from = doorX; if (!from) return;
    const t0 = performance.now();
    const step = (now: number) => { const k = Math.min(1, (now - t0) / 700); setDoor(from * (1 - k * k)); if (k < 1) requestAnimationFrame(step); else audio.chime('tap'); };
    requestAnimationFrame(step);
  }

  // the flower: drag it round, let go and it keeps spinning
  let ang = 0, vel = 0, grabA = 0, lastA = 0, lastT = 0, spinning = 0, lastTick = 0;
  const angleAt = (e: PointerEvent) => { const p = pt(e); return Math.atan2(p.y - 80, p.x - 220) * 180 / Math.PI; };
  const setAng = (a: number) => {
    const before = Math.floor(ang / 60);
    ang = a; flower.setAttribute('transform', `rotate(${ang})`);
    if (Math.floor(ang / 60) !== before && performance.now() - lastTick > 70) { lastTick = performance.now(); audio.chime('tap'); }
  };
  drag(flower, {
    down: (e) => { grabA = angleAt(e) - ang; lastA = ang; lastT = performance.now(); vel = 0; cancelAnimationFrame(spinning); },
    move: (e) => {
      let a = angleAt(e) - grabA;
      while (a - ang > 180) a -= 360; while (a - ang < -180) a += 360;
      const now = performance.now(), dt = Math.max(1, now - lastT);
      vel = vel * 0.5 + ((a - lastA) / dt) * 0.5; lastA = a; lastT = now;
      setAng(a); help(e);
    },
    up: () => {
      if (Math.abs(vel) > 0.05) audio.chime('whoosh');
      let prev = performance.now();
      const spin = (now: number) => { const dt = now - prev; prev = now; vel *= Math.pow(0.996, dt); setAng(ang + vel * dt); if (Math.abs(vel) > 0.01) { pow.boost(); spinning = requestAnimationFrame(spin); } };
      spinning = requestAnimationFrame(spin);
    },
  });

  // beads: each slides along the wire to where the finger is, and pushes its neighbours
  const N = 120;
  const L = () => wire.getTotalLength();
  const samples: { x: number; y: number }[] = [];
  const sample = () => { if (samples.length) return; const l = L(); for (let i = 0; i <= N; i++) { const p = wire.getPointAtLength((i / N) * l); samples.push({ x: p.x, y: p.y }); } };
  const pos = [0.06, 0.14, 0.22, 0.3];
  const GAP = 0.085;
  const placeBeads = () => { sample(); pos.forEach((u, i) => { const p = samples[Math.round(u * N)]; beads[i].setAttribute('cx', String(p.x)); beads[i].setAttribute('cy', String(p.y)); }); };
  beads.forEach((b, i) => drag(b, {
    move: (e) => {
      sample();
      const p = pt(e);
      let best = 0, bd = Infinity;
      samples.forEach((q, k) => { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; best = k; } });
      const want = Math.max(i * GAP, Math.min(1 - (beads.length - 1 - i) * GAP, best / N));
      if (Math.abs(want - pos[i]) < 0.004) return;
      pos[i] = want;
      for (let j = i + 1; j < pos.length; j++) if (pos[j] < pos[j - 1] + GAP) { pos[j] = pos[j - 1] + GAP; if (j === pos.length - 1 && pos[j] >= 1 - 0.001) audio.chime('pop'); }
      for (let j = i - 1; j >= 0; j--) if (pos[j] > pos[j + 1] - GAP) { pos[j] = pos[j + 1] - GAP; if (j === 0 && pos[j] <= 0.001) audio.chime('pop'); }
      placeBeads(); help(e);
    },
  }));

  // switches light lamps
  function flip(i: number) {
    on[i] = !on[i];
    levers[i].setAttribute('y', on[i] ? '290' : '272');
    lamps[i].setAttribute('fill', on[i] ? lampCols[i] : '#E9E2D0');
    lamps[i].classList.toggle('lit', on[i]);
    levers[i].parentElement?.setAttribute('aria-checked', String(on[i]));
    audio.chime(on[i] ? 'squeak' : 'tap');
    const r = levers[i].getBoundingClientRect();
    help({ clientX: r.left + r.width / 2, clientY: r.top });
    if (on.every(Boolean)) { audio.chime('yay'); box.classList.remove('party'); void box.offsetWidth; box.classList.add('party'); }
  }

  // the knob clicks round six stops
  let stop = 0, kAng = 0, kGrab = 0;
  const knobAngle = (e: PointerEvent) => { const p = pt(e); return Math.atan2(p.y - 270, p.x - 240) * 180 / Math.PI + 90; };
  const setStop = (n: number) => {
    n = ((n % 6) + 6) % 6;
    if (n === stop) return;
    stop = n; dial.setAttribute('transform', `rotate(${n * 60})`); knob.setAttribute('aria-valuenow', String(n));
    audio.chime('squeak');
  };
  drag(knob, {
    down: (e) => { kGrab = knobAngle(e); kAng = stop * 60; },
    move: (e) => { let d = knobAngle(e) - kGrab; while (d > 180) d -= 360; while (d < -180) d += 360; const before = stop; setStop(Math.round((kAng + d) / 60)); if (stop !== before) help(e); },
  });
  knob.addEventListener('keydown', (e) => { const k = (e as KeyboardEvent).key; if (k === 'ArrowRight' || k === 'ArrowUp') { e.preventDefault(); setStop(stop + 1); help(); } if (k === 'ArrowLeft' || k === 'ArrowDown') { e.preventDefault(); setStop(stop - 1); help(); } });

  /* ── when it shows ── */
  let open = false, dismissed = false, forced = false, had = false, toyShown = -1;
  shut.addEventListener('click', () => { dismissed = true; forced = false; setOpen(false); audio.chime('boop'); });
  tab.addEventListener('click', () => { dismissed = false; forced = true; setOpen(true); audio.chime('open'); });
  function setOpen(v: boolean) {
    if (open === v) return;
    open = v;
    box.classList.toggle('on', v);
    if (v) { box.hidden = false; requestAnimationFrame(placeBeads); }
  }
  const mine = (): PowTask[] => {
    const p = empire.commander;
    return p ? pow.active.filter((t) => t.kind === 'build' && t.playerId === p.playerId && t.status !== 'failed') : [];
  };
  function paintSpark() { spark.classList.toggle('on', pow.boosting); }
  function paint() {
    dockTab();
    const room = document.body.dataset.room || '';
    const tasks = mine();
    const want = tasks.length > 0 && ROOMS.has(room);
    if (!want) {
      forced = false; setOpen(false);
      tab.hidden = true;
      if (had && !tasks.length) dismissed = false;   // the next wait starts fresh
      had = tasks.length > 0;
      return;
    }
    had = true;
    // the side panels (a toy's card) win the space: the box tucks into its tab
    const phone = matchMedia('(max-width: 760px), (max-height: 620px)').matches;
    const crowded = !!document.querySelector('.toy-card:not([hidden]), .veil, .panel.right:not([hidden])');
    const show = open ? !crowded || phone || forced : !dismissed && !crowded && !phone;
    setOpen(show && !(phone && !open));
    tab.hidden = open;
    // the toy that comes soonest is behind the door
    const soon = tasks.map((t) => ({ t, e: pow.eta(t) })).sort((a, b) => a.e.secs - b.e.secs)[0];
    const s0 = empire.commander?.structs.get(soon.t.objectId);
    const typeId = s0?.typeId ?? 0;
    if (typeId !== toyShown) { toyShown = typeId; toyImg.setAttribute('href', svgUri(iconSvg(typeId ? toy(typeId).icon : 'gift', 112))); }
    const c = 2 * Math.PI * 44;
    ring.setAttribute('stroke-dashoffset', String(c * (1 - soon.e.frac)));
    wait.textContent = fmtWait(soon.e.secs);
    tab.style.setProperty('--f', String(soon.e.frac));
    tab.dataset.n = tasks.length > 1 ? String(tasks.length) : '';
    paintSpark();
  }
  pow.onChange(paint);
  empire.onChange(paint);
  window.addEventListener('hashchange', () => setTimeout(paint, 50));
  setInterval(paint, 1000);
  // a tap anywhere outside closes the phone's sheet
  document.addEventListener('pointerdown', (e) => {
    if (!open || !matchMedia('(max-width: 760px), (max-height: 620px)').matches) return;
    if (box.contains(e.target as Node) || tab.contains(e.target as Node)) return;
    forced = false; setOpen(false); tab.hidden = false;
  }, true);
  box.addEventListener('transitionend', () => { if (!open) box.hidden = true; });
  setDoor(0); setAng(0);
}
