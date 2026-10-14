/* Bonk! Two sides of a big round rug: your wagon toys on the left, theirs on the right. Each side
 * has its four levels (a puddle for the Tub, the rug for the Grass, clouds for the Sky, star rings
 * for the Moon). A bonk is a squishy ball that arcs across; a toy that is out of hearts goes poof. */
import * as THREE from 'three';
import type { Stage } from './world';
import { world } from './world';
import { P, plastic, felt, glass, geo, part, burstSprite, wordSprite, confetti, tween, ease, starGeo, heartGeo } from './kit';
import { makeToy, type ToyCtl } from './toys';
import type { Realm } from '../lore';

export interface BonkUnit { id: string; type: number; realm: Realm; mat: boolean; health: number; max: number; sleep: boolean; hidden: boolean }
export interface BonkStage extends Stage {
  set(ours: BonkUnit[], theirs: BonkUnit[], o: { oursName?: string; theirsName?: string }): void;
  mark(kind: 'a' | 't', id: string | null): void;
  strike(from: string, to: string, o: { miss?: boolean; mine?: boolean; done?: () => void }): void;
  pop(id: string, text: string, tone: 'hit' | 'miss' | 'guard' | 'fell'): void;
  fell(id: string): void;
  anchor(id: string): THREE.Vector3 | null;
}

const ROW: Record<Realm, { y: number; z: number }> = { tub: { y: 0.0, z: 2.9 }, grass: { y: 0.0, z: 1.0 }, sky: { y: 2.5, z: -0.6 }, moon: { y: 4.7, z: -2.0 } };

