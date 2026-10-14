/* The play mat: a round toy base with a stacking pole in the middle. Four levels: the Tub (a bath
 * moat all round), the Grass (the mat itself), the Sky (a ring of clouds up the pole) and the Moon
 * (the very top). Mat toys stand at the back of each level, wagon toys at the front, the Bear in the
 * middle. A blanket fort covers it all as the fort grows. */
import * as THREE from 'three';
import type { Stage } from './world';
import { world } from './world';
import { P, plastic, felt, glass, geo, part, ball, wordSprite, confetti, tween, ease, starGeo, heartGeo } from './kit';
import { makeToy, rockPile, type ToyCtl } from './toys';
import type { MatUnit } from '../realm';
import type { Realm } from '../lore';

export interface MatInfo { ground: number; rocks: number; fort: number; wagonHome: boolean; name: string; club: string; empty?: boolean }
export interface MatStage extends Stage {
  sync(units: MatUnit[], info: MatInfo): void;
  select(id: string | null): void;
  rite(kind: 'dig' | 'pop' | 'feed' | 'find' | 'hug' | 'make' | 'grab' | 'wake' | 'nap', id?: string): void;
  anchor(id: string): THREE.Vector3 | null;
  hover(id: string | null): void;
  /** A progress pill over a toy: 0..1 and a short time, or null to take it away. */
  progress(id: string, frac: number | null, color?: string, label?: string): void;
  /** A tap on a decoration: it wobbles. */
  boing(id: string): void;
}

const LEVEL: Record<Realm, { y: number; r: number }> = { tub: { y: -0.34, r: 5.35 }, grass: { y: 0.02, r: 2.95 }, sky: { y: 3.05, r: 3.05 }, moon: { y: 5.75, r: 2.45 } };

