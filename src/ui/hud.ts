/* The parts of the toy that never leave: the awning, your kid chip, the counters (stars, rocks,
 * juice, wind), the round dock buttons, the tray of shakes and rites in flight, and the big shout. */
import { h, clear } from '../core/dom';
import { icon } from './icons';
import { empire } from '../game/empire';
import { wallet } from '../wallet/wallet';
import { txq } from '../wallet/queue';
import { pow, type PowTask } from '../pow/pow';
import { live } from '../chain/live';
import { audio } from '../core/audio';
import { fmtStars, fmtJuice, fmtWait, juice, kidName, short, toy, verbOf, clubColor, oops } from '../lore';
import { typeOf } from '../data/catalogue';
import { openMe } from './me';

const DOCK: [string, string, string, string][] = [
  ['#/', 'Mat', 'mat', 'd-mat'], ['#/toys', 'Toys', 'make', 'd-toys'], ['#/sky', 'Sky', 'sky', 'd-sky'],
  ['#/bonk', 'Bonk', 'bonk', 'd-bonk'], ['#/fridge', 'Fridge', 'fridge', 'd-fridge'], ['#/book', 'Book', 'book', 'd-book'],
];

export function mountHud(root: HTMLElement) {
  /* top */
  const kid = h('button', { type: 'button', class: 'kid-chip', 'aria-label': 'Me', onclick: () => openMe() });
  const meters = h('div', { class: 'meters', role: 'group', 'aria-label': 'Stuff' });
  const sound = h('button', { type: 'button', class: 'meter', 'aria-label': 'Sound', onclick: () => { audio.toggle(); paintSound(); } });
  const top = h('header', { class: 'top' },
    h('div', { class: 'top-l' }, h('a', { class: 'awning', href: '#/', 'aria-label': 'Pip Pop' }, 'Pip Pop'), kid),
    h('div', { class: 'row', style: { gap: '8px', alignItems: 'flex-start', flexWrap: 'nowrap' } }, meters, sound));
  /* dock */
  const dock = h('nav', { class: 'dock', 'aria-label': 'Rooms' });
  const links = DOCK.map(([href, word, ic, cls]) => h('a', { href, class: cls, 'aria-label': word }, icon(ic, 38), h('span', null, word)));
  dock.append(...links);
  /* busy tray */
  const busy = h('div', { class: 'busy', 'aria-label': 'Busy', role: 'status' });
  root.append(top, dock, busy);

  function paintSound() { clear(sound); sound.append(icon(audio.quiet ? 'mute' : 'sound', 30)); }
  paintSound();

  function paintTop() {
    clear(kid); clear(meters);
    const p = empire.commander;
    const a = wallet.active;
    const face = h('span', { class: 'face', style: { borderColor: p ? clubColor(p.guildId) : '#E4002B' } }, icon(p ? 'kid' : wallet.state === 'locked' ? 'lock' : 'gift', 28));
    // words never kept: a little red dot on the kid chip, until they are
    kid.classList.toggle('remind', !!p && wallet.unlocked && !wallet.backedUp);
    kid.append(face, h('span', { class: 'nm' }, p ? kidName(p) : a?.label && a.label !== 'Commander' && a.label !== 'Warden' ? a.label : wallet.state === 'locked' ? 'Key' : 'Hi!'));
    if (!p) return;
    const spare = p.capacity + p.connectionCapacity - p.load - p.structsLoad;
    const wind = empire.charge(p);
    const m = (ic: string, label: string, val: string | Node, bad = false, sub?: string) => h('span', { class: 'meter' + (bad ? ' bad' : ''), role: 'img', 'aria-label': `${label} ${typeof val === 'string' ? val : ''}` }, icon(ic, 36), val, sub ? h('span', { class: 'sub' }, sub) : null);
    const pips = h('span', { class: 'pips' }, ...Array.from({ length: 8 }, (_, i) => h('i', { class: i < Math.min(8, wind) ? (wind >= 8 ? 'on full' : 'on') : '' })));
    meters.append(
      m('star', 'Stars', fmtStars(p.alpha)),
      m('rock', 'Rocks', String(p.ore), p.ore > 0),
      m('juice', 'Juice', fmtJuice(spare > 0n ? spare : 0n), !p.online || spare < 0n, '/' + fmtJuice(p.capacity + p.connectionCapacity)),
      h('span', { class: 'meter', role: 'img', 'aria-label': `Wind ${wind}`, title: 'Wind' }, icon('wind', 36), pips, h('span', null, short(wind))),
    );
    void juice;
  }

  function paintDock() {
    const route = (location.hash || '#/').replace(/^#\/?/, '').split('/')[0];
    links.forEach((l, i) => {
      const want = DOCK[i][0].replace(/^#\/?/, '');
      const on = want === route || (want === '' && route === 'mat');
      l.classList.toggle('on', on);
      if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
    });
  }

  /* the busy tray: every shake (proof of work) with its progress ring, and every rite in flight */
  const KIND_ICON: Record<PowTask['kind'], string> = { build: 'make', mine: 'dig', refine: 'pop', raid: 'grab' };
  function ring(pct: number) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 42 42'); svg.classList.add('ring');
    const c = (cls: string) => { const x = document.createElementNS(NS, 'circle'); x.setAttribute('cx', '21'); x.setAttribute('cy', '21'); x.setAttribute('r', '17'); x.setAttribute('fill', 'none'); x.setAttribute('stroke-width', '6'); x.setAttribute('class', cls); return x; };
    const bg = c('bg'), fg = c('fg');
    const L = 2 * Math.PI * 17;
    fg.setAttribute('stroke-dasharray', String(L)); fg.setAttribute('stroke-dashoffset', String(L * (1 - Math.max(0.04, Math.min(1, pct)))));
    fg.setAttribute('stroke-linecap', 'round'); fg.setAttribute('transform', 'rotate(-90 21 21)');
    svg.append(bg, fg);
    return svg;
  }
  function toyOfTask(t: PowTask): number {
    for (const pl of empire.players.values()) { const s = pl.structs.get(t.objectId); if (s) return s.typeId; }
    return 0;
  }
  function paintBusy() {
    clear(busy);
    const mine = new Set(wallet.playerIds());
    const tasks = pow.active.filter((t) => t.account >= 0 && mine.has(t.playerId));
    for (const t of tasks.slice(0, 5)) {
      const e = pow.eta(t);
      const tId = toyOfTask(t);
      busy.append(h('div', { class: 'chip' + (t.waits ? ' wait' : ''), role: 'img', 'aria-label': `${verbWord(t.kind)} ${tId ? toy(tId).word : ''} ${fmtWait(e.secs)}` },
        ring(e.frac),
        h('span', { class: 'shaker' }, icon('shake', 28)),
        icon(KIND_ICON[t.kind], 28), tId ? icon(toy(tId).icon, 28) : null,
        t.waits ? icon('bear', 24) : h('span', { class: 'eta' }, fmtWait(e.secs))));
    }
    const jobs = txq.active.filter((j) => j.source !== 'pow' && (!j.playerId || mine.has(j.playerId)));
    for (const j of jobs.slice(0, 4)) {
      const m = j.msgs[0];
      const v = verbOf(m?.typeUrl || '');
      const val = (m?.value || {}) as Record<string, unknown>;
      const tId = Number(val.structTypeId) || (() => { const sid = String(val.structId || val.operatingStructId || val.defenderStructId || ''); for (const pl of empire.players.values()) { const s = pl.structs.get(sid); if (s) return s.typeId; } return 0; })();
      const waitWhy = j.status === 'waiting' && j.waitReason ? oops(j.waitReason) : null;
      busy.append(h('div', { class: 'chip' + (waitWhy ? ' wait' : ''), role: 'img', 'aria-label': v.w },
        h('span', { class: 'ring', style: { display: 'grid', placeItems: 'center' } }, h('span', { class: j.status === 'pending' || j.status === 'signing' ? 'spin' : '' }, icon(waitWhy ? waitWhy.i : 'tick', 30))),
        icon(v.i, 28), tId && typeOf(tId) ? icon(toy(tId).icon, 28) : null,
        h('span', null, v.w)));
    }
  }
  const verbWord = (k: PowTask['kind']) => ({ build: 'Make', mine: 'Dig', refine: 'Pop', raid: 'Grab' })[k];

  const offs = [empire.onChange(paintTop), wallet.onChange(paintTop), live.onBlock(() => { paintTop(); paintBusy(); }), pow.onChange(paintBusy), txq.onChange(paintBusy)];
  window.addEventListener('hashchange', paintDock);
  paintTop(); paintDock(); paintBusy();
  return { lift(on: boolean) { busy.classList.toggle('lifted', on); }, dispose: () => offs.forEach((f) => f()) };
}

/* ── the big shout ── */
const queue: [string, string, 'yay' | 'uh'][] = [];
let showing = false;
/** A huge bouncy word across the whole sky, with a symbol and a shower of paper confetti. */
export function shout(word: string, ic: string, tone: 'yay' | 'uh' = 'yay') {
  queue.push([word, ic, tone]);
  if (!showing) next();
}
function next() {
  const s = queue.shift();
  if (!s) { showing = false; return; }
  showing = true;
  const [word, ic, tone] = s;
  const el = h('div', { class: `shout ${tone}`, role: 'status', 'aria-live': 'assertive' }, h('div', { class: 'shout-in' }, icon(ic, 140), h('div', { class: 'shout-word' }, word)));
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('on'));
  audio.chime(tone === 'yay' ? 'open' : 'grab');
  if (tone === 'yay') paperConfetti();
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => { el.remove(); next(); }, 500); }, 2300);
}
function paperConfetti() {
  const cols = ['#E4002B', '#FFC72C', '#0077C8', '#43B02A', '#FF8F1C', '#8246AF', '#FF8FB1'];
  for (let i = 0; i < 70; i++) {
    const c = h('i', { class: 'confetto', style: { left: '50vw', top: '45vh', background: cols[i % cols.length] } });
    document.body.append(c);
    const a = Math.random() * Math.PI * 2, d = 200 + Math.random() * 380;
    const dx = Math.cos(a) * d, dy = Math.sin(a) * d * 0.6 - 120;
    c.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 720}deg)`, offset: 0.5 }, { transform: `translate(${dx * 1.2}px, ${dy + 500}px) rotate(${Math.random() * 1440}deg)`, opacity: 0 }], { duration: 1800 + Math.random() * 800, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => c.remove();
  }
}
