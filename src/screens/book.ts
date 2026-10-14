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

function carousel(): Stage {
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
    group, view: { pos: new THREE.Vector3(0, 6, 19), look: new THREE.Vector3(0, 3, 0) }, spin: true,
    tick(t, dt) { ride.rotation.y += dt * 0.25; toys.forEach((x, i) => { x.tick(t, dt); x.root.position.y = 1.4 + Math.sin(t * 1.6 + i * 1.3) * 0.5; }); },
    pickables: () => [ride],
    onPick: (id) => { if (id) { toys.find((x) => String(x.typeId) === id)?.squash(1); audio.chime('squeak'); } },
    dispose() { toys.forEach((x) => x.dispose()); },
  };
}

export function book(_ctx: Ctx): Screen {
  world.use(carousel());
  const w = (ic: string, word: string, ...eq: string[]) => h('div', { class: 'wcard' }, icon(ic, 56), h('b', null, word), eq.length ? h('span', { class: 'eq' }, ...eq.map((e) => (e === '>' ? h('span', { class: 'small-word' }, '›') : icon(e, 22)))) : null);
  const flow = (...xs: string[]) => h('div', { class: 'flow', role: 'img', 'aria-label': xs.filter((x) => x !== '>').join(' then ') }, ...xs.map((x) => (x === '>' ? h('span', { class: 'arrow', 'aria-hidden': 'true' }, '›') : icon(x, 52))));
  const sec = (ic: string, title: string, ...kids: Node[]) => h('section', { class: 'book-sec' }, h('h2', null, icon(ic, 40), title), ...kids);
  const toyCards = Object.entries(TOYS).map(([id, t]) => w(t.icon, t.word, isMatToy(Number(id)) ? 'mat' : 'wagon'));
  const el = h('div', { class: 'book' }, h('div', { class: 'book-in' },
    sec('star', 'Play',
      flow('digger', '>', 'rock', '>', 'popper', '>', 'star'),
      flow('star', '>', 'fridge', '>', 'juice', '>', 'make'),
      flow('wagon', '>', 'roll', '>', 'bonk', 'bear', '>', 'grab', 'rock')),
    sec('kid', 'Things', h('div', { class: 'words-grid' },
      w('kid', 'Kid'), w('club', 'Club'), w('mat', 'Mat'), w('wagon', 'Wagon'), w('fridge', 'Fridge'), w('cup', 'Cup'), w('bear', 'Bear', ...Array.from({ length: typeOf(1)?.maxHealth ?? 6 }, () => 'heart')), w('gift', 'Make'))),
    sec('rock', 'Stuff', h('div', { class: 'words-grid' },
      w('star', 'Star', 'lock'), w('rock', 'Rock', 'grab'), w('juice', 'Juice', 'make'), w('wind', 'Wind', 'tick', '>', 'wind'), w('fort', 'Fort', 'grab', 'no'),
      w('heart', 'Heart'), w('tick', 'Tick'), w('key', 'Key'), w('words', 'Words', 'lock'), w('shake', 'Shake', 'tick', '>', 'check'))),
    sec('make', 'Do', h('div', { class: 'words-grid' },
      w('make', 'Make'), w('dig', 'Dig', 'rock'), w('pop', 'Pop', 'rock', '>', 'star'), w('bonk', 'Bonk!'), w('roll', 'Roll', 'wagon'), w('home', 'Home'),
      w('grab', 'Grab', 'rock'), w('hide', 'Hide'), w('peek', 'Peek'), w('nap', 'Nap'), w('wake', 'Wake'), w('hug', 'Hug'), w('free', 'Free'),
      w('hop', 'Hop', 'bear'), w('feed', 'Feed', 'star', '>', 'juice'), w('toss', 'Toss'), w('find', 'Find', 'mat'), w('fill', 'Fill', 'star'), w('take', 'Take', 'star'))),
    sec('sky', 'Up', h('div', { class: 'words-grid' }, w('moon', 'Moon'), w('cloud', 'Sky'), w('grass', 'Grass'), w('tub', 'Tub'))),
    sec('make', 'Toys', h('div', { class: 'words-grid' }, ...toyCards)),
    outLinks()));
  return { el, title: 'Book', leave: () => {} };
}
