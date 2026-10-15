/* The Book: every symbol, and the two little stories the whole game is made of. Behind it, all the
 * toys ride a carousel in the sky. */
import * as THREE from 'three';
import { h } from '../core/dom';
import { icon, hasIcon } from '../ui/icons';
import { world, type Stage } from '../world/world';
import { makeToy, type ToyCtl } from '../world/toys';
import { P, plastic, geo, part, starGeo } from '../world/kit';
import { audio } from '../core/audio';
import { outLinks } from '../ui/links';
import { TOYS, isMatToy } from '../lore';
import { typeOf } from '../data/catalogue';
import type { Ctx, Screen } from './types';

function carousel(tapped: (id: string) => void): Stage & { poke(id: string): void } {
  const group = new THREE.Group();
  const toys: ToyCtl[] = [];
  const top = new THREE.Group(); top.position.y = 6.4; group.add(top);
  top.add(part(geo.cone(5.4, 1.6, 12), plastic(P.red), 0, 0.8, 0));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; top.add(part(geo.ball(12), plastic(i % 2 ? P.sun : P.white, { glow: 0.4 }), Math.cos(a) * 5.3, 0, Math.sin(a) * 5.3, 0.2)); }
  top.add(part(starGeo(), plastic(P.sun, { glow: 0.3 }), 0, 2.0, 0, 1.2));
  group.add(part(geo.cyl(0.2, 0.2, 6.4, 12), plastic(P.white), 0, 3.2, 0));
  group.add(part(geo.cyl(5.6, 5.8, 0.4, 48), plastic(P.blue), 0, -0.2, 0));
  const ids = Object.keys(TOYS).map(Number);
  const ride = new THREE.Group(); group.add(ride);
  let held = false;   // while a finger or mouse is over the carousel it all but stops, so a toy can be caught
  ids.forEach((id, i) => {
    const t = makeToy(id); const a = (i / ids.length) * Math.PI * 2;
    t.root.position.set(Math.cos(a) * 4.4, 1.2 + (i % 2) * 0.4, Math.sin(a) * 4.4);
    t.root.rotation.y = -a; t.root.scale.setScalar(0.95); t.root.userData.pick = String(id);
    // a finger-sized ball around each toy (unseen) so a tap on a small, moving toy still lands on it
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.position.y = 0.5; t.root.add(hit);
    ride.add(t.root); toys.push(t);
    const pole = part(geo.cyl(0.04, 0.04, 6.4, 6), plastic(P.sun), Math.cos(a) * 4.4, 3.2, Math.sin(a) * 4.4); ride.add(pole);
  });
  return {
    group, view: { pos: new THREE.Vector3(0, 6, 19), look: new THREE.Vector3(0, 3.8, 0), fitWidth: 13, fitHeight: 12 }, spin: true,
    tick(t, dt) { ride.rotation.y += dt * (held ? 0.03 : 0.16); toys.forEach((x, i) => { x.tick(t, dt); x.root.position.y = 1.4 + Math.sin(t * 1.6 + i * 1.3) * 0.5; }); },
    pickables: () => [ride],
    onHover: (id) => { held = !!id; },
    onPick: (id) => { if (id) { toys.find((x) => String(x.typeId) === id)?.squash(1); audio.chime('squeak'); tapped(id); } },
    poke(id: string) { toys.find((x) => String(x.typeId) === id)?.squash(1.2); },
    dispose() { toys.forEach((x) => x.dispose()); },
  };
}

const PAGE_KEY = 'pippop.book.page';
const PICK_KEY = 'pippop.book.pick';