export function matStage(on: { pick: (id: string | null) => void; hover?: (id: string | null) => void }): MatStage {
  const group = new THREE.Group();
  const base = new THREE.Group(); group.add(base);

  /* the base and its rim */
  base.add(part(geo.cyl(4.05, 4.15, 0.62, 72), plastic(P.red), 0, -0.31, 0));
  const rim = part(geo.ring(4.02, 0.2, 96), plastic(P.sun), 0, 0, 0); rim.rotation.x = Math.PI / 2; base.add(rim);
  const top = part(geo.cyl(3.9, 3.9, 0.06, 72), felt(0x55C23A), 0, 0.0, 0); top.receiveShadow = true; base.add(top);
  // stitching: a cream dashed ring, and four cheerful dots around
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; const s = part(geo.box(0.18, 0.02, 0.05, 0.01), felt(P.cream), Math.cos(a) * 3.55, 0.04, Math.sin(a) * 3.55); s.rotation.y = -a + Math.PI / 2; base.add(s); }
  for (const [i, c] of [P.blue, P.sun, P.plum, P.peach].entries()) { const a = i * Math.PI / 2 + Math.PI / 4; base.add(part(geo.cyl(0.22, 0.22, 0.03, 24), felt(c), Math.cos(a) * 3.55, 0.05, Math.sin(a) * 3.55)); }
  // the bath all round: water, a white tub rim, soap bubbles
  const water = new THREE.Mesh(new THREE.RingGeometry(4.2, 6.35, 96, 1), new THREE.MeshPhysicalMaterial({ color: 0x3cb8f0, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.88 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -0.38; water.receiveShadow = true; base.add(water);
  const tubRim = part(geo.ring(6.4, 0.28, 96), plastic(P.white), 0, -0.36, 0); tubRim.rotation.x = Math.PI / 2; base.add(tubRim);
  base.add(part(geo.cyl(6.6, 6.0, 0.7, 72), plastic(P.white), 0, -0.75, 0));
  const suds: THREE.Mesh[] = [];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + 0.2; const s = part(geo.ball(14), glass(0xffffff, 0.55), Math.cos(a) * (4.5 + (i % 3) * 0.6), -0.3, Math.sin(a) * (4.5 + (i % 3) * 0.6), 0.12 + (i % 4) * 0.05); suds.push(s); base.add(s); }

  /* the stacking pole */
  const pole = new THREE.Group(); group.add(pole);
  const rings = new THREE.Group(); rings.userData.pick = 'deco:rings'; pole.add(rings);
  pole.add(part(geo.cyl(0.16, 0.22, 5.6, 20), plastic(P.white), 0, 2.8, 0));
  const ringCols = [P.red, P.peach, P.sun, P.leaf, P.blue];
  ringCols.forEach((c, i) => { const r = part(geo.ring(0.62 - i * 0.08, 0.2 - i * 0.015, 32), plastic(c), 0, 0.2 + i * 0.36, 0); r.rotation.x = Math.PI / 2; rings.add(r); });
  // the sky level: a hoop of cloud puffs
  const skyRing = new THREE.Group(); skyRing.position.y = LEVEL.sky.y - 0.12; pole.add(skyRing);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; skyRing.add(part(geo.ball(18), felt(0xffffff), Math.cos(a) * LEVEL.sky.r, 0, Math.sin(a) * LEVEL.sky.r, 0.34 + (i % 3) * 0.06, 0.24, 0.34)); }
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; const sp = part(geo.cyl(0.035, 0.035, LEVEL.sky.r, 8), plastic(P.sky), Math.cos(a) * LEVEL.sky.r / 2, 0, Math.sin(a) * LEVEL.sky.r / 2); sp.rotation.z = Math.PI / 2; sp.rotation.y = -a; skyRing.add(sp); }
  // the moon level: a crescent and a hoop of stars, turning slowly
  const moon = new THREE.Group(); moon.position.y = LEVEL.moon.y; pole.add(moon);
  const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.2, 18, 40, Math.PI * 1.25), plastic(P.sun, { glow: 0.25 }));
  crescent.rotation.z = -Math.PI * 0.12; crescent.position.y = 0.55; crescent.castShadow = true; crescent.userData.pick = 'deco:moon'; moon.add(crescent);
  const starHoop = new THREE.Group(); moon.add(starHoop);
  const hoop = part(geo.ring(LEVEL.moon.r, 0.05, 80), plastic(P.plum), 0, -0.08, 0); hoop.rotation.x = Math.PI / 2; starHoop.add(hoop);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + 0.31; const s = part(starGeo(), plastic(P.sun, { glow: 0.3 }), Math.cos(a) * LEVEL.moon.r, -0.08, Math.sin(a) * LEVEL.moon.r, 0.28); s.rotation.y = -a; starHoop.add(s); }
  // the club flag on top
  const flag = new THREE.Group(); flag.position.set(0, 5.65, 0); pole.add(flag);
  flag.add(part(geo.cyl(0.03, 0.03, 1.4, 8), plastic(P.white), 0, 0.7, 0));
  const flagCloth = part(geo.box(0.62, 0.38, 0.03, 0.04), plastic(P.red), 0.33, 1.2, 0); flag.add(flagCloth);
  flag.add(part(geo.ball(12), plastic(P.sun), 0, 1.42, 0, 0.08));
  let nameTag: THREE.Sprite | null = null;

  /* the fort: a striped blanket dome */
  const fortTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 64; const x = c.getContext('2d')!; for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#FFFFFF' : '#E4002B'; x.fillRect(i * 32, 0, 32, 64); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t; })();
  const fortMat = new THREE.MeshStandardMaterial({ map: fortTex, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, roughness: 0.9 });
  const fort = new THREE.Mesh(new THREE.SphereGeometry(7.1, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2), fortMat);
  fort.position.y = -0.4; fort.visible = false; group.add(fort);

  /* rocks lying out (stored ore), and rocks still in the ground */
  let pile: THREE.Group | null = null;
  let pileTag: THREE.Sprite | null = null;
  const mounds: THREE.Group[] = [];
  const moundRoot = new THREE.Group(); group.add(moundRoot);
  function mound(i: number) {
    const m = new THREE.Group();
    m.add(part(geo.ball(18), felt(0x8A5A2B), 0, 0, 0, 0.32, 0.16, 0.32));
    m.add(ball(P.grey, 0.1, 0.06, 0.14, 0.04));
    m.add(part(starGeo(), plastic(P.sun, { glow: 0.6 }), -0.08, 0.2, 0, 0.12));
    const a = Math.PI * 1.1 + i * 0.55, r = 1.25 + (i % 3) * 0.55;
    m.position.set(Math.cos(a) * r, 0.03, Math.sin(a) * r);
    m.userData.pick = 'deco:mound';
    return m;
  }

  /* the wagon: home or away */
  const wagon = new THREE.Group(); wagon.position.set(-1.9, 0.02, 2.55); wagon.rotation.y = 0.5; wagon.userData.pick = 'deco:wagon'; group.add(wagon);
  wagon.add(part(geo.box(1.0, 0.36, 0.62, 0.06), plastic(P.red), 0, 0.38, 0));
  wagon.add(part(geo.box(0.9, 0.06, 0.52, 0.02), plastic(0x9E001E), 0, 0.57, 0));
  for (const [x, z] of [[-0.36, 0.34], [0.36, 0.34], [-0.36, -0.34], [0.36, -0.34]]) { const w = part(geo.cyl(0.16, 0.16, 0.08, 20), plastic(P.ink), x, 0.16, z); w.rotation.x = Math.PI / 2; wagon.add(w); wagon.add(part(geo.cyl(0.08, 0.08, 0.1, 12), plastic(P.sun), x, 0.16, z).rotateX(Math.PI / 2)); }
  const handle = part(geo.cyl(0.025, 0.025, 0.9, 8), plastic(P.ink), 0.82, 0.55, 0); handle.rotation.z = 1.0; wagon.add(handle);
  wagon.add(part(geo.ring(0.08, 0.025, 12), plastic(P.ink), 1.2, 0.82, 0));

  /* the toys */
  const toys = new Map<string, { ctl: ToyCtl; u: MatUnit; tag?: THREE.Sprite; busy?: boolean }>();
  /** The name tag floats above the toy, and above its progress pill when it has one. */
  const tagY = (t: { ctl: ToyCtl; u: MatUnit; busy?: boolean }) => (t.u.building ? 1.25 : t.ctl.height + 0.55) + (t.busy ? 0.42 : -0.1);
  const toyRoot = new THREE.Group(); group.add(toyRoot);
  let sel: string | null = null, hov: string | null = null;

  function placeFor(u: MatUnit, i: number, n: number): THREE.Vector3 {
    const L = LEVEL[u.realm];
    if (u.type === 1) { // the Bear stands front and centre of its level
      const r = u.realm === 'tub' ? L.r : u.realm === 'grass' ? 1.45 : L.r * 0.92;
      return new THREE.Vector3(0, L.y, r);
    }
    const slots = Math.max(4, n);
    const k = (i + 0.5) / slots;
    // mat toys around the back, wagon toys around the front (leaving the Bear's spot clear)
    const a = u.mat ? Math.PI * (1.08 + 0.84 * k) : (k < 0.5 ? Math.PI * (0.12 + 0.62 * k) : Math.PI * (0.57 + 0.62 * (k - 0.5) + 0.0)) ;
    const r = L.r + (u.realm === 'grass' && u.mat ? (i % 2 ? 0.2 : -0.35) : 0);
    return new THREE.Vector3(Math.cos(a) * r, L.y, Math.sin(a) * r);
  }

  function lookOf(u: MatUnit) { return { sleep: u.offline, building: u.building, hidden: u.hidden, hug: u.hugging, picked: sel === u.id, hover: hov === u.id }; }


  let first = true;
  function sync(units: MatUnit[], inf: MatInfo) {

    // positions: rank each toy among its level-and-side group by slot
    const groups = new Map<string, MatUnit[]>();
    for (const u of units) { if (u.type === 1) continue; const k = `${u.realm}:${u.mat}`; (groups.get(k) || groups.set(k, []).get(k)!).push(u); }
    for (const list of groups.values()) list.sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id));
    const seen = new Set<string>();
    for (const u of units) {
      seen.add(u.id);
      const list = groups.get(`${u.realm}:${u.mat}`) || [u];
      const pos = placeFor(u, Math.max(0, list.indexOf(u)), list.length);
      let t = toys.get(u.id);
      if (!t) {
        const ctl = makeToy(u.type);
        ctl.root.userData.pick = u.id;
        ctl.root.position.copy(pos);
        ctl.root.lookAt(0, pos.y, 0); ctl.root.rotateY(Math.PI);
        // toys at the back face the camera a little, not the pole
        if (u.mat) ctl.root.rotation.y = Math.atan2(pos.x, pos.z) * 0.35;
        toyRoot.add(ctl.root);
        t = { ctl, u };
        toys.set(u.id, t);
        if (!first) { ctl.root.scale.setScalar(0.001); tween(0.7, (k) => ctl.root.scale.setScalar(Math.max(0.001, k)), { ease: ease.back }); confetti(group, pos.clone().add(new THREE.Vector3(0, 0.6, 0)), { n: 24, power: 2 }); }
      } else if (t.ctl.root.position.distanceTo(pos) > 0.01) {
        const from = t.ctl.root.position.clone(), r = t.ctl.root;
        tween(0.9, (k) => { r.position.lerpVectors(from, pos, k); r.position.y += Math.sin(k * Math.PI) * 1.2; }, { ease: ease.inOut });
      }
      t.u = u;
      t.ctl.look(lookOf(u));
    }
    for (const [id, t] of toys) if (!seen.has(id)) {
      toys.delete(id);
      const r = t.ctl.root;
      confetti(group, r.position.clone().add(new THREE.Vector3(0, 0.5, 0)), { n: 20, power: 1.6, colors: [P.white, P.cream, P.grey] });
      tween(0.4, (k) => r.scale.setScalar(Math.max(0.001, 1 - k)), { done: () => { toyRoot.remove(r); t.ctl.dispose(); } });
    }
    // rocks lying out
    if (pile) { group.remove(pile); pile = null; }
    if (pileTag) { group.remove(pileTag); pileTag.material.map?.dispose(); pileTag = null; }
    if (inf.rocks > 0) {
      pile = rockPile(inf.rocks); pile.position.set(2.1, 0.03, 1.8); group.add(pile);
      pileTag = wordSprite(String(inf.rocks), { bg: '#C9B38F', size: 0.42 }); pileTag.position.set(2.1, 0.85, 1.8); group.add(pileTag);
    }
    // rocks still in the ground
    const want = Math.min(10, Math.max(0, inf.ground));
    while (mounds.length > want) { const m = mounds.pop()!; confetti(group, m.position.clone().add(new THREE.Vector3(0, 0.2, 0)), { n: 14, power: 1.4, colors: [0x8A5A2B, P.grey, P.sun] }); moundRoot.remove(m); }
    while (mounds.length < want) { const m = mound(mounds.length); mounds.push(m); moundRoot.add(m); }
    // the fort
    const f = Math.max(0, Math.min(1, inf.fort));
    fort.visible = f > 0;
    tween(0.8, (k) => { fortMat.opacity = fortMat.opacity + (f * 0.22 - fortMat.opacity) * k; });
    wagon.visible = inf.wagonHome;
    flagCloth.material = plastic(new THREE.Color(inf.club).getHex());
    if (nameTag) { pole.remove(nameTag); nameTag.material.map?.dispose(); }
    nameTag = inf.name ? wordSprite(inf.name, { bg: '#FFFFFF', size: 0.5 }) : null;
    if (nameTag) { nameTag.position.set(0, 7.45, 0); pole.add(nameTag); }
    first = false;
  }

  function tagFor(id: string, on: boolean) {
    const t = toys.get(id); if (!t) return;
    if (on && !t.tag) {
      const { word } = { word: (TOY_WORDS[t.u.type] || 'Toy') };
      t.tag = wordSprite(word, { bg: '#FFFFFF', size: 0.42 });
      t.tag.position.set(0, tagY(t), 0); t.ctl.root.add(t.tag);
    } else if (!on && t.tag) { t.ctl.root.remove(t.tag); t.tag.material.map?.dispose(); t.tag.material.dispose(); t.tag = undefined; }
  }

  const stage: MatStage = {
    group,
    view: { pos: new THREE.Vector3(0, 8.6, 18.5), look: new THREE.Vector3(0, 2.9, 0), fitWidth: 14.5 },
    spin: true,
    tick(t, dt) {
      for (const { ctl } of toys.values()) ctl.tick(t, dt);
      // the chosen toy is the star of the shot: the camera comes close and follows it as the mat turns
      const chosen = sel ? toys.get(sel) : undefined;
      if (chosen && world.current === stage) {
        const at = chosen.ctl.root.getWorldPosition(new THREE.Vector3());
        at.y += chosen.ctl.height * 0.5;
        const away = new THREE.Vector3(at.x * 0.35, 0, Math.max(at.z, 0) * 0.35 + 6.2);
        world.aim(at.clone().add(away).add(new THREE.Vector3(0, 2.6, 0)), at);
      }
      starHoop.rotation.y = t * 0.12;
      skyRing.rotation.y = -t * 0.05;
      crescent.rotation.y = Math.sin(t * 0.6) * 0.4;
      flagCloth.rotation.y = Math.sin(t * 3) * 0.25;
      suds.forEach((s, i) => { s.position.y = -0.3 + Math.sin(t * 1.5 + i) * 0.04; });
      for (const { ctl, u } of toys.values()) {
        if (u.realm === 'tub') ctl.root.position.y = LEVEL.tub.y + Math.sin(t * 1.8 + ctl.root.position.x) * 0.05;
        if (u.realm === 'sky' || u.realm === 'moon') ctl.body.position.y += Math.sin(t * 1.4 + ctl.root.position.x) * 0.06;
      }
      // the moon level carries its toys round with the star hoop
      for (const { ctl, u } of toys.values()) if (u.realm === 'moon') {
        const p = ctl.root.position; const a = Math.atan2(p.z, p.x) + dt * 0.12; const r = Math.hypot(p.x, p.z);
        if (u.type !== 1) { p.x = Math.cos(a) * r; p.z = Math.sin(a) * r; ctl.root.rotation.y = -a + Math.PI / 2; }
      }
      mounds.forEach((m, i) => { m.children[2].rotation.y = t * 2 + i; m.children[2].position.y = 0.22 + Math.sin(t * 3 + i) * 0.04; });
      if (fort.visible) fort.rotation.y = t * 0.02;
    },
    pickables: () => [toyRoot, wagon, rings, moundRoot, crescent],
    onPick: (id) => on.pick(id),
    onHover: (id) => { stage.hover(id); on.hover?.(id); },
    sync,
    select(id) {
      const was = sel; sel = id;
      if (!id && was && world.current === stage) world.aim(stage.view.pos, stage.view.look);
      for (const x of [was, id]) if (x) { const t = toys.get(x); if (t) t.ctl.look(lookOf(t.u)); tagFor(x, x === sel); }
      if (id) toys.get(id)?.ctl.squash(0.8);
    },
    hover(id) {
      const was = hov; hov = id;
      for (const x of [was, id]) if (x) { const t = toys.get(x); if (t) t.ctl.look(lookOf(t.u)); if (x !== sel) tagFor(x, x === hov); }
    },
    anchor(id) { const t = toys.get(id); if (!t) return null; const v = new THREE.Vector3(0, t.ctl.height + 0.3, 0); return t.ctl.root.localToWorld(v); },
    progress(id, frac, color, label) { const t = toys.get(id); if (!t) return; t.ctl.progress(frac, color, label); t.busy = frac != null; if (t.tag) t.tag.position.y = tagY(t); },
    boing(id) {
      const o = id === 'deco:wagon' ? wagon : id === 'deco:rings' ? rings : id === 'deco:moon' ? crescent : moundRoot.children.find((m) => m.userData.pick === id) || null;
      if (!o) return;
      const s0 = o.scale.clone(), r0 = o.rotation.z;
      tween(0.7, (k) => { const w = Math.sin(k * Math.PI * 4) * (1 - k); o.scale.set(s0.x * (1 + w * 0.25), s0.y * (1 - w * 0.25), s0.z * (1 + w * 0.25)); o.rotation.z = r0 + w * 0.15; }, { ease: ease.lin, done: () => { o.scale.copy(s0); o.rotation.z = r0; } });
      if (id === 'deco:mound') confetti(group, (o as THREE.Object3D).position.clone().add(new THREE.Vector3(0, 0.3, 0)), { n: 10, power: 1.2, colors: [0x8A5A2B, P.sun] });
    },
    rite(kind, id) {
      const at = (tid?: string) => { const t = tid ? toys.get(tid) : [...toys.values()].find((x) => x.u.type === ({ dig: 14, pop: 15, feed: 20 } as Record<string, number>)[kind]); return t ? t.ctl.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.8, 0)) : new THREE.Vector3(0, 1.2, 0); };
      const toyAt = (tid?: string) => (tid ? toys.get(tid) : undefined);
      const pos = group.worldToLocal(at(id));
      switch (kind) {
        case 'dig': confetti(group, pos, { n: 26, power: 2.2, colors: [0x8A5A2B, P.grey, 0xB59A73] }); world.rumble(0.25); break;
        case 'pop': confetti(group, pos, { n: 40, power: 3, stars: true }); break;
        case 'feed': confetti(group, pos, { n: 26, power: 2.4, colors: [P.sun, P.peach], stars: true }); break;
        case 'make': confetti(group, pos, { n: 40, power: 2.6 }); break;
        case 'grab': confetti(group, new THREE.Vector3(2.1, 0.6, 1.8), { n: 30, power: 3, colors: [P.grey, 0xB59A73] }); world.rumble(0.6); break;
        case 'hug': hearts(pos); break;
        case 'find': { const y0 = group.rotation.y; tween(2.2, (k) => { group.rotation.y = y0 + k * Math.PI * 4; group.position.y = Math.sin(k * Math.PI) * 1.5; }, { ease: ease.inOut }); confetti(group, new THREE.Vector3(0, 3, 0), { n: 80, power: 4, stars: true }); break; }
        case 'wake': case 'nap': break;
      }
      toyAt(id)?.ctl.squash(1);
    },
    dispose() { for (const { ctl } of toys.values()) ctl.dispose(); },
  };
  function hearts(at: THREE.Vector3) {
    for (let i = 0; i < 6; i++) {
      const m = part(heartGeo(), plastic(P.pink, { glow: 0.3 }), at.x, at.y, at.z, 0.3);
      group.add(m);
      const dx = (Math.random() - 0.5) * 1.2, dz = (Math.random() - 0.5) * 1.2;
      tween(1.6, (k) => { m.position.set(at.x + dx * k, at.y + k * 2.2, at.z + dz * k); m.scale.setScalar(0.3 * (1 - k * 0.6)); m.rotation.y = k * 4; }, { delay: i * 0.08, done: () => group.remove(m) });
    }
  }
  return stage;
}

/** Toy words for the floating tags (kept here so the world needs nothing from the page). */
export const TOY_WORDS: Record<number, string> = {
  1: 'Bear', 2: 'Rocket', 3: 'Zoom', 4: 'Saucer', 5: 'Plane', 6: 'Kite', 7: 'Copter', 8: 'Choo', 9: 'Truck', 10: 'Squirt', 11: 'Duck',
  12: 'Boat', 13: 'Fish', 14: 'Digger', 15: 'Popper', 16: 'Bubble', 17: 'Rattle', 18: 'Piggy', 19: 'Popgun', 20: 'Pinwheel', 21: 'Windmill', 22: 'Sun',
};
