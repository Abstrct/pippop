/* The other rooms of the toy box: the Fridge (every club's juice jar), the Shelf (every toy you can
 * make, in its cubby) and the Hello box (a present that opens). */
import * as THREE from 'three';
import type { Stage } from './world';
import { P, plastic, felt, glass, geo, part, starGeo, wordSprite, confetti, tween, ease } from './kit';
import { makeToy, type ToyCtl } from './toys';

/* ── the Fridge ── */
export interface Jar { id: string; color: string; fill: number; ours: boolean; mine: boolean; label: string }
export interface FridgeStage extends Stage { set(jars: Jar[], cup: number): void; select(id: string | null): void; pour(id: string, out?: boolean): void }

export function fridgeStage(on: { pick: (id: string | null) => void }): FridgeStage {
  const group = new THREE.Group();
  const W = 7.2, H = 8.4, D = 3.2;
  const fridge = new THREE.Group(); group.add(fridge);
  // the box (open at the front), with feet
  fridge.add(part(geo.box(W, 0.3, D, 0.12), plastic(P.white), 0, 0.15, 0));
  fridge.add(part(geo.box(W, 0.3, D, 0.12), plastic(P.white), 0, H - 0.15, 0));
  for (const s of [-1, 1]) fridge.add(part(geo.box(0.3, H, D, 0.12), plastic(P.white), s * (W / 2 - 0.15), H / 2, 0));
  fridge.add(part(geo.box(W, H, 0.2, 0.1), plastic(0x8FD3F2), 0, H / 2, -D / 2 + 0.1));
  for (const x of [-2.8, 2.8]) fridge.add(part(geo.cyl(0.25, 0.3, 0.3, 14), plastic(P.ink), x, -0.1, 0.8));
  const shelves = [1.6, 3.9, 6.2];
  for (const y of shelves) fridge.add(part(geo.box(W - 0.6, 0.08, D - 0.4, 0.03), glass(0xD8F1FF, 0.6), 0, y - 0.04, 0));
  // a cold blue glow inside
  const glow = new THREE.PointLight(0xbfe6ff, 6, 12, 1.6); glow.position.set(0, H - 1, 0.6); fridge.add(glow);
  // the door: swings open when you arrive
  const hinge = new THREE.Group(); hinge.position.set(-W / 2, 0, D / 2); fridge.add(hinge);
  const door = part(geo.box(W, H, 0.4, 0.25), plastic(P.white), W / 2, H / 2, 0.2); hinge.add(door);
  hinge.add(part(geo.box(0.22, 2.2, 0.22, 0.1), plastic(P.sun), W - 0.6, H / 2 + 0.4, 0.5));
  // fridge magnets on the door
  [[P.red, 1.2, 6.5], [P.blue, 2.6, 5.4], [P.leaf, 4.4, 6.8], [P.plum, 5.6, 2.2]].forEach(([c, x, y], i) => {
    const m = i % 2 ? part(starGeo(), plastic(c), x, y, 0.45, 0.45) : part(geo.ball(16), plastic(c), x, y, 0.42, 0.28, 0.28, 0.12); hinge.add(m);
  });
  tween(1.4, (k) => { hinge.rotation.y = -k * 1.95; }, { ease: ease.inOut, delay: 0.5 });

  const jarRoot = new THREE.Group(); group.add(jarRoot);
  const jars = new Map<string, { g: THREE.Group; juice: THREE.Mesh; j: Jar; tag?: THREE.Sprite }>();
  let sel: string | null = null;
  // my cup: a sippy cup on the floor in front
  const cup = new THREE.Group(); cup.position.set(4.9, 0, 3.0); group.add(cup);
  cup.add(part(geo.cyl(0.55, 0.45, 1.3, 28), glass(0xffffff, 0.35), 0, 0.65, 0));
  const cupJuice = part(geo.cyl(0.5, 0.42, 1, 28), plastic(P.peach, { glow: 0.15 }), 0, 0.05, 0); cupJuice.scale.y = 0.01; cup.add(cupJuice);
  cup.add(part(geo.cyl(0.6, 0.6, 0.22, 28), plastic(P.sky), 0, 1.35, 0));
  cup.add(part(geo.cyl(0.12, 0.18, 0.4, 14), plastic(P.sky), 0, 1.6, 0.2));
  for (const s of [-1, 1]) { const hd = part(geo.ring(0.3, 0.07, 16), plastic(P.sun), s * 0.62, 0.8, 0); hd.rotation.y = Math.PI / 2; cup.add(hd); }
  const cupTag = wordSprite('Me', { bg: '#FFC72C', size: 0.5 }); cupTag.position.set(0, 2.2, 0); cup.add(cupTag);

  function jarMesh(j: Jar) {
    const g = new THREE.Group();
    g.add(part(geo.cyl(0.5, 0.5, 1.5, 28), glass(0xffffff, 0.3), 0, 0.75, 0));
    const juice = part(geo.cyl(0.45, 0.45, 1, 28), plastic(new THREE.Color(j.color).getHex(), { glow: 0.12 }), 0, 0, 0);
    g.add(juice);
    g.add(part(geo.cyl(0.55, 0.55, 0.22, 28), plastic(j.ours ? P.sun : P.white), 0, 1.6, 0));
    if (j.ours) g.add(part(starGeo(), plastic(P.sun, { glow: 0.3 }), 0, 0.85, 0.52, 0.42));
    g.userData.pick = j.id;
    return { g, juice };
  }

  const stage: FridgeStage = {
    group,
    view: { pos: new THREE.Vector3(1.6, 5.2, 19.5), look: new THREE.Vector3(0.8, 4.1, 0), fitWidth: 13 },
    spin: false,
    tick(t) {
      for (const { g, juice, j } of jars.values()) {
        const want = Math.max(0.03, Math.min(1, j.fill)) * 1.4;
        juice.scale.y += (want - juice.scale.y) * 0.08; juice.position.y = juice.scale.y / 2 + 0.03;
        g.position.y = (g.userData.y as number) + (sel === j.id ? 0.25 + Math.sin(t * 3) * 0.06 : 0);
        g.rotation.y = sel === j.id ? Math.sin(t * 2) * 0.3 : 0;
      }
      cupJuice.position.y = cupJuice.scale.y / 2 + 0.06;
      cup.rotation.y = Math.sin(t * 0.8) * 0.2;
      glow.intensity = 5 + Math.sin(t * 2) * 0.6;
    },
    pickables: () => [jarRoot],
    onPick: (id) => on.pick(id),
    set(list, cupFill) {
      const keep = new Set(list.map((j) => j.id));
      for (const [id, x] of jars) if (!keep.has(id)) { jarRoot.remove(x.g); jars.delete(id); }
      list.slice(0, 15).forEach((j, i) => {
        let x = jars.get(j.id);
        if (!x) { const m = jarMesh(j); x = { ...m, j }; jars.set(j.id, x); jarRoot.add(m.g); }
        x.j = j;
        // a few jars sit centred on the middle shelf; more fill the shelves from the top
        const n = Math.min(15, list.length);
        const row = n <= 5 ? 1 : Math.floor(i / 5), col = i % 5;
        const inRow = n <= 5 ? n : Math.min(5, n - Math.floor(i / 5) * 5);
        const y = n <= 5 ? shelves[1] : (shelves[2 - row] ?? 0.3);
        x.g.position.set((col - (inRow - 1) / 2) * 1.3, y, 0.2);
        x.g.userData.y = y;
        if (x.tag) { x.g.remove(x.tag); x.tag.material.map?.dispose(); }
        x.tag = wordSprite(j.label, { bg: '#FFFFFF', size: 0.3 }); x.tag.position.set(0, 2.0, 0.2); x.g.add(x.tag);
      });
      cupJuice.scale.y = Math.max(0.02, Math.min(1, cupFill)) * 1.15;
    },
    select(id) { sel = id; },
    pour(id, out = false) {
      const x = jars.get(id); if (!x) return;
      const p = x.g.position.clone().add(new THREE.Vector3(0, 2.2, 0.3));
      if (out) confetti(group, p, { n: 30, power: 2.4, stars: true });
      else for (let i = 0; i < 10; i++) {
        const s = part(starGeo(), plastic(P.sun, { glow: 0.5 }), p.x, p.y + 3, p.z, 0.25);
        group.add(s);
        tween(0.9, (k) => { s.position.y = p.y + 3 - k * 3; s.rotation.y = k * 8; }, { delay: i * 0.08, ease: ease.inOut, done: () => group.remove(s) });
      }
    },
    dispose() { glow.dispose(); },
  };
  return stage;
}