export function bonkStage(on: { pick: (id: string | null) => void; hover?: (id: string | null) => void }): BonkStage {
  const group = new THREE.Group();
  // the rug: a big round braided mat, blue on our side and red on theirs
  const rug = new THREE.Group(); group.add(rug);
  rug.add(part(geo.cyl(9.6, 9.8, 0.3, 80), plastic(P.sun), 0, -0.16, 0));
  const half = (color: number, sign: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.2, 0.06, 64, 1, false, sign < 0 ? Math.PI : 0, Math.PI), felt(color));
    m.position.y = 0.0; m.receiveShadow = true; rug.add(m);
  };
  half(0x41B6E6, -1); half(0xFF5A6E, 1);
  for (let i = 0; i < 3; i++) { const r = part(geo.ring(3 + i * 2.6, 0.06, 96), felt(P.cream), 0, 0.05, 0); r.rotation.x = Math.PI / 2; rug.add(r); }
  rug.add(part(geo.box(0.12, 0.04, 18, 0.02), felt(P.white), 0, 0.05, 0));
  // levels: puddles, clouds and star rings on both sides
  for (const s of [-1, 1]) {
    const puddle = part(geo.cyl(2.6, 2.6, 0.05, 40), glass(0x3cb8f0, 0.85), s * 4.2, 0.06, ROW.tub.z); puddle.scale.z = 0.45; rug.add(puddle);
    for (let i = 0; i < 6; i++) rug.add(part(geo.ball(16), felt(0xffffff), s * (2.0 + i * 0.9), ROW.sky.y - 0.25, ROW.sky.z + Math.sin(i * 2) * 0.3, 0.55, 0.28, 0.5));
    const hoop = part(geo.ring(2.6, 0.05, 48), plastic(P.plum), s * 4.2, ROW.moon.y - 0.15, ROW.moon.z); hoop.rotation.x = Math.PI / 2; hoop.scale.y = 0.5; rug.add(hoop);
    for (let i = 0; i < 5; i++) rug.add(part(starGeo(), plastic(P.sun, { glow: 0.3 }), s * (2.2 + i * 1.0), ROW.moon.y - 0.15, ROW.moon.z + (i % 2 ? 0.6 : -0.6), 0.22));
  }
  let tagOurs: THREE.Sprite | null = null, tagTheirs: THREE.Sprite | null = null;

  const toys = new Map<string, { ctl: ToyCtl; u: BonkUnit; side: number; hearts: THREE.Group }>();
  const root = new THREE.Group(); group.add(root);
  let markA: string | null = null, markT: string | null = null;
  const ringA = part(geo.ring(0.66, 0.07, 40), plastic(P.sun, { glow: 1 }), 0, 0.06, 0); ringA.rotation.x = Math.PI / 2; ringA.visible = false; group.add(ringA);
  const ringT = part(geo.ring(0.66, 0.07, 40), plastic(P.red, { glow: 0.8 }), 0, 0.06, 0); ringT.rotation.x = Math.PI / 2; ringT.visible = false; group.add(ringT);
  // a dashed arc from striker to mark: where the ball will go
  const dots: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) { const d = part(geo.ball(8), plastic(P.white, { glow: 0.5 }), 0, 0, 0, 0.06); d.visible = false; dots.push(d); group.add(d); }

  function heartRow(u: BonkUnit) {
    const g = new THREE.Group();
    const n = Math.max(1, u.max);
    for (let i = 0; i < n; i++) { const m = part(heartGeo(), plastic(i < u.health ? P.red : 0xF4C7CE, { glow: i < u.health ? 0.15 : 0 }), (i - (n - 1) / 2) * 0.22, 0, 0, 0.17); m.castShadow = false; g.add(m); }
    return g;
  }
  function posFor(u: BonkUnit, i: number, side: number): THREE.Vector3 {
    const R = ROW[u.realm];
    const x = side * (1.7 + i * 1.25 + (u.mat ? 0.6 : 0));
    const z = R.z + (u.mat ? -0.9 : 0) + (i % 2 ? 0.35 : -0.15);
    return new THREE.Vector3(x, R.y, z);
  }
  function place(list: BonkUnit[], side: number) {
    const rows = new Map<Realm, BonkUnit[]>();
    for (const u of list) (rows.get(u.realm) || rows.set(u.realm, []).get(u.realm)!).push(u);
    // their Bear and ours stand nearest the middle
    for (const r of rows.values()) r.sort((a, b) => (a.type === 1 ? -1 : 0) - (b.type === 1 ? -1 : 0) || (a.mat ? 1 : 0) - (b.mat ? 1 : 0) || a.type - b.type);
    const out = new Map<string, THREE.Vector3>();
    for (const r of rows.values()) r.forEach((u, i) => out.set(u.id, posFor(u, i, side)));
    return out;
  }

  const stage: BonkStage = {
    group,
    view: { pos: new THREE.Vector3(0, 9, 21), look: new THREE.Vector3(0, 1.4, 0), fitWidth: 16, fitHeight: 9 },
    spin: false,
    tick(t, dt) {
      for (const { ctl, hearts } of toys.values()) { ctl.tick(t, dt); hearts.rotation.y = -ctl.root.rotation.y + Math.sin(t * 2) * 0.25; }
      for (const [ring, id] of [[ringA, markA], [ringT, markT]] as const) {
        const tt = id ? toys.get(id) : undefined;
        ring.visible = !!tt;
        if (tt) { ring.position.copy(tt.ctl.root.position); ring.position.y += 0.05; ring.rotation.z = t * (ring === ringA ? 1 : -1); ring.scale.setScalar(1 + Math.sin(t * 5) * 0.06); }
      }
      // the aim: a hop of dots from striker to mark
      const a = markA ? toys.get(markA) : undefined, b = markT ? toys.get(markT) : undefined;
      dots.forEach((d, i) => {
        d.visible = !!a && !!b;
        if (!a || !b) return;
        const k = ((i / dots.length) + t * 0.25) % 1;
        const p0 = a.ctl.root.position.clone().add(new THREE.Vector3(0, a.ctl.height * 0.7, 0)), p1 = b.ctl.root.position.clone().add(new THREE.Vector3(0, b.ctl.height * 0.6, 0));
        d.position.lerpVectors(p0, p1, k); d.position.y += Math.sin(k * Math.PI) * (2 + p0.distanceTo(p1) * 0.12);
      });
      for (const { ctl, u } of toys.values()) if (u.realm === 'sky' || u.realm === 'moon') ctl.body.position.y += Math.sin(t * 1.5 + ctl.root.position.x) * 0.05;
    },
    pickables: () => [root],
    onPick: (id) => on.pick(id),
    onHover: (id) => on.hover?.(id),
    set(ours, theirs, o) {
      const want = new Map<string, { u: BonkUnit; side: number; pos: THREE.Vector3 }>();
      const po = place(ours, -1), pt = place(theirs, 1);
      for (const u of ours) want.set(u.id, { u, side: -1, pos: po.get(u.id)! });
      for (const u of theirs) want.set(u.id, { u, side: 1, pos: pt.get(u.id)! });
      for (const [id, t] of toys) if (!want.has(id)) { root.remove(t.ctl.root); t.ctl.dispose(); toys.delete(id); }
      for (const [id, w] of want) {
        let t = toys.get(id);
        if (!t) {
          const ctl = makeToy(w.u.type); ctl.root.userData.pick = id;
          ctl.root.rotation.y = w.side < 0 ? Math.PI / 2 - 0.35 : -Math.PI / 2 + 0.35;
          root.add(ctl.root);
          const hearts = heartRow(w.u); hearts.position.y = ctl.height + 0.35; ctl.root.add(hearts);
          t = { ctl, u: w.u, side: w.side, hearts };
          toys.set(id, t);
        } else if (t.u.health !== w.u.health || t.u.max !== w.u.max) {
          t.ctl.root.remove(t.hearts); t.hearts = heartRow(w.u); t.hearts.position.y = t.ctl.height + 0.35; t.ctl.root.add(t.hearts);
        }
        t.u = w.u;
        t.ctl.root.position.copy(w.pos);
        t.ctl.look({ sleep: w.u.sleep, hidden: w.u.hidden, picked: id === markA });
      }
      for (const [old, name, side] of [[tagOurs, o.oursName, -1], [tagTheirs, o.theirsName, 1]] as const) {
        if (old) { group.remove(old); old.material.map?.dispose(); }
        const s = name ? wordSprite(name, { bg: side < 0 ? '#0077C8' : '#E4002B', fg: '#FFFFFF', size: 0.62 }) : null;
        if (s) { s.position.set(side * 5.2, 7.0, -1.5); group.add(s); }
        if (side < 0) tagOurs = s; else tagTheirs = s;
      }
    },
    mark(kind, id) {
      if (kind === 'a') { const was = markA; markA = id; for (const x of [was, id]) { const t = x ? toys.get(x) : undefined; if (t) t.ctl.look({ sleep: t.u.sleep, hidden: t.u.hidden, picked: x === markA }); } }
      else markT = id;
    },
    strike(from, to, o) {
      const a = toys.get(from), b = toys.get(to);
      if (!a || !b) { o.done?.(); return; }
      a.ctl.squash(0.6);
      const p0 = a.ctl.root.position.clone().add(new THREE.Vector3(0, a.ctl.height * 0.7, 0));
      const p1 = b.ctl.root.position.clone().add(new THREE.Vector3(0, b.ctl.height * 0.55, 0));
      const missTo = p1.clone().add(new THREE.Vector3((b.side) * 2.5, 2.5, 1.5));
      const ballM = part(geo.ball(20), plastic(o.mine ? P.sun : P.peach, { glow: 0.25 }), p0.x, p0.y, p0.z, 0.24);
      group.add(ballM);
      const arc = 2 + p0.distanceTo(p1) * 0.12;
      tween(0.75, (k) => { ballM.position.lerpVectors(p0, p1, k); ballM.position.y += Math.sin(k * Math.PI) * arc; ballM.rotation.x = k * 12; }, { ease: ease.lin, done: () => {
        if (o.miss) {
          tween(0.6, (k) => { ballM.position.lerpVectors(p1, missTo, k); ballM.position.y += Math.sin(k * Math.PI) * 1.2; }, { done: () => group.remove(ballM) });
        } else {
          b.ctl.squash(1.2);
          confetti(group, p1, { n: 18, power: 1.8 });
          world.rumble(0.35);
          tween(0.25, (k) => ballM.scale.setScalar(0.24 * (1 - k)), { done: () => group.remove(ballM) });
        }
        o.done?.();
      } });
    },
    pop(id, text, tone) {
      const t = toys.get(id); if (!t) return;
      const fill = tone === 'hit' ? '#FFC72C' : tone === 'fell' ? '#FF8FB1' : tone === 'guard' ? '#B58BDB' : '#FFFFFF';
      const fg = tone === 'miss' ? '#0077C8' : '#E4002B';
      const s = burstSprite(text, fill, fg);
      const at = t.ctl.root.position.clone().add(new THREE.Vector3(0, t.ctl.height + 0.9, 0));
      s.position.copy(at); group.add(s);
      tween(1.4, (k) => { const pop = k < 0.2 ? ease.back(k / 0.2) : 1; s.scale.setScalar(1.6 * pop); s.position.y = at.y + k * 0.8; (s.material as THREE.SpriteMaterial).opacity = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1; }, { ease: ease.lin, done: () => { group.remove(s); s.material.map?.dispose(); s.material.dispose(); } });
    },
    fell(id) {
      const t = toys.get(id); if (!t) return;
      const r = t.ctl.root;
      const y0 = r.position.y;
      tween(0.9, (k) => { r.rotation.z = (t.side < 0 ? 1 : -1) * k * Math.PI * 0.5; r.position.y = y0 + Math.sin(k * Math.PI) * 0.8; }, { ease: ease.out, done: () => {
        confetti(group, r.position.clone().add(new THREE.Vector3(0, 0.5, 0)), { n: 50, power: 3, stars: true });
        tween(0.3, (k) => r.scale.setScalar(Math.max(0.001, 1 - k)), { done: () => { root.remove(r); t.ctl.dispose(); toys.delete(id); } });
      } });
    },
    anchor(id) { const t = toys.get(id); return t ? t.ctl.root.position.clone().add(new THREE.Vector3(0, t.ctl.height + 0.7, 0)).applyMatrix4(group.matrixWorld) : null; },
    dispose() { for (const { ctl } of toys.values()) ctl.dispose(); },
  };
  return stage;
}
