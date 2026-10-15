/* The helping hand: learning by example, the way a baby learns a toy. Whenever the player hesitates, a
 * big friendly hand floats to the next thing worth touching and taps it, again and again, with a ripple.
 * Touch anything and it goes away. The first time on a mat it shows by doing: it drags across the mat
 * (and the mat really spins), then pats the Bear (and the Bear really wiggles). It never speaks, and it
 * only ever points at things that are really there to press. */
import { world } from '../world/world';
import { empire } from '../game/empire';
import { owned } from '../realm';

const IDLE_FIRST = 2600;   // a room never seen before: help comes quickly
const IDLE = 7000;         // after that: only when someone is really stuck
const SEEN = 'pippop.guide.seen';
const DEMO = 'pippop.guide.demo';

const store = { get(k: string) { try { return localStorage.getItem(k); } catch { return null; } }, set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* fine */ } } };

interface Spot { x: number; y: number; key?: string }

export function mountGuide() {
  const NS = 'http://www.w3.org/2000/svg';
  const hand = document.createElement('div');
  hand.className = 'hand'; hand.setAttribute('aria-hidden', 'true');
  hand.innerHTML = `<span class="hand-ring"></span><svg class="hand-img" viewBox="0 0 24 24" width="84" height="84" xmlns="${NS}"><path d="M9 3a2 2 0 0 1 2 2v6h1V9.5a1.5 1.5 0 0 1 3 0V11h1v-.5a1.5 1.5 0 0 1 3 0V12h.5a1.5 1.5 0 0 1 1.5 1.5V17c0 3-2.5 5-5.5 5H12c-2 0-3.5-1-4.5-2.5L4.6 15a1.6 1.6 0 0 1 2.6-1.8L7 13.4V5a2 2 0 0 1 2-2z" fill="#FFFFFF" stroke="#1D2A5C" stroke-width="1.4" stroke-linejoin="round"/><path d="M11 11v3M14.5 11.2v2.8M18 12.2v2" stroke="#1D2A5C" stroke-width="1.1" stroke-linecap="round" fill="none"/></svg>`;
  document.body.append(hand);
  // the fingertip, in the hand's own pixels: that is the point that touches the target
  const TIP = { x: (9 / 24) * 84, y: (3.2 / 24) * 84 };

  let shownKey = '', lastInput = Date.now(), showing = false, demo: Animation | null = null, demoing = false, skyPick = -1, skyAt = '';
  const seen = new Set((store.get(SEEN) || '').split(',').filter(Boolean));

  const place = (p: Spot) => { hand.style.transform = `translate(${Math.round(p.x - TIP.x)}px, ${Math.round(p.y - TIP.y)}px)`; };
  function show(p: Spot) {
    if (!showing) { hand.classList.add('on'); showing = true; }
    hand.classList.add('tap');
    place(p);
  }
  function hide() {
    if (!showing && !demoing) return;
    hand.classList.remove('on', 'tap'); showing = false;
    demo?.cancel(); demo = null; demoing = false;
  }

  /* any touch, click or key is the player playing: the hand steps back */
  const wake = () => { lastInput = Date.now(); hide(); };
  for (const ev of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, wake, { capture: true, passive: true });

  const visible = (el: Element | null): el is HTMLElement => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    return !(el as HTMLButtonElement).disabled && !(el as HTMLElement).closest('[hidden]');
  };
  const centre = (el: HTMLElement): Spot => { const r = el.getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.55, key: (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 40) }; };
  const first = (...sel: string[]): Spot | null => { for (const s of sel) for (const el of document.querySelectorAll(s)) if (visible(el)) return centre(el as HTMLElement); return null; };
  const onScreen = (p: { x: number; y: number; behind?: boolean } | null) => (p && !p.behind && p.x > 20 && p.y > 90 && p.x < innerWidth - 20 && p.y < innerHeight - 110 ? p : null);

  /** The one thing worth touching next, from what is really on screen and in the game. */
  function target(): Spot | null {
    const room = document.body.dataset.room || '';
    // a box on top comes first: its bright answer
    if (document.querySelector('.veil')) return first('.veil .pill.huge', '.veil .pill.big.leaf', '.veil .pill.big.peach', '.veil .pill.big.sun:not([data-dismiss])');
    const p = empire.commander;
    switch (room) {
      case 'hi':
        return first('.hello .pill.huge:not([disabled])', '.hello .check[aria-checked="false"]', '.hello .pill.big.leaf:not([disabled])');
      case 'mat': {
        // a toy that is napping, on an open card: wake it
        const wake = first('.toy-card .acts .pill.sun');
        if (wake && document.querySelector('.toy-card .note')) return wake;
        // the signs say what needs doing (make a Digger, wake the Bear, bonk a raider, roll home…)
        const sign = first('.signs .sign .pill');
        if (sign) return sign;
        if (p && !owned(p, 14)) return first('.fab');
        if (p && !owned(p, 15)) return first('.fab');
        return null;
      }
      case 'toys': {
        const make = first('.toy-card .pill.huge.red');
        if (make) return make;
        if (p) for (const id of [14, 15, 20]) if (!owned(p, id)) { const b = first(`[data-key="toy:${id}"]:not(.off)`); if (b) return b; }
        return null;
      }
      case 'sky': {
        const act = first('.toy-card .acts .pill.blue', '.toy-card .acts a.pill.red');
        if (act) return act;
        // tap somebody's hanging mat: the same one each time, until the sky changes
        const st = world.current as unknown as { anchor?: (i: number) => { clone(): unknown } | null; count?: () => { n: number; me: number } };
        if (!st.anchor || !st.count) return null;
        const { n, me } = st.count();
        if (n < 2) return null;
        const key = `${n}|${me}`;
        if (skyAt !== key || skyPick < 0) { skyAt = key; skyPick = me === 0 ? 1 : 0; }
        const at = st.anchor(skyPick);
        const sp = at ? onScreen(world.toScreen(at as never)) : null;
        return sp ? { x: sp.x, y: sp.y, key: 'sky-mat' } : null;
      }
      case 'bonk': return first('.strike .bonk-btn:not([disabled])', '.strike .dice-btn:not([disabled])', '.strike .pill.huge');
      case 'fridge': return first('.toy-card .acts .pill.sun', '.panel.left .pill.wiggle');
      default: return null;
    }
  }

  /** First time on a mat: drag across it (it spins), then pat the Bear (it wiggles). */
  function matDemo(): boolean {
    if (store.get(DEMO) || document.body.dataset.room !== 'mat') return false;
    const p = empire.commander;
    const bear = p ? [...p.structs.values()].find((s) => s.typeId === 1 && !s.destroyed && s.built) : undefined;
    const st = world.current as unknown as { anchor?: (id: string) => unknown; hover?: (id: string | null) => void };
    if (!bear || !st.anchor || !st.hover) return false;
    const bp = onScreen(world.toScreen(st.anchor(bear.id) as never));
    if (!bp) return false;
    store.set(DEMO, '1');
    demoing = true;
    hand.classList.add('on'); hand.classList.remove('tap');
    const y = Math.min(innerHeight - 200, bp.y + 70);
    const from = { x: innerWidth * 0.3, y }, to = { x: innerWidth * 0.7, y };
    const tf = (s: Spot) => `translate(${Math.round(s.x - TIP.x)}px, ${Math.round(s.y - TIP.y)}px)`;
    demo = hand.animate([{ transform: tf(from), offset: 0 }, { transform: tf(from), offset: 0.15 }, { transform: tf(to), offset: 0.6 }, { transform: tf(to), offset: 0.7 }, { transform: tf(bp), offset: 1 }], { duration: 2600, easing: 'ease-in-out', fill: 'forwards' });
    setTimeout(() => { if (demoing) world.nudge(0.055); }, 600);
    demo.onfinish = () => {
      // the demo's last frame becomes the hand's own place; a finished animation left "filling" would
      // pin the hand there and every later hint would point at the wrong spot
      demo?.commitStyles(); demo?.cancel();
      if (!demoing) return;
      demo = null; demoing = false;
      place(bp); hand.classList.add('tap'); showing = true;
      st.hover!(bear.id);
      setTimeout(() => { st.hover!(null); }, 1600);
      setTimeout(() => { if (showing) hide(); lastInput = Date.now(); }, 3200);
    };
    return true;
  }

  setInterval(() => {
    if (document.hidden || demoing) return;
    const room = document.body.dataset.room || '';
    const idle = Date.now() - lastInput;
    // something new to touch gets a quick hint; something already shown waits until the player is stuck
    const t = target();
    const key = t ? `${room}:${t.key || ''}` : room;
    // a hint already up stays up (and follows its target) until the player touches something
    if (showing && t && key === shownKey) { show(t); return; }
    const wait = seen.has(key) ? IDLE : IDLE_FIRST;
    if (idle < wait) { if (showing) hide(); return; }
    if (!showing && !seen.has('demo') && matDemo()) { seen.add('demo'); return; }
    if (!t) { if (showing) hide(); return; }
    if (!seen.has(key)) { seen.add(key); store.set(SEEN, [...seen].slice(-80).join(',')); }
    shownKey = key;
    show(t);
  }, 400);
}