/* ── the Shelf ── */
export interface ShelfItem { type: number; can: boolean }
export interface ShelfStage extends Stage { set(items: ShelfItem[]): void; select(type: number | null): void }

export function shelfStage(on: { pick: (type: number | null) => void; hover?: (type: number | null) => void }): ShelfStage {
  const group = new THREE.Group();
  const COLS = 6, ROWS = 4, CW = 2.1, CH = 2.0, D = 1.8;
  const W = COLS * CW, H = ROWS * CH;
  const wood = plastic(0xF4B860, { rough: 0.6 });
  const shelf = new THREE.Group(); shelf.position.y = 0.2; group.add(shelf);
  shelf.add(part(geo.box(W + 0.4, H + 0.4, 0.2, 0.08), plastic(0xFFE3A6, { rough: 0.7 }), 0, H / 2, -D / 2));
  for (let r = 0; r <= ROWS; r++) shelf.add(part(geo.box(W + 0.4, 0.2, D, 0.08), wood, 0, r * CH, 0));
  for (let c = 0; c <= COLS; c++) shelf.add(part(geo.box(0.2, H, D, 0.08), wood, -W / 2 + c * CW, H / 2, 0));
  // little coloured cubby backs
  const backs = [0x41B6E6, 0xFF8FB1, 0x7FD35B, 0xFFC72C, 0xB58BDB, 0xFF8F1C];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) shelf.add(part(geo.box(CW - 0.24, CH - 0.24, 0.05, 0.02), felt(backs[(r + c) % backs.length]), -W / 2 + c * CW + CW / 2, r * CH + CH / 2, -D / 2 + 0.14));
  const toys = new Map<number, { ctl: ToyCtl; home: THREE.Vector3; can: boolean; lock?: THREE.Object3D }>();
  const root = new THREE.Group(); shelf.add(root);
  let sel: number | null = null;
  const front = new THREE.Vector3(0, 2.4, 3.6);

  const stage: ShelfStage = {
    group,
    view: { pos: new THREE.Vector3(0, 4.6, 16), look: new THREE.Vector3(0, 4.4, 0), fitWidth: 14, fitHeight: 9.2 },
    spin: false,
    tick(t, dt) {
      for (const [type, x] of toys) {
        x.ctl.tick(t, dt);
        const goal = sel === type ? front : x.home;
        x.ctl.root.position.lerp(goal, 1 - Math.exp(-6 * dt));
        const s = sel === type ? 2.1 : 0.9;
        const cur = x.ctl.root.scale.x; x.ctl.root.scale.setScalar(cur + (s - cur) * (1 - Math.exp(-6 * dt)));
        x.ctl.root.rotation.y = sel === type ? t * 0.8 : Math.sin(t * 0.6 + type) * 0.25;
      }
    },
    pickables: () => [root],
    onPick: (id) => on.pick(id == null ? null : Number(id)),
    onHover: (id) => on.hover?.(id == null ? null : Number(id)),
    set(items) {
      items.forEach((it, i) => {
        let x = toys.get(it.type);
        const r = ROWS - 1 - Math.floor(i / COLS), c = i % COLS;
        const home = new THREE.Vector3(-W / 2 + c * CW + CW / 2, r * CH + 0.12, 0.1);
        if (!x) {
          const ctl = makeToy(it.type); ctl.root.userData.pick = it.type;
          // tall toys sit smaller so they fit their cubby
          const fit = Math.min(1, 1.45 / ctl.height);
          ctl.body.scale.setScalar(fit);
          ctl.root.position.copy(home); ctl.root.scale.setScalar(0.9);
          root.add(ctl.root);
          x = { ctl, home, can: it.can };
          toys.set(it.type, x);
        }
        x.home = home;
        if (x.can !== it.can || (!it.can && !x.lock) || (it.can && x.lock)) {
          if (x.lock) { root.remove(x.lock); x.lock = undefined; }
          if (!it.can) {
            const lk = new THREE.Group();
            lk.add(part(geo.box(0.36, 0.3, 0.14, 0.05), plastic(P.sun), 0, 0, 0));
            const sh = part(geo.ring(0.12, 0.04, 16, ), plastic(P.ink), 0, 0.2, 0); lk.add(sh);
            lk.position.copy(home).add(new THREE.Vector3(0.7, 1.45, 0.6));
            root.add(lk); x.lock = lk;
          }
          x.can = it.can;
        }
      });
    },
    select(type) { sel = type; if (type != null) toys.get(type)?.ctl.squash(0.7); },
    dispose() { for (const { ctl } of toys.values()) ctl.dispose(); },
  };
  return stage;
}

