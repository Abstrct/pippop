/* The few DOM helpers everything asks for, dressed as toys: pop-up bubbles (one word and a symbol)
 * and a yes/no box (two big buttons). Nothing here ever shows a sentence. */
import { oops } from '../lore';
import { icon, hasIcon } from '../ui/icons';
import { audio } from './audio';

type Kind = '' | 'player' | 'enemy' | 'warn';
type Props = Record<string, unknown>;
type Child = Node | string | number | null | undefined | false | Child[];

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v as Record<string, string>)) { if (sk.startsWith('--')) el.style.setProperty(sk, String(sv)); else (el.style as unknown as Record<string, string>)[sk] = sv; }
    else if (k === 'class') el.className = String(v);
    else if (k in el && k !== 'list' && k !== 'form') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  const add = (c: Child) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : String(c));
  };
  children.forEach(add);
  return el;
}

export function clear(el: Element) { while (el.firstChild) el.removeChild(el.firstChild); }

/** Rebuild `box` without losing the keyboard focus (the control is found again by data-key or label). */
export function keepFocus(box: Element, rebuild: () => void) {
  const id = (e: Element) => ((e as HTMLElement).dataset?.key || e.getAttribute('aria-label') || e.textContent || '').trim();
  const a = document.activeElement;
  const had = a && a !== document.body && box.contains(a) && !(a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) ? id(a) : null;
  rebuild();
  if (had == null || (document.activeElement && box.contains(document.activeElement))) return;
  const back = [...box.querySelectorAll('button, a[href], summary, select, [tabindex]')].find((e) => id(e) === had) as HTMLElement | undefined;
  back?.focus({ preventScroll: true });
}

function tray(): HTMLElement {
  let t = document.getElementById('bubbles');
  if (!t) { t = h('div', { id: 'bubbles', role: 'status', 'aria-live': 'polite' }); document.body.append(t); }
  return t;
}
const live = new Map<string, { el: HTMLElement; n: number; timer: ReturnType<typeof setTimeout> }>();

export type Tone = 'yay' | 'uh' | 'hm' | '';
/** A bubble: a symbol, one word, maybe a toy, maybe one button. */
export function bubble(word: string, ic: string, tone: Tone = '', o: { toy?: string; ms?: number; action?: { label: string; icon?: string; run: () => void } } = {}) {
  const key = tone + '|' + word + '|' + (o.toy || '');
  const ms = o.ms ?? 3200;
  const same = live.get(key);
  const retire = (el: HTMLElement) => setTimeout(() => { el.classList.remove('on'); live.delete(key); setTimeout(() => el.remove(), 400); }, ms);
  if (same && same.el.isConnected) {
    same.n++; clearTimeout(same.timer); same.timer = retire(same.el);
    let b = same.el.querySelector('.bub-n');
    if (!b) { b = h('b', { class: 'bub-n' }); same.el.append(b); }
    b.textContent = '×' + same.n;
    return;
  }
  const el = h('div', { class: `bub ${tone}` },
    h('span', { class: 'bub-ic' }, icon(hasIcon(ic) ? ic : 'oops', 30)),
    o.toy ? h('span', { class: 'bub-ic' }, icon(o.toy, 30)) : null,
    h('span', { class: 'bub-w' }, word),
    o.action ? h('button', { type: 'button', class: 'pill small', onclick: () => { o.action!.run(); el.remove(); live.delete(key); } }, o.action.icon ? icon(o.action.icon, 20) : null, o.action.label) : null);
  const t = tray(); t.append(el);
  while (t.children.length > 3) t.firstElementChild?.remove();
  requestAnimationFrame(() => el.classList.add('on'));
  live.set(key, { el, n: 1, timer: retire(el) });
  if (tone === 'yay') audio.chime('yay'); else if (tone === 'uh') audio.chime('uh'); else audio.chime('tap');
}

/** The engine's old toast: its sentence becomes one word. */
export function toast(text: string, kind: Kind = '', ms = 3200, action?: { label: string; run: () => void }) {
  const short = text.trim().split(/\s+/).length <= 2 ? text.replace(/[.!]+$/, '') : null;
  if (kind === 'enemy' || kind === 'warn') { const w = oops(text); bubble(short || w.w, w.i, 'uh', { ms, action: action ? { label: oops(action.label).w === 'Oops' ? 'Again' : oops(action.label).w, run: action.run } : undefined }); return; }
  bubble(short || 'Yay', short ? 'sparkle' : 'check', kind === 'player' ? 'yay' : '', { ms });
}

/** Ask before something that cannot be undone. Two big buttons: the safe one is bright. */
export function confirmBox(title: string, _text: string | string[] = '', ok: string | null = 'Yes', _tone: 'player' | 'enemy' = 'enemy', o: { stay?: string; icon?: string; okIcon?: string; safeFirst?: boolean; icons?: string[] } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const opener = document.activeElement as HTMLElement | null;
    const done = (v: boolean) => { veil.remove(); opener?.focus?.({ preventScroll: true }); audio.chime(v ? 'tap' : 'boop'); resolve(v); };
    const stay = h('button', { type: 'button', class: 'pill big sun', 'data-dismiss': '', onclick: () => done(false) }, icon('no', 28), o.stay || 'No');
    const go = ok == null ? null : h('button', { type: 'button', class: 'pill big red', onclick: () => done(true) }, icon(o.okIcon || 'check', 28), ok);
    const veil = h('div', { class: 'veil' },
      h('section', { class: 'card ask', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        o.icon ? h('div', { class: 'ask-ic' }, icon(o.icon, 96)) : null,
        h('h2', { class: 'big-word' }, title),
        o.icons?.length ? h('div', { class: 'row center', style: { gap: '6px' } }, icon('toss', 36), ...o.icons.map((n) => icon(n, 40))) : null,
        h('div', { class: 'row center' }, stay, go)));
    document.body.append(veil);
    stay.focus({ preventScroll: true });
  });
}

/** A grown-up gate for what can't be undone (Stop, Toss, Bye): press and hold while it fills. A tap
 * does nothing, so a child's quick poke is safe. Works with a finger, a mouse, or held Enter/Space. */
export function holdButton(cls: string, ic: string, word: string, run: () => void, ms = 1400): HTMLButtonElement {
  let t0 = 0, raf = 0, done = false;
  const b = h('button', { type: 'button', class: `pill hold ${cls}`, 'aria-label': `${word} (hold)`, title: 'Hold' }, icon(ic, 28), word, h('span', { class: 'hold-ic', 'aria-hidden': 'true' }, icon('tick', 18))) as HTMLButtonElement;
  const set = (k: number) => b.style.setProperty('--k', String(k));
  const stop = () => { cancelAnimationFrame(raf); t0 = 0; if (!done) set(0); };
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    set(k);
    if (k >= 1) { done = true; audio.chime('pop'); run(); setTimeout(() => { done = false; set(0); }, 600); return; }
    raf = requestAnimationFrame(step);
  };
  const start = () => { if (t0 || done) return; t0 = performance.now(); audio.chime('tap'); raf = requestAnimationFrame(step); };
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); start(); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
  b.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); start(); } });
  b.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') stop(); });
  b.addEventListener('click', (e) => e.preventDefault());
  return b;
}