export function book(_ctx: Ctx): Screen {
  const stage = carousel((id) => showToy(id));
  world.use(stage);
  const bit = (e: string, size: number) => (e === '>' ? h('span', { class: 'small-word' }, '›') : hasIcon(e) ? icon(e, size) : h('span', { class: 'small-word' }, e));
  // a card answers a tap: it wiggles, squeaks and says its word (unless the sound is off)
  const w = (ic: string, word: string, ...eq: string[]) => h('button', { type: 'button', class: 'wcard', 'aria-label': word, onclick: (e: Event) => poke(e.currentTarget as HTMLElement, word) },
    icon(ic, 56), h('b', null, word), eq.length ? h('span', { class: 'eq' }, ...eq.map((e) => bit(e, 22))) : null);
  // a flow reads left to right; "a+b" is two symbols that go together (bonk the Bear, grab rocks)
  const flow = (...xs: string[]) => h('div', { class: 'flow', role: 'img', 'aria-label': xs.filter((x) => x !== '>').join(' then ').replace(/\+/g, ' ') },
    ...xs.map((x) => (x === '>' ? h('span', { class: 'arrow', 'aria-hidden': 'true' }, '›') : x.includes('+') ? h('span', { class: 'pair' }, ...x.split('+').map((y) => icon(y, 44))) : icon(x, 52))));
  const grid = (...kids: Node[]) => h('div', { class: 'words-grid' }, ...kids);
  const toyCards = Object.entries(TOYS).map(([id, t]) => { const c = w(t.icon, t.word, isMatToy(Number(id)) ? 'mat' : 'wagon'); c.dataset.toy = id; return c; });

  /* the pages: one at a time, each behind its own coloured tab */
  const pages: { ic: string; word: string; color: string; body: () => Node[] }[] = [
    { ic: 'star', word: 'Play', color: '#FFE08A', body: () => [
      flow('digger', '>', 'rock', '>', 'popper', '>', 'star'),
      flow('star', '>', 'fridge', '>', 'juice', '>', 'make'),
      flow('wagon', '>', 'roll', '>', 'bonk+bear', '>', 'grab+rock')] },
    { ic: 'kid', word: 'Things', color: '#9ED8F5', body: () => [grid(
      w('kid', 'Pet'), w('club', 'Club'), w('mat', 'Mat'), w('wagon', 'Wagon'), w('fridge', 'Fridge'), w('cup', 'Cup'), w('bear', 'Bear', 'heart', '×' + (typeOf(1)?.maxHealth ?? 6)), w('gift', 'Make'))] },
    { ic: 'rock', word: 'Stuff', color: '#FFC08A', body: () => [grid(
      w('star', 'Star', 'lock'), w('rock', 'Rock', 'grab'), w('juice', 'Juice', 'make'), w('wind', 'Wind', 'tick', '>', 'wind'), w('fort', 'Fort', 'grab', 'no'),
      w('heart', 'Heart'), w('tick', 'Tick'), w('key', 'Key'), w('words', 'Words', 'lock'), w('shake', 'Shake', 'tick', '>', 'check'))] },
    { ic: 'make', word: 'Do', color: '#A8E39A', body: () => [grid(
      w('make', 'Make'), w('dig', 'Dig', 'rock'), w('pop', 'Pop', 'rock', '>', 'star'), w('bonk', 'Bonk!'), w('roll', 'Roll', 'wagon'), w('home', 'Home'),
      w('grab', 'Grab', 'rock'), w('hide', 'Hide'), w('peek', 'Peek'), w('nap', 'Nap'), w('wake', 'Wake'), w('hug', 'Hug'), w('free', 'Free'),
      w('hop', 'Hop', 'bear'), w('feed', 'Feed', 'star', '>', 'juice'), w('toss', 'Toss'), w('find', 'Find', 'mat'), w('fill', 'Fill', 'star'), w('take', 'Take', 'star'))] },
    { ic: 'sky', word: 'Up', color: '#C9B5F0', body: () => [grid(w('moon', 'Moon'), w('cloud', 'Sky'), w('grass', 'Grass'), w('tub', 'Tub'))] },
    { ic: 'bear', word: 'Toys', color: '#FFB3C7', body: () => [grid(...toyCards), outLinks()] },
  ];
  let at = 0;
  try { at = Math.max(0, Math.min(pages.length - 1, Number(sessionStorage.getItem(PAGE_KEY)) || 0)); } catch { /* first page */ }

  const tabs = pages.map((pg, i) => h('button', { type: 'button', class: 'book-tab', role: 'tab', 'aria-label': pg.word, title: pg.word, style: { '--c': pg.color }, onclick: () => turn(i) }, icon(pg.ic, 32)));
  const title = h('h2', { class: 'book-title' });
  const page = h('div', { class: 'book-page', role: 'tabpanel', tabindex: '0' });
  const more = h('button', { type: 'button', class: 'round book-more', 'aria-label': 'More' }, icon('go', 30));
  const prev2 = h('button', { type: 'button', class: 'round book-turn2', 'aria-label': 'Back', onclick: () => turn(at - 1) }, icon('back', 30));
  const next2 = h('button', { type: 'button', class: 'round book-turn2', 'aria-label': 'Next', onclick: () => turn(at + 1) }, icon('go', 30));
  const prev = h('button', { type: 'button', class: 'round book-turn', 'aria-label': 'Back', onclick: () => turn(at - 1) }, icon('back', 34));
  const next = h('button', { type: 'button', class: 'round book-turn', 'aria-label': 'Next', onclick: () => turn(at + 1) }, icon('go', 34));
  const body = h('div', { class: 'book-body' }, prev, h('div', { class: 'book-leaf' }, title, page, h('div', { class: 'book-foot' }, prev2, more, next2)), next);
  const el = h('div', { class: 'book', role: 'region', 'aria-label': 'Book' }, h('div', { class: 'book-tabs', role: 'tablist' }, ...tabs), body);

  function fill() {
    const pg = pages[at];
    title.replaceChildren(icon(pg.ic, 40), pg.word);
    page.replaceChildren(...pg.body());
    let picked = ''; try { picked = sessionStorage.getItem(PICK_KEY) || ''; } catch { /* none */ }
    if (picked) page.querySelector(`[data-toy="${picked}"]`)?.classList.add('picked');
    page.scrollTop = 0;
    el.style.setProperty('--c', pg.color);
    tabs.forEach((t, i) => t.setAttribute('aria-selected', String(i === at)));
    prev.disabled = prev2.disabled = at === 0; next.disabled = next2.disabled = at === pages.length - 1;
    try { sessionStorage.setItem(PAGE_KEY, String(at)); } catch { /* fine */ }
    requestAnimationFrame(hint);
  }
  /** Turn to page i: the leaf flips over like a board book's. */
  function turn(i: number) {
    if (i === at) { page.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (i < 0 || i >= pages.length) return;
    const dir = i > at ? 1 : -1;
    at = i;
    audio.chime('whoosh');
    const leaf = body.querySelector('.book-leaf') as HTMLElement;
    const out = leaf.animate([{ transform: 'none', opacity: 1 }, { transform: `perspective(900px) rotateY(${-dir * 75}deg)`, opacity: 0 }], { duration: 160, easing: 'ease-in' });
    out.onfinish = () => { fill(); leaf.animate([{ transform: `perspective(900px) rotateY(${dir * 75}deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.3,1.4,.6,1)' }); };
  }
  /** Under a long page, a bouncing arrow: down while there is more, up (back to the top) at the end. */
  function hint() {
    const long = page.scrollHeight - page.clientHeight > 12;
    const end = page.scrollHeight - page.clientHeight - page.scrollTop <= 12;
    more.classList.toggle('on', long); more.classList.toggle('up', long && end);
    more.setAttribute('aria-label', end ? 'Top' : 'More');
  }
  page.addEventListener('scroll', hint, { passive: true });
  // a wheel anywhere on the book (its title, its edges, its footer) scrolls the page
  el.addEventListener('wheel', (e) => { if (page.contains(e.target as Node)) return; e.preventDefault(); page.scrollBy({ top: e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? page.clientHeight : 1) }); }, { passive: false });   // Firefox counts a wheel in lines
  more.addEventListener('click', () => { if (more.classList.contains('up')) page.scrollTo({ top: 0, behavior: 'smooth' }); else page.scrollBy({ top: page.clientHeight * 0.8, behavior: 'smooth' }); });
  // swipe a page to turn it
  let sx = 0, sy = 0, st = 0;
  let lx = 0, ly = 0;
  const swiped = () => {
    const dx = lx - sx, dy = ly - sy;
    if (st && performance.now() - st < 900 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(at + (dx < 0 ? 1 : -1));
    st = 0;
  };
  body.addEventListener('pointerdown', (e) => { sx = lx = e.clientX; sy = ly = e.clientY; st = performance.now(); });
  // the finger can lift anywhere (off the book, off the screen); a touch the browser takes over
  // (it tried to pan) still counts by how far it went
  const mv = (e: PointerEvent) => { if (st) { lx = e.clientX; ly = e.clientY; } };
  const up = (e: PointerEvent) => { if (!st) return; if (e.type === 'pointerup') { lx = e.clientX; ly = e.clientY; } swiped(); };
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  // ← → turn pages from anywhere in the room (not while typing); focus follows to the new tab
  const keys = (e: KeyboardEvent) => {
    if (document.querySelector('.veil') || (e.target as HTMLElement | null)?.closest?.('input, textarea')) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const was = at; turn(at + (e.key === 'ArrowRight' ? 1 : -1));
    if (at !== was && el.contains(document.activeElement) && document.activeElement?.classList.contains('book-tab')) tabs[at].focus({ preventScroll: true });
    e.preventDefault();
  };
  window.addEventListener('keydown', keys);

  /** A card's tap: it wiggles and squeaks, and the Book says its word out loud. */
  function poke(c: HTMLElement, word: string) {
    c.classList.remove('wiggle-once'); void c.offsetWidth; c.classList.add('wiggle-once');
    audio.chime('squeak');
    if (c.dataset.toy) stage.poke(c.dataset.toy);
    if (audio.quiet || !('speechSynthesis' in window)) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(word.replace(/!$/, '')); u.rate = 0.85; u.pitch = 1.3; speechSynthesis.speak(u); } catch { /* no voice */ }
  }

  /** A toy tapped on the carousel: open the Toys page at its card. */
  function showToy(id: string) {
    const toysAt = pages.findIndex((p) => p.word === 'Toys');
    if (at !== toysAt) { turn(toysAt); setTimeout(() => showToy(id), 480); return; }
    const c = page.querySelector<HTMLElement>(`[data-toy="${id}"]`);
    if (!c) return;
    c.scrollIntoView({ block: 'center', behavior: 'smooth' });
    page.querySelectorAll('.wcard.picked').forEach((x) => x !== c && x.classList.remove('picked', 'pulse'));
    c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('picked', 'pulse');
    try { sessionStorage.setItem(PICK_KEY, id); } catch { /* fine */ }
  }

  /** The carousel rides in the sky the book leaves open. */
  function frame() {
    if (!el.isConnected) return;
    const top = (document.querySelector('.top') as HTMLElement | null)?.getBoundingClientRect().bottom ?? 0;
    world.frameInset(top + 4, innerHeight - el.getBoundingClientRect().top + 8);
    hint();
  }
  window.addEventListener('resize', frame);
  // the top bar and the book can still be settling just after a reload: keep the frame honest
  const reframe = window.setInterval(frame, 700);
  fill();
  queueMicrotask(frame);
  requestAnimationFrame(frame);
  return { el, title: 'Book', leave: () => { window.removeEventListener('resize', frame); window.removeEventListener('keydown', keys); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); clearInterval(reframe); world.frameInset(0, 0); try { speechSynthesis.cancel(); } catch { /* none */ } } };
}
