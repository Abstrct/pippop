/* The Book: every symbol, and the two little stories the whole game is made of. Behind it, all the
 * toys ride a carousel in the sky. */
import * as THREE from 'three';
import { h } from '../core/dom';
import { icon } from '../ui/icons';
import { world, type Stage } from '../world/world';
import { makeToy, type ToyCtl } from '../world/toys';
import { P, plastic, geo, part, starGeo } from '../world/kit';
import { audio } from '../core/audio';
import { outLinks } from '../ui/links';
import { TOYS, isMatToy } from '../lore';
import { typeOf } from '../data/catalogue';
import type { Ctx, Screen } from './types';

function carousel(tapped: (id: string) => void): Stage {
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
  ids.forEach((id, i) => {
    const t = makeToy(id); const a = (i / ids.length) * Math.PI * 2;
    t.root.position.set(Math.cos(a) * 4.4, 1.2 + (i % 2) * 0.4, Math.sin(a) * 4.4);
    t.root.rotation.y = -a; t.root.scale.setScalar(0.75); t.root.userData.pick = String(id);
    ride.add(t.root); toys.push(t);
    const pole = part(geo.cyl(0.04, 0.04, 6.4, 6), plastic(P.sun), Math.cos(a) * 4.4, 3.2, Math.sin(a) * 4.4); ride.add(pole);
  });
  return {
    group, view: { pos: new THREE.Vector3(0, 6, 19), look: new THREE.Vector3(0, 3, 0), fitWidth: 13, fitHeight: 10 }, spin: true,
    tick(t, dt) { ride.rotation.y += dt * 0.25; toys.forEach((x, i) => { x.tick(t, dt); x.root.position.y = 1.4 + Math.sin(t * 1.6 + i * 1.3) * 0.5; }); },
    pickables: () => [ride],
    onPick: (id) => { if (id) { toys.find((x) => String(x.typeId) === id)?.squash(1); audio.chime('squeak'); tapped(id); } },
    dispose() { toys.forEach((x) => x.dispose()); },
  };
}

const PAGE_KEY = 'pippop.book.page';

export function book(_ctx: Ctx): Screen {
  const stage = carousel((id) => showToy(id));
  world.use(stage);
  const w = (ic: string, word: string, ...eq: string[]) => h('div', { class: 'wcard' }, icon(ic, 56), h('b', null, word), eq.length ? h('span', { class: 'eq' }, ...eq.map((e) => (e === '>' ? h('span', { class: 'small-word' }, '›') : icon(e, 22)))) : null);
  const flow = (...xs: string[]) => h('div', { class: 'flow', role: 'img', 'aria-label': xs.filter((x) => x !== '>').join(' then ') }, ...xs.map((x) => (x === '>' ? h('span', { class: 'arrow', 'aria-hidden': 'true' }, '›') : icon(x, 52))));
  const grid = (...kids: Node[]) => h('div', { class: 'words-grid' }, ...kids);
  const toyCards = Object.entries(TOYS).map(([id, t]) => { const c = w(t.icon, t.word, isMatToy(Number(id)) ? 'mat' : 'wagon'); c.dataset.toy = id; return c; });

  /* the pages: one at a time, each behind its own coloured tab */
  const pages: { ic: string; word: string; color: string; body: () => Node[] }[] = [
    { ic: 'star', word: 'Play', color: '#FFE08A', body: () => [
      flow('digger', '>', 'rock', '>', 'popper', '>', 'star'),
      flow('star', '>', 'fridge', '>', 'juice', '>', 'make'),
      flow('wagon', '>', 'roll', '>', 'bonk', 'bear', '>', 'grab', 'rock')] },
    { ic: 'kid', word: 'Things', color: '#9ED8F5', body: () => [grid(
      w('kid', 'Kid'), w('club', 'Club'), w('mat', 'Mat'), w('wagon', 'Wagon'), w('fridge', 'Fridge'), w('cup', 'Cup'), w('bear', 'Bear', ...Array.from({ length: typeOf(1)?.maxHealth ?? 6 }, () => 'heart')), w('gift', 'Make'))] },
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
  const more = h('span', { class: 'book-more', 'aria-hidden': 'true' }, icon('go', 30));
  const prev = h('button', { type: 'button', class: 'round book-turn', 'aria-label': 'Back', onclick: () => turn(at - 1) }, icon('back', 34));
  const next = h('button', { type: 'button', class: 'round book-turn', 'aria-label': 'Next', onclick: () => turn(at + 1) }, icon('go', 34));
  const body = h('div', { class: 'book-body' }, prev, h('div', { class: 'book-leaf' }, title, page, more), next);
  const el = h('div', { class: 'book', role: 'region', 'aria-label': 'Book' }, h('div', { class: 'book-tabs', role: 'tablist' }, ...tabs), body);

  function fill() {
    const pg = pages[at];
    title.replaceChildren(icon(pg.ic, 40), pg.word);
    page.replaceChildren(...pg.body());
    page.scrollTop = 0;
    el.style.setProperty('--c', pg.color);
    tabs.forEach((t, i) => t.setAttribute('aria-selected', String(i === at)));
    prev.disabled = at === 0; next.disabled = at === pages.length - 1;
    try { sessionStorage.setItem(PAGE_KEY, String(at)); } catch { /* fine */ }
    requestAnimationFrame(hint);
  }
  /** Turn to page i: the leaf flips over like a board book's. */
  function turn(i: number) {
    if (i < 0 || i >= pages.length || i === at) return;
    const dir = i > at ? 1 : -1;
    at = i;
    audio.chime('whoosh');
    const leaf = body.querySelector('.book-leaf') as HTMLElement;
    const out = leaf.animate([{ transform: 'none', opacity: 1 }, { transform: `perspective(900px) rotateY(${-dir * 75}deg)`, opacity: 0 }], { duration: 160, easing: 'ease-in' });
    out.onfinish = () => { fill(); leaf.animate([{ transform: `perspective(900px) rotateY(${dir * 75}deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.3,1.4,.6,1)' }); };
  }
  /** A bouncing arrow says there is more below, until the page has been scrolled to its end. */
  function hint() { more.classList.toggle('on', page.scrollHeight - page.clientHeight - page.scrollTop > 12); }
  page.addEventListener('scroll', hint, { passive: true });
  more.addEventListener('click', () => page.scrollBy({ top: page.clientHeight * 0.8, behavior: 'smooth' }));
  // swipe a page to turn it
  let sx = 0, sy = 0, st = 0;
  page.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; st = performance.now(); });
  page.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (performance.now() - st < 700 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(at + (dx < 0 ? 1 : -1));
  });
  el.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') turn(at + 1); else if (e.key === 'ArrowLeft') turn(at - 1); });

  /** A toy tapped on the carousel: open the Toys page at its card. */
  function showToy(id: string) {
    const toysAt = pages.findIndex((p) => p.word === 'Toys');
    if (at !== toysAt) { turn(toysAt); setTimeout(() => showToy(id), 480); return; }
    const c = page.querySelector<HTMLElement>(`[data-toy="${id}"]`);
    if (!c) return;
    c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse');
  }

  /** The carousel rides in the sky the book leaves open. */
  function frame() {
    if (!el.isConnected) return;
    const top = (document.querySelector('.top') as HTMLElement | null)?.getBoundingClientRect().bottom ?? 0;
    world.frameInset(top + 4, innerHeight - el.getBoundingClientRect().top + 8);
    hint();
  }
  window.addEventListener('resize', frame);
  fill();
  requestAnimationFrame(frame);
  return { el, title: 'Book', leave: () => { window.removeEventListener('resize', frame); world.frameInset(0, 0); } };
}
