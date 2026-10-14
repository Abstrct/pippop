/* Everyone, as a crib mobile. A wooden star hub hangs over the clouds; hoops hang under it, each
 * turning its own way; every kid's mat dangles from a hoop on its own string, in its club's colour.
 * Mats with rocks lying out carry a little rock; yours is the big one with the glow. */
import * as THREE from 'three';
import { world, type Stage } from './world';
import { P, plastic, felt, geo, part, starGeo, tween, ease, confetti, wordSprite } from './kit';

export interface SkyKid { id: string; color: string; rich: boolean; me: boolean; sleepy: boolean; name: string }
export interface SkyStage extends Stage {
  set(kids: SkyKid[]): void;
  select(i: number | null): void;
  roll(from: number, to: number): void;
}

const HOOPS = [{ r: 3.2, y: 5.6 }, { r: 5.6, y: 3.6 }, { r: 8.0, y: 1.6 }, { r: 10.4, y: -0.4 }, { r: 12.8, y: -2.4 }, { r: 15.2, y: -4.4 }];

export function skyStage(on: { pick: (i: number | null) => void; hover?: (i: number | null) => void }): SkyStage {
  const group = new THREE.Group();
  const hub = new THREE.Group(); hub.position.y = 9.2; group.add(hub);
  // the hub: a big wooden star on a ring, hanging from a string to the sky
  const star = part(starGeo(), plastic(P.sun, { glow: 0.2 }), 0, 0.4, 0, 2.2); hub.add(star);
  hub.add(part(geo.cyl(0.04, 0.04, 30, 6), plastic(P.white), 0, 15, 0));
  const hubRing = part(geo.ring(1.3, 0.12, 48), plastic(P.red), 0, -0.4, 0); hubRing.rotation.x = Math.PI / 2; hub.add(hubRing);

  const hoops: THREE.Group[] = [];
  HOOPS.forEach((h, i) => {
    const g = new THREE.Group(); g.position.y = h.y; group.add(g);
    const ring = part(geo.ring(h.r, 0.07, Math.round(40 + h.r * 10)), plastic([P.red, P.blue, P.sun, P.leaf, P.plum, P.peach][i]), 0, 0, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
    // four strings up to the hoop above (or the hub)
    const upY = (i === 0 ? hub.position.y - 0.4 : HOOPS[i - 1].y) - h.y;
    const upR = i === 0 ? 1.3 : HOOPS[i - 1].r;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + i * 0.4;
      const p0 = new THREE.Vector3(Math.cos(a) * h.r, 0, Math.sin(a) * h.r), p1 = new THREE.Vector3(Math.cos(a) * upR, upY, Math.sin(a) * upR);
      const len = p0.distanceTo(p1);
      const s = new THREE.Mesh(geo.cyl(0.015, 0.015, 1, 5), plastic(P.white));
      s.position.copy(p0).lerp(p1, 0.5); s.scale.y = len; s.lookAt(p1); s.rotateX(Math.PI / 2);
      g.add(s);
      // a little bead where string meets hoop
      g.add(part(geo.ball(10), plastic(P.white), p0.x, 0, p0.z, 0.1));
    }
    g.userData.speed = (i % 2 ? -1 : 1) * (0.025 + i * 0.004);
    hoops.push(g);
  });

  /* the hanging mats, instanced */
  const MAX = 420;
  const baseM = new THREE.InstancedMesh(geo.cyl(0.36, 0.38, 0.16, 20), plastic(0xffffff), MAX);
  const topM = new THREE.InstancedMesh(geo.cyl(0.3, 0.3, 0.04, 20), felt(0xffffff), MAX);
  const strM = new THREE.InstancedMesh(geo.cyl(0.012, 0.012, 1, 4), plastic(P.white), MAX);
  const rockM = new THREE.InstancedMesh(geo.ball(10), plastic(P.grey), MAX);
  for (const m of [baseM, topM, rockM, strM]) { m.castShadow = true; m.count = 0; m.frustumCulled = false; }
  strM.count = 0;
  group.add(baseM, topM, strM, rockM);
  const meRing = part(geo.ring(0.62, 0.06, 32), plastic(P.sun, { glow: 1 }), 0, 0, 0); meRing.rotation.x = Math.PI / 2; meRing.visible = false; group.add(meRing);
  const selRing = part(geo.ring(0.58, 0.07, 32), plastic(P.white, { glow: 0.9 }), 0, 0, 0); selRing.rotation.x = Math.PI / 2; selRing.visible = false; group.add(selRing);
  let meTag: THREE.Sprite | null = null, selTag: THREE.Sprite | null = null;

  let kids: SkyKid[] = [];
  const slots: { hoop: number; a: number; len: number; phase: number }[] = [];
  let sel: number | null = null, me = -1, hov: number | null = null, calm = 1;
  const tmp = new THREE.Object3D(), col = new THREE.Color();

  function layout() {
    slots.length = 0;
    // every kid gets a spot: hoops fill from the inside out, and a crowded sky packs the mats closer
    const n = kids.length;
    const room = HOOPS.reduce((a, h) => a + 2 * Math.PI * h.r, 0);
    const gap = Math.min(1.05, room / Math.max(1, n));
    let i = 0;
    for (let hIdx = 0; hIdx < HOOPS.length && i < n; hIdx++) {
      const last = hIdx === HOOPS.length - 1;
      const cap = last ? n - i : Math.max(1, Math.floor((2 * Math.PI * HOOPS[hIdx].r) / gap));
      const m = Math.min(cap, n - i);
      for (let k = 0; k < m; k++, i++) slots.push({ hoop: hIdx, a: (k / m) * Math.PI * 2, len: 0.8 + ((k * 7) % 5) * 0.32, phase: k * 1.3 });
    }
  }
  function placeOf(i: number, t: number, out: THREE.Vector3) {
    const s = slots[i], h = hoops[s.hoop], H = HOOPS[s.hoop];
    const a = s.a + h.rotation.y * -1;
    const sway = Math.sin(t * 1.1 + s.phase) * 0.06;
    const lift = sel === i ? 0.5 + Math.sin(t * 3) * 0.08 : 0;
    out.set(Math.cos(a) * (H.r + sway), H.y - s.len + lift, Math.sin(a) * (H.r + sway));
    return out;
  }

  const v = new THREE.Vector3();
  let frames = 0;
  function paint(t: number) {
    const n = Math.min(MAX, kids.length, slots.length);
    baseM.count = topM.count = strM.count = n;
    let rocks = 0;
    for (let i = 0; i < n; i++) {
      placeOf(i, t, v);
      const k = kids[i];
      const few = n < 24 ? 1.9 : n < 80 ? 1.35 : 1;
      const big = (k.me ? 1.7 : sel === i ? 1.35 : 1) * few;
      tmp.position.copy(v); tmp.rotation.set(Math.sin(t + i) * 0.08, t * 0.3 + i, 0); tmp.scale.setScalar(big); tmp.updateMatrix();
      baseM.setMatrixAt(i, tmp.matrix);
      tmp.position.y += 0.09 * big; tmp.updateMatrix(); topM.setMatrixAt(i, tmp.matrix);
      // string from hoop to mat
      const H = HOOPS[slots[i].hoop];
      const top = new THREE.Vector3(v.x, H.y, v.z);
      tmp.position.copy(v).lerp(top, 0.5); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, H.y - v.y, 1); tmp.updateMatrix(); strM.setMatrixAt(i, tmp.matrix);
      if (k.rich) { tmp.position.set(v.x, v.y + 0.2 * big, v.z); tmp.scale.set(0.13, 0.1, 0.13); tmp.rotation.set(i, i, 0); tmp.updateMatrix(); rockM.setMatrixAt(rocks++, tmp.matrix); }
      if (i === me) { meRing.position.set(v.x, v.y - 0.1, v.z); meRing.scale.setScalar(1.7 + Math.sin(t * 3) * 0.08); if (meTag) meTag.position.set(v.x, v.y + 1.0, v.z); }
      if (i === sel) { selRing.position.set(v.x, v.y - 0.1, v.z); selRing.rotation.z = t; if (selTag) selTag.position.set(v.x, v.y + (k.me ? 1.5 : 0.95), v.z); }
    }
    rockM.count = rocks;
    for (const m of [baseM, topM, strM, rockM]) m.instanceMatrix.needsUpdate = true;
    // picking tests the bounding sphere first: keep it around the mats as they sway
    if ((frames++ & 15) === 0) { baseM.computeBoundingSphere(); topM.computeBoundingSphere(); }
  }

  const stage: SkyStage = {
    group,
    view: { pos: new THREE.Vector3(0, 9, 33), look: new THREE.Vector3(0, 0.8, 0) },
    spin: true,
    tick(t, dt) {
      // the mobile holds still while a mat is being aimed at or looked at, so taps land
      calm += ((sel != null || hov != null ? 0 : 1) - calm) * Math.min(1, dt * 3);
      for (const h of hoops) h.rotation.y += (h.userData.speed as number) * dt * calm;
      star.rotation.y = t * 0.3;
      hubRing.rotation.z = t * 0.2;
      paint(t);
    },
    pickables: () => [baseM, topM],
    instancedPick: (_m, i) => (i < kids.length ? String(i) : null),
    onPick: (id) => on.pick(id == null ? null : Number(id)),
    onHover: (id) => { hov = id == null ? null : Number(id); on.hover?.(hov); },
    set(list) {
      kids = list.slice(0, MAX);
      me = kids.findIndex((k) => k.me);
      layout();
      // only as many hoops as there are kids to hang, and the camera framed to fit them
      const used = Math.max(1, ...slots.map((x) => x.hoop + 1));
      hoops.forEach((h, i) => { h.visible = i < used; });
      const H = HOOPS[used - 1];
      const ly = (9.2 + H.y - 2) / 2;
      const pos = new THREE.Vector3(0, ly + 3 + H.r * 0.25, 9 + H.r * 2.0), look = new THREE.Vector3(0, ly, 0);
      stage.view = { pos, look, fitWidth: H.r * 2 + 3 };
      if (world.current === stage) world.aim(pos, look);
      const tops = [0x7FD35B, 0x9BE3C4, 0xFFE08A, 0xBFE6FF, 0xFFC2D6, 0xD9C2F0];
      // a kid asleep for a long while has a dim, grey mat top: an easy target, or a quiet neighbour
      for (let i = 0; i < kids.length; i++) { baseM.setColorAt(i, col.set(kids[i].color)); topM.setColorAt(i, col.set(kids[i].sleepy ? 0x9AA3B5 : tops[(i * 7 + kids[i].id.length) % tops.length])); }
      if (baseM.instanceColor) baseM.instanceColor.needsUpdate = true;
      if (topM.instanceColor) topM.instanceColor.needsUpdate = true;
      meRing.visible = me >= 0;
      if (meTag) { group.remove(meTag); meTag.material.map?.dispose(); meTag = null; }
      if (me >= 0) { meTag = wordSprite('Me', { bg: '#FFC72C', size: 0.55 }); group.add(meTag); }
    },
    select(i) {
      sel = i; selRing.visible = i != null && i >= 0;
      if (selTag) { group.remove(selTag); selTag.material.map?.dispose(); selTag = null; }
      if (i != null && kids[i] && !kids[i].me) { selTag = wordSprite(kids[i].name, { bg: '#FFFFFF', size: 0.45 }); group.add(selTag); }
    },
    roll(from, to) {
      if (from < 0 || to < 0 || from >= kids.length || to >= kids.length) return;
      const w = new THREE.Group();
      w.add(part(geo.box(0.5, 0.2, 0.32, 0.04), plastic(P.red)));
      for (const [x, z] of [[-0.18, 0.17], [0.18, 0.17], [-0.18, -0.17], [0.18, -0.17]]) w.add(part(geo.cyl(0.08, 0.08, 0.05, 12), plastic(P.ink), x, -0.1, z).rotateX(Math.PI / 2));
      group.add(w);
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      tween(2.4, (k) => {
        const t = performance.now() / 1000;
        placeOf(from, t, a); placeOf(to, t, b);
        w.position.lerpVectors(a, b, k); w.position.y += Math.sin(k * Math.PI) * 4 + 0.4;
        w.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) - Math.PI / 2; w.rotation.z = Math.sin(k * 20) * 0.08;
      }, { ease: ease.inOut, done: () => { confetti(group, w.position.clone(), { n: 30, power: 2 }); group.remove(w); } });
    },
    dispose() { baseM.dispose(); topM.dispose(); strM.dispose(); rockM.dispose(); },
  };
  return stage;
}