/* ── the Hello box: a present that opens ── */
export interface HelloStage extends Stage { open(): void; wiggle(): void }
export function helloStage(on: { pick: () => void }): HelloStage {
  const group = new THREE.Group();
  // a little mat to stand on
  group.add(part(geo.cyl(3.4, 3.5, 0.5, 64), plastic(P.red), 0, -0.25, 0));
  const rim = part(geo.ring(3.4, 0.18, 80), plastic(P.sun), 0, 0, 0); rim.rotation.x = Math.PI / 2; group.add(rim);
  group.add(part(geo.cyl(3.25, 3.25, 0.06, 64), felt(0x55C23A), 0, 0.0, 0));
  const box = new THREE.Group(); box.userData.pick = 'box'; group.add(box);
  box.add(part(geo.box(2.4, 2.0, 2.4, 0.16), plastic(P.blue), 0, 1.0, 0));
  box.add(part(geo.box(0.42, 2.04, 2.44, 0.06), plastic(P.sun), 0, 1.0, 0));
  box.add(part(geo.box(2.44, 2.04, 0.42, 0.06), plastic(P.sun), 0, 1.0, 0));
  for (let i = 0; i < 9; i++) { const a = i * 0.7; box.add(part(starGeo(), plastic([P.white, P.pink, P.leaf][i % 3]), Math.cos(a) * 1.21 * (i % 2 ? 1 : -1), 0.4 + (i % 3) * 0.6, Math.sin(a) * 0.9, 0.22).rotateY(i)); }
  const lid = new THREE.Group(); lid.position.y = 2.0; box.add(lid);
  lid.add(part(geo.box(2.6, 0.5, 2.6, 0.16), plastic(P.blue), 0, 0.25, 0));
  lid.add(part(geo.box(0.44, 0.54, 2.64, 0.06), plastic(P.sun), 0, 0.25, 0));
  lid.add(part(geo.box(2.64, 0.54, 0.44, 0.06), plastic(P.sun), 0, 0.25, 0));
  for (const s of [-1, 1]) { const b = part(geo.ring(0.42, 0.14, 20), plastic(P.sun), s * 0.42, 0.75, 0); b.rotation.set(0, Math.PI / 2, s * 0.7); lid.add(b); }
  lid.add(part(geo.ball(16), plastic(P.sun), 0, 0.62, 0, 0.2));
  const bear = makeToy(1); bear.root.position.y = 0.2; bear.root.scale.setScalar(0.001); bear.root.visible = false; group.add(bear.root);
  let opened = false, wig = 0;
  const stage: HelloStage = {
    group,
    view: { pos: new THREE.Vector3(0, 5.6, 15), look: new THREE.Vector3(0, 2.0, 0), fitWidth: 9 },
    spin: true,
    tick(t, dt) {
      if (!opened) {
        const w = Math.max(0, Math.sin(t * 2.2)) > 0.92 || wig > 0 ? 1 : 0;
        if (wig > 0) wig -= dt;
        box.rotation.z = w * Math.sin(t * 30) * 0.05; lid.position.y = 2.0 + w * Math.abs(Math.sin(t * 30)) * 0.12;
      }
      bear.tick(t, dt);
    },
    pickables: () => [box],
    onPick: (id) => { if (id) on.pick(); },
    open() {
      if (opened) return; opened = true;
      // the lid flies off, flips, and lands on the mat beside the box
      tween(1.1, (k) => { lid.position.set(k * 2.6, 2.0 + Math.sin(k * Math.PI) * 3 - k * 2.05, k * 1.2); lid.rotation.set(k * Math.PI * 2, 0, -k * 0.35); }, { ease: ease.out });
      tween(0.6, (k) => { box.scale.set(1 + k * 0.1, 1 - k * 0.15, 1 + k * 0.1); }, { ease: ease.elastic });
      confetti(group, new THREE.Vector3(0, 2.4, 0), { n: 120, power: 5, stars: true });
      bear.root.visible = true;
      tween(1.2, (k) => { bear.root.position.y = 2.1 + Math.sin(k * Math.PI) * 1.6 + k * 0.1; bear.root.scale.setScalar(Math.max(0.001, k * 1.5)); bear.root.rotation.y = k * Math.PI * 2; }, { ease: ease.out, delay: 0.25 });
    },
    wiggle() { wig = 0.4; },
    dispose() { bear.dispose(); },
  };
  return stage;
}
