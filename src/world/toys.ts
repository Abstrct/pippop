/* The toys. Twenty-two of them, each built from chunky plastic shapes, each with its own little
 * life: wheels turn, rotors spin, the popper pops, the duck bobs. A toy stands on y = 0, about one
 * unit tall, facing +z. */
import * as THREE from 'three';
import { P, plastic, glass, geo, part, ball, wordSprite, starGeo } from './kit';

export interface ToyLook { sleep?: boolean; hidden?: boolean; building?: boolean; picked?: boolean; hover?: boolean; hug?: boolean }
export interface ToyCtl {
  root: THREE.Group;       // place this
  body: THREE.Group;       // bounces and squashes
  typeId: number;
  height: number;
  tick(t: number, dt: number): void;
  look(l: ToyLook): void;
  squash(power?: number): void;
  /** A progress pill over the toy (being made, digging, popping): 0..1 and a short time, or null. */
  progress(frac: number | null, color?: string, label?: string): void;
  dispose(): void;
}

type Spin = { o: THREE.Object3D; axis: 'x' | 'y' | 'z'; speed: number };

/** Two shiny eyes and a smile. */
function face(par: THREE.Object3D, x: number, y: number, z: number, s = 1, eyes: THREE.Object3D[] = []) {
  const e = s * 0.055;
  for (const sx of [-1, 1]) {
    const eye = part(geo.ball(14), plastic(P.ink, { rough: 0.15 }), x + sx * 0.1 * s, y, z, e, e * 1.25, e * 0.7);
    const hi = part(geo.ball(8), plastic(P.white, { glow: 0.6 }), 0.35, 0.4, 0.8, 0.35);
    eye.add(hi);
    par.add(eye); eyes.push(eye);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.075 * s, 0.017 * s, 8, 16, Math.PI), plastic(P.ink));
  smile.position.set(x, y - 0.09 * s, z); smile.rotation.z = Math.PI;
  par.add(smile);
  return eyes;
}
function wheel(par: THREE.Object3D, x: number, y: number, z: number, r: number, tire: number = P.black, hub: number = P.sun, spins?: Spin[]) {
  const w = new THREE.Group(); w.position.set(x, y, z);
  const t = part(geo.cyl(r, r, r * 0.6, 24), plastic(tire, { rough: 0.6 })); t.rotation.z = Math.PI / 2; w.add(t);
  const hb = part(geo.cyl(r * 0.5, r * 0.5, r * 0.66, 16), plastic(hub)); hb.rotation.z = Math.PI / 2; w.add(hb);
  par.add(w); spins?.push({ o: w, axis: 'x', speed: 3 });
  return w;
}

export function makeToy(typeId: number): ToyCtl {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const spins: Spin[] = [];
  const eyes: THREE.Object3D[] = [];
  let life: (t: number, dt: number) => void = () => {};
  let height = 1;
  const add = (o: THREE.Object3D) => { body.add(o); return o; };

  switch (typeId) {
    case 1: { // Bear — the boss, with a crown
      add(part(geo.ball(), plastic(P.brown), 0, 0.45, 0, 0.42, 0.44, 0.4));
      add(part(geo.ball(), plastic(P.tan), 0, 0.42, 0.24, 0.25, 0.27, 0.18));
      add(part(geo.ball(), plastic(P.brown), 0, 1.0, 0, 0.34));
      for (const sx of [-1, 1]) {
        add(part(geo.ball(), plastic(P.brown), sx * 0.25, 1.27, -0.02, 0.12));
        add(part(geo.ball(), plastic(P.pink), sx * 0.25, 1.27, 0.06, 0.07, 0.07, 0.04));
        add(part(geo.ball(), plastic(P.brown), sx * 0.42, 0.55, 0.08, 0.13, 0.17, 0.13));
        add(part(geo.ball(), plastic(P.brown), sx * 0.2, 0.1, 0.16, 0.15, 0.1, 0.17));
      }
      add(part(geo.ball(), plastic(P.tan), 0, 0.93, 0.27, 0.15, 0.11, 0.1));
      add(part(geo.ball(14), plastic(P.ink, { rough: 0.15 }), 0, 0.98, 0.36, 0.05, 0.04, 0.035));
      face(body, 0, 1.08, 0.3, 0.9, eyes);
      body.children[body.children.length - 1].visible = false; // the snout is the smile
      const crown = new THREE.Group(); crown.position.set(0, 1.34, 0);
      crown.add(part(geo.cyl(0.15, 0.15, 0.1, 20), plastic(P.sun, { glow: 0.08 })));
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; crown.add(part(geo.cone(0.045, 0.12, 10), plastic(P.sun, { glow: 0.08 }), Math.cos(a) * 0.12, 0.1, Math.sin(a) * 0.12)); }
      crown.add(part(geo.ball(12), plastic(P.red, { glow: 0.15 }), 0, 0.02, 0.15, 0.04));
      add(crown);
      for (const sx of [-1, 1]) { const c = part(geo.cone(0.08, 0.14, 12), plastic(P.red), sx * 0.07, 0.74, 0.3); c.rotation.z = sx * Math.PI / 2; add(c); }
      height = 1.45;
      life = (t) => { crown.rotation.y = Math.sin(t * 1.3) * 0.2; };
      break;
    }
    case 2: { // Rocket
      add(part(geo.cyl(0.2, 0.26, 0.78, 28), plastic(P.white), 0, 0.62, 0));
      add(part(geo.cone(0.2, 0.36, 28), plastic(P.red), 0, 1.19, 0));
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const f = part(geo.box(0.06, 0.32, 0.22, 0.03), plastic(P.blue), Math.sin(a) * 0.27, 0.36, Math.cos(a) * 0.27); f.rotation.y = a; add(f); }
      add(part(geo.ring(0.1, 0.03, 24), plastic(P.sun), 0, 0.78, 0.23));
      add(part(geo.ball(16), glass(P.sky, 0.7), 0, 0.78, 0.22, 0.09, 0.09, 0.05));
      const flame = part(geo.cone(0.15, 0.36, 16), plastic(P.peach, { glow: 0.9 }), 0, 0.08, 0); flame.rotation.x = Math.PI; add(flame);
      const core = part(geo.cone(0.08, 0.22, 12), plastic(P.sun, { glow: 1.2 }), 0, 0.14, 0); core.rotation.x = Math.PI; add(core);
      height = 1.4;
      life = (t) => { const k = 0.85 + Math.sin(t * 30) * 0.15; flame.scale.set(1, k, 1); core.scale.set(1, 1.1 - (k - 0.85), 1); };
      break;
    }
    case 3: { // Zoom — a little star racer
      const c = part(geo.capsule(0.17, 0.5), plastic(P.sun), 0, 0.45, 0); c.rotation.x = Math.PI / 2; add(c);
      add(part(geo.ball(16), glass(P.sky, 0.7), 0, 0.6, 0.06, 0.12, 0.1, 0.16));
      for (const sx of [-1, 1]) { const f = part(geo.box(0.36, 0.05, 0.2, 0.025), plastic(P.red), sx * 0.22, 0.42, -0.18); f.rotation.z = sx * 0.3; add(f); }
      const tail = part(geo.box(0.05, 0.22, 0.18, 0.025), plastic(P.red), 0, 0.62, -0.3); add(tail);
      const fl = part(geo.cone(0.12, 0.3, 14), plastic(P.peach, { glow: 1 }), 0, 0.45, -0.52); fl.rotation.x = -Math.PI / 2; add(fl);
      face(body, 0, 0.47, 0.42, 0.7, eyes);
      height = 0.9;
      life = (t) => { fl.scale.set(1, 0.8 + Math.sin(t * 34) * 0.2, 1); };
      break;
    }
    case 4: { // Saucer — with a little green friend
      add(part(geo.ball(32), plastic(P.plum), 0, 0.4, 0, 0.58, 0.16, 0.58));
      add(part(geo.ring(0.5, 0.05, 40), plastic(P.sun), 0, 0.4, 0)).rotation.x = Math.PI / 2;
      add(part(geo.ball(14), plastic(P.leaf), 0, 0.58, 0, 0.12));
      face(body, 0, 0.6, 0.11, 0.55, eyes);
      add(part(geo.ball(28), glass(P.sky, 0.35), 0, 0.5, 0, 0.27, 0.24, 0.27));
      const bulbs: THREE.Mesh[] = [];
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const b = part(geo.ball(10), plastic(i % 2 ? P.red : P.sun, { glow: 0.5 }), Math.cos(a) * 0.5, 0.36, Math.sin(a) * 0.5, 0.055); bulbs.push(b); add(b); }
      height = 0.85;
      life = (t) => { body.rotation.y = t * 0.6; bulbs.forEach((b, i) => b.scale.setScalar(0.04 + 0.025 * (Math.sin(t * 6 + i) > 0 ? 1 : 0))); };
      break;
    }
    case 5: { // Plane
      const f = part(geo.capsule(0.14, 0.55), plastic(P.red), 0, 0.5, 0); f.rotation.x = Math.PI / 2; add(f);
      add(part(geo.box(1.1, 0.06, 0.26, 0.03), plastic(P.sun), 0, 0.5, 0.05));
      add(part(geo.box(0.42, 0.05, 0.14, 0.02), plastic(P.blue), 0, 0.56, -0.38));
      add(part(geo.box(0.05, 0.22, 0.16, 0.02), plastic(P.blue), 0, 0.66, -0.38));
      add(part(geo.ball(14), glass(P.sky, 0.7), 0, 0.62, 0.1, 0.1, 0.08, 0.13));
      const prop = new THREE.Group(); prop.position.set(0, 0.5, 0.44);
      prop.add(part(geo.box(0.5, 0.07, 0.03, 0.02), plastic(P.white)));
      prop.add(part(geo.ball(12), plastic(P.sun), 0, 0, 0.02, 0.06));
      add(prop); spins.push({ o: prop, axis: 'z', speed: 22 });
      face(body, 0, 0.5, 0.36, 0.6, eyes);
      height = 0.8;
      life = (t) => { body.rotation.z = Math.sin(t * 1.4) * 0.12; };
      break;
    }
    case 6: { // Kite — with a waving bow tail
      const s = new THREE.Shape(); s.moveTo(0, 0.5); s.lineTo(0.34, 0.08); s.lineTo(0, -0.5); s.lineTo(-0.34, 0.08); s.closePath();
      const kg = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
      const kite = new THREE.Mesh(kg, plastic(P.peach)); kite.position.set(0, 0.85, 0); kite.castShadow = true; add(kite);
      const top = new THREE.Shape(); top.moveTo(0, 0.5); top.lineTo(0.34, 0.08); top.lineTo(0, 0.08); top.closePath();
      const tm = new THREE.Mesh(new THREE.ExtrudeGeometry(top, { depth: 0.05, bevelEnabled: false }), plastic(P.sun)); tm.position.set(0, 0.85, 0.01); add(tm);
      const bot = new THREE.Shape(); bot.moveTo(0, -0.5); bot.lineTo(-0.34, 0.08); bot.lineTo(0, 0.08); bot.closePath();
      const bm = new THREE.Mesh(new THREE.ExtrudeGeometry(bot, { depth: 0.05, bevelEnabled: false }), plastic(P.sun)); bm.position.set(0, 0.85, 0.01); add(bm);
      add(part(geo.box(0.03, 1.0, 0.03, 0.01), plastic(P.white), 0, 0.85, 0.07));
      add(part(geo.box(0.68, 0.03, 0.03, 0.01), plastic(P.white), 0, 0.93, 0.07));
      face(body, 0, 0.92, 0.09, 0.8, eyes);
      const bows: THREE.Mesh[] = [];
      for (let i = 0; i < 4; i++) { const b = part(geo.ball(10), plastic([P.red, P.blue, P.leaf, P.plum][i]), 0, 0.3 - i * 0.12, 0, 0.06, 0.04, 0.04); bows.push(b); add(b); }
      height = 1.35;
      life = (t) => { body.rotation.z = Math.sin(t * 1.7) * 0.18; bows.forEach((b, i) => { b.position.x = Math.sin(t * 4 - i * 0.9) * 0.08 * (i + 1); }); };
      break;
    }
    case 7: { // Copter
      add(part(geo.ball(28), plastic(P.blue), 0, 0.5, 0.05, 0.32, 0.28, 0.36));
      add(part(geo.ball(20), glass(P.sky, 0.65), 0, 0.56, 0.24, 0.2, 0.16, 0.14));
      const boom = part(geo.cyl(0.05, 0.08, 0.55, 12), plastic(P.blue), 0, 0.55, -0.42); boom.rotation.x = Math.PI / 2; add(boom);
      const tr = new THREE.Group(); tr.position.set(0.06, 0.6, -0.68); tr.add(part(geo.box(0.02, 0.26, 0.05, 0.01), plastic(P.sun))); add(tr); spins.push({ o: tr, axis: 'x', speed: 18 });
      add(part(geo.cyl(0.03, 0.03, 0.14, 8), plastic(P.ink), 0, 0.84, 0.05));
      const rotor = new THREE.Group(); rotor.position.set(0, 0.92, 0.05);
      rotor.add(part(geo.box(1.1, 0.03, 0.09, 0.015), plastic(P.sun)));
      rotor.add(part(geo.box(0.09, 0.03, 1.1, 0.015), plastic(P.sun)));
      rotor.add(part(geo.ball(12), plastic(P.red), 0, 0.02, 0, 0.06));
      add(rotor); spins.push({ o: rotor, axis: 'y', speed: 16 });
      for (const sx of [-1, 1]) { const sk = part(geo.capsule(0.03, 0.55), plastic(P.ink), sx * 0.22, 0.14, 0.05); sk.rotation.x = Math.PI / 2; add(sk); add(part(geo.cyl(0.02, 0.02, 0.16, 6), plastic(P.ink), sx * 0.2, 0.22, 0.05)); }
      face(body, 0, 0.42, 0.37, 0.65, eyes);
      height = 1.0;
      break;
    }
    case 8: { // Choo — a little engine
      add(part(geo.box(0.42, 0.5, 0.4, 0.07), plastic(P.red), 0, 0.5, -0.22));
      add(part(geo.box(0.48, 0.07, 0.48, 0.03), plastic(P.sun), 0, 0.78, -0.22));
      add(part(geo.box(0.26, 0.18, 0.02, 0.03), glass(P.sky, 0.8), 0, 0.58, -0.01));
      const boiler = part(geo.cyl(0.18, 0.18, 0.5, 24), plastic(P.blue), 0, 0.42, 0.2); boiler.rotation.x = Math.PI / 2; add(boiler);
      add(part(geo.cyl(0.06, 0.09, 0.22, 14), plastic(P.ink), 0, 0.7, 0.3));
      add(part(geo.cyl(0.19, 0.19, 0.05, 24), plastic(P.sun), 0, 0.42, 0.46)).rotation.x = Math.PI / 2;
      face(body, 0, 0.44, 0.49, 0.9, eyes);
      for (const z of [-0.22, 0.2]) for (const sx of [-1, 1]) wheel(body, sx * 0.24, 0.15, z, 0.14, P.sun, P.red, spins);
      const puff = part(geo.ball(14), plastic(P.white, { rough: 0.9 }), 0, 0.88, 0.3, 0.1); add(puff);
      height = 0.95;
      life = (t) => { const k = (t * 0.9) % 1; puff.position.y = 0.85 + k * 0.5; puff.scale.setScalar(0.06 + k * 0.12); (puff.material as THREE.Material).opacity = 1; puff.visible = k < 0.9; };
      break;
    }
    case 9: { // Truck — a dump truck
      add(part(geo.box(0.42, 0.42, 0.34, 0.07), plastic(P.red), 0, 0.45, 0.24));
      add(part(geo.box(0.3, 0.16, 0.02, 0.03), glass(P.sky, 0.8), 0, 0.55, 0.42));
      const bed = new THREE.Group(); bed.position.set(0, 0.36, -0.06);
      bed.add(part(geo.box(0.5, 0.26, 0.52, 0.06), plastic(P.sun), 0, 0.12, -0.24));
      add(bed);
      add(part(geo.box(0.46, 0.08, 0.86, 0.03), plastic(P.ink), 0, 0.26, 0.0));
      for (const z of [-0.3, 0.26]) for (const sx of [-1, 1]) wheel(body, sx * 0.26, 0.16, z, 0.16, P.black, P.sun, spins);
      face(body, 0, 0.36, 0.42, 0.8, eyes);
      height = 0.75;
      life = (t) => { bed.rotation.x = -Math.max(0, Math.sin(t * 0.7)) * 0.35; };
      break;
    }
    case 10: { // Squirt — a water squirter that shoots up
      add(part(geo.box(0.46, 0.3, 0.46, 0.08), plastic(P.leaf), 0, 0.15, 0));
      add(part(geo.ball(24), plastic(P.sky), 0, 0.46, 0, 0.24));
      const noz = part(geo.cyl(0.06, 0.09, 0.42, 14), plastic(P.peach), 0, 0.72, 0.1); noz.rotation.x = 0.5; add(noz);
      face(body, 0, 0.47, 0.22, 0.7, eyes);
      const drops: THREE.Mesh[] = [];
      for (let i = 0; i < 6; i++) { const d = part(geo.ball(10), glass(P.sky, 0.75), 0, 0, 0, 0.05); drops.push(d); add(d); }
      height = 1.0;
      life = (t) => drops.forEach((d, i) => { const k = (t * 0.8 + i / 6) % 1; d.position.set(0, 0.9 + k * 1.1 - k * k * 0.9, 0.2 + k * 0.6); d.scale.setScalar(0.05 * (1 - k * 0.6)); });
      break;
    }
    case 11: { // Duck — the bath duck
      add(part(geo.ball(28), plastic(P.sun), 0, 0.32, 0, 0.42, 0.3, 0.36));
      add(part(geo.ball(24), plastic(P.sun), 0, 0.72, 0.12, 0.22));
      const beak = part(geo.ball(16), plastic(P.peach), 0, 0.68, 0.34, 0.1, 0.05, 0.11); add(beak);
      face(body, 0, 0.78, 0.3, 0.7, eyes);
      body.children[body.children.length - 1].visible = false;
      for (const sx of [-1, 1]) add(part(geo.ball(16), plastic(P.sun), sx * 0.34, 0.36, -0.02, 0.1, 0.16, 0.24));
      add(part(geo.cone(0.12, 0.2, 12), plastic(P.sun), 0, 0.46, -0.36)).rotation.x = -1.1;
      height = 0.95;
      life = (t) => { body.rotation.z = Math.sin(t * 2) * 0.08; body.rotation.x = Math.sin(t * 1.3) * 0.05; };
      break;
    }
    case 12: { // Boat — a sailboat
      add(part(geo.box(0.42, 0.22, 0.86, 0.1), plastic(P.red), 0, 0.15, 0));
      add(part(geo.cone(0.21, 0.3, 4), plastic(P.red), 0, 0.15, 0.5)).rotation.set(Math.PI / 2, Math.PI / 4, 0);
      add(part(geo.cyl(0.025, 0.025, 1.0, 8), plastic(P.white), 0, 0.72, -0.02));
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0, 0.78); s.lineTo(0.5, 0); s.closePath();
      const sail = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 }), plastic(P.sun));
      sail.position.set(0.0, 0.32, 0.03); sail.rotation.y = -Math.PI / 2; sail.castShadow = true; add(sail);
      const flag = part(geo.box(0.16, 0.08, 0.02, 0.01), plastic(P.blue), 0.08, 1.18, -0.02); add(flag);
      height = 1.25;
      life = (t) => { body.rotation.z = Math.sin(t * 1.6) * 0.07; flag.rotation.y = Math.sin(t * 6) * 0.4; };
      break;
    }
    case 13: { // Fish
      add(part(geo.ball(28), plastic(P.peach), 0, 0.42, 0.05, 0.22, 0.24, 0.38));
      const tail = part(geo.cone(0.2, 0.26, 4), plastic(P.sun), 0, 0.42, -0.42); tail.rotation.x = -Math.PI / 2; tail.scale.set(0.3, 1, 1); add(tail);
      add(part(geo.cone(0.1, 0.2, 4), plastic(P.sun), 0, 0.66, -0.05)).scale.set(0.3, 1, 1);
      for (const sx of [-1, 1]) {
        const e = part(geo.ball(14), plastic(P.white), sx * 0.15, 0.5, 0.22, 0.07);
        e.add(part(geo.ball(10), plastic(P.ink, { rough: 0.15 }), sx * 0.2, 0.05, 0.6, 0.6));
        add(e); eyes.push(e);
      }
      add(part(geo.ring(0.05, 0.018, 12), plastic(P.red), 0, 0.36, 0.42));
      height = 0.75;
      life = (t) => { tail.rotation.y = Math.sin(t * 7) * 0.5; body.rotation.y = Math.sin(t * 1.2) * 0.25; };
      break;
    }
    case 14: { // Digger
      for (const sx of [-1, 1]) { const tr = part(geo.capsule(0.11, 0.5), plastic(P.black, { rough: 0.7 }), sx * 0.22, 0.12, 0); tr.rotation.x = Math.PI / 2; add(tr); }
      add(part(geo.box(0.5, 0.26, 0.6, 0.07), plastic(P.sun), 0, 0.34, 0));
      add(part(geo.box(0.3, 0.3, 0.28, 0.06), plastic(P.sun), -0.06, 0.62, -0.08));
      add(part(geo.box(0.22, 0.16, 0.02, 0.03), glass(P.sky, 0.8), -0.06, 0.66, 0.07));
      face(body, 0.12, 0.38, 0.31, 0.7, eyes);
      const arm = new THREE.Group(); arm.position.set(0.14, 0.52, 0.12);
      const a1 = part(geo.box(0.08, 0.08, 0.46, 0.03), plastic(P.peach), 0, 0.1, 0.2); a1.rotation.x = -0.6; arm.add(a1);
      const fore = new THREE.Group(); fore.position.set(0, 0.24, 0.38);
      fore.add(part(geo.box(0.07, 0.36, 0.07, 0.03), plastic(P.peach), 0, -0.16, 0));
      const bucket = part(geo.box(0.2, 0.12, 0.14, 0.04), plastic(P.blue), 0, -0.36, 0.04); fore.add(bucket);
      arm.add(fore); add(arm);
      height = 0.9;
      life = (t) => { const k = Math.sin(t * 1.5); arm.rotation.x = k * 0.25; fore.rotation.x = -0.3 + k * 0.35; };
      break;
    }
    case 15: { // Popper — the classic: balls pop inside a clear dome
      add(part(geo.ball(32), glass(0xffffff, 0.28), 0, 0.5, 0, 0.36));
      for (const sx of [-1, 1]) {
        const w = new THREE.Group(); w.position.set(sx * 0.38, 0.32, 0);
        const d = part(geo.cyl(0.32, 0.32, 0.06, 32), plastic(sx < 0 ? P.sun : P.blue)); d.rotation.z = Math.PI / 2; w.add(d);
        const r = part(geo.ring(0.3, 0.04, 32), plastic(P.red)); r.rotation.y = Math.PI / 2; w.add(r);
        w.add(part(geo.ball(12), plastic(P.red), sx * 0.04, 0, 0, 0.07));
        add(w); spins.push({ o: w, axis: 'x', speed: 1.4 });
      }
      add(part(geo.cyl(0.02, 0.02, 0.8, 8), plastic(P.ink), 0, 0.32, 0)).rotation.z = Math.PI / 2;
      const stick = part(geo.cyl(0.03, 0.03, 1.05, 10), plastic(P.blue), 0, 0.82, -0.42); stick.rotation.x = -0.75; add(stick);
      add(part(geo.ball(16), plastic(P.red), 0, 1.22, -0.8, 0.08));
      const pops: THREE.Mesh[] = [];
      for (let i = 0; i < 6; i++) { const b = part(geo.ball(14), plastic([P.red, P.sun, P.leaf, P.plum, P.peach, P.pink][i], { glow: 0.12 }), 0, 0.3, 0, 0.075); pops.push(b); add(b); }
      height = 1.0;
      life = (t) => pops.forEach((b, i) => { const ph = t * 2.2 + i * 1.7; const k = Math.abs(Math.sin(ph)); b.position.set(Math.cos(i * 2.4 + t * 0.5) * 0.18, 0.24 + k * 0.42, Math.sin(i * 2.4 + t * 0.5) * 0.18); });
      break;
    }
    case 16: { // Bubble — a wand and a big wobbly bubble
      const stick = part(geo.cyl(0.03, 0.03, 0.6, 8), plastic(P.plum), 0, 0.3, 0); add(stick);
      const wand = part(geo.ring(0.24, 0.04, 28), plastic(P.plum), 0, 0.74, 0); add(wand);
      const bub = part(geo.ball(40), glass(0xffffff, 0.3), 0, 1.15, 0, 0.42); add(bub);
      height = 1.6;
      life = (t) => { bub.scale.set(0.42 + Math.sin(t * 3) * 0.02, 0.42 + Math.cos(t * 2.6) * 0.025, 0.42 + Math.sin(t * 2.2) * 0.02); bub.position.y = 1.15 + Math.sin(t * 1.4) * 0.05; };
      break;
    }
    case 17: { // Rattle
      const r = new THREE.Group(); r.position.y = 0.1;
      r.add(part(geo.cyl(0.06, 0.06, 0.5, 12), plastic(P.sun), 0, 0.28, 0));
      r.add(part(geo.ring(0.11, 0.04, 20), plastic(P.sky), 0, 0.04, 0)).rotation.x = Math.PI / 2;
      r.add(part(geo.ball(28), plastic(P.pink), 0, 0.72, 0, 0.3));
      r.add(part(geo.ring(0.3, 0.035, 32), plastic(P.sun), 0, 0.72, 0)).rotation.x = Math.PI / 2;
      const r2 = part(geo.ring(0.3, 0.035, 32), plastic(P.sky), 0, 0.72, 0); r2.rotation.y = Math.PI / 2; r.add(r2);
      face(r, 0, 0.74, 0.3, 0.8, eyes);
      add(r);
      height = 1.1;
      life = (t) => { r.rotation.z = Math.sin(t * 9) * 0.18 * (Math.sin(t * 0.8) > 0.4 ? 1 : 0.2); };
      break;
    }
    case 18: { // Piggy — keeps rocks safe
      add(part(geo.ball(28), plastic(P.pink), 0, 0.42, 0, 0.42, 0.34, 0.36));
      const sn = part(geo.cyl(0.12, 0.13, 0.1, 20), plastic(0xFF6F9F), 0, 0.42, 0.37); sn.rotation.x = Math.PI / 2; add(sn);
      for (const sx of [-1, 1]) add(part(geo.ball(8), plastic(P.ink), sx * 0.045, 0.42, 0.42, 0.025));
      for (const sx of [-1, 1]) { const e = part(geo.cone(0.09, 0.16, 10), plastic(0xFF6F9F), sx * 0.2, 0.74, 0.08); e.rotation.z = -sx * 0.4; add(e); }
      for (const [x, z] of [[-0.22, 0.16], [0.22, 0.16], [-0.22, -0.16], [0.22, -0.16]]) add(part(geo.cyl(0.07, 0.08, 0.18, 12), plastic(P.pink), x, 0.09, z));
      add(part(geo.box(0.16, 0.03, 0.04, 0.01), plastic(P.ink), 0, 0.76, -0.05));
      add(part(geo.ring(0.06, 0.02, 14), plastic(P.pink), 0, 0.5, -0.38)).rotation.y = Math.PI / 2;
      face(body, 0, 0.6, 0.31, 0.75, eyes);
      body.children[body.children.length - 1].visible = false;
      height = 0.85;
      break;
    }
    case 19: { // Popgun — a cork cannon
      add(part(geo.box(0.42, 0.18, 0.5, 0.05), plastic(P.sun), 0, 0.24, -0.04));
      const barrel = new THREE.Group(); barrel.position.set(0, 0.4, 0); barrel.rotation.x = -0.5;
      barrel.add(part(geo.cyl(0.13, 0.16, 0.7, 20), plastic(P.blue), 0, 0, 0.18).rotateX(Math.PI / 2));
      barrel.add(part(geo.ring(0.14, 0.035, 20), plastic(P.sun), 0, 0, 0.52));
      const cork = part(geo.cyl(0.1, 0.08, 0.14, 14), plastic(P.red), 0, 0, 0.58); cork.rotation.x = Math.PI / 2; barrel.add(cork);
      add(barrel);
      for (const sx of [-1, 1]) wheel(body, sx * 0.26, 0.18, -0.04, 0.18, P.red, P.sun);
      face(body, 0, 0.27, 0.22, 0.6, eyes);
      height = 0.9;
      life = (t) => { const k = (t * 0.35) % 1; cork.position.z = k < 0.08 ? 0.58 + k * 6 : 0.58; };
      break;
    }
    case 20: { // Pinwheel
      add(part(geo.cyl(0.03, 0.03, 1.0, 8), plastic(P.white), 0, 0.5, 0));
      const hub = new THREE.Group(); hub.position.set(0, 1.0, 0.06);
      const cols = [P.red, P.blue, P.sun, P.leaf];
      for (let i = 0; i < 4; i++) {
        const bl = new THREE.Group(); bl.rotation.z = (i / 4) * Math.PI * 2;
        const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.05, 0.36, 0.3, 0.38); s.lineTo(0.02, 0.02); s.closePath();
        const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }), plastic(cols[i])); m.castShadow = true;
        bl.add(m); hub.add(bl);
      }
      hub.add(part(geo.ball(12), plastic(P.sun), 0, 0, 0.03, 0.06));
      add(hub); spins.push({ o: hub, axis: 'z', speed: 5 });
      height = 1.4;
      break;
    }
    case 21: { // Windmill
      add(part(geo.cyl(0.2, 0.36, 1.0, 8), plastic(P.plum), 0, 0.5, 0));
      add(part(geo.cone(0.27, 0.32, 8), plastic(P.red), 0, 1.16, 0));
      add(part(geo.box(0.14, 0.22, 0.04, 0.05), plastic(P.sun), 0, 0.12, 0.31));
      add(part(geo.ball(12), glass(P.sky, 0.8), 0, 0.62, 0.25, 0.07));
      const hub = new THREE.Group(); hub.position.set(0, 0.95, 0.27);
      for (let i = 0; i < 4; i++) {
        const sail = new THREE.Group(); sail.rotation.z = (i / 4) * Math.PI * 2 + 0.3;
        sail.add(part(geo.box(0.04, 0.7, 0.03, 0.01), plastic(P.white), 0, 0.38, 0));
        sail.add(part(geo.box(0.18, 0.55, 0.02, 0.02), plastic(P.cream), 0.1, 0.45, 0));
        hub.add(sail);
      }
      hub.add(part(geo.ball(12), plastic(P.sun), 0, 0, 0.02, 0.07));
      add(hub); spins.push({ o: hub, axis: 'z', speed: 1.2 });
      height = 1.7;
      break;
    }
    case 22: { // Sun — the big one, smiling
      add(part(geo.cyl(0.08, 0.1, 0.5, 10), plastic(P.white), 0, 0.25, 0));
      add(part(geo.ball(18), plastic(P.white, { rough: 0.9 }), 0, 0.08, 0, 0.32, 0.12, 0.32));
      const sun = new THREE.Group(); sun.position.y = 0.95;
      sun.add(part(geo.ball(32), plastic(P.sun, { glow: 0.35 }), 0, 0, 0, 0.42));
      face(sun, 0, 0.06, 0.4, 1.4, eyes);
      const rays = new THREE.Group();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const c = part(geo.cone(0.09, 0.24, 10), plastic(P.peach, { glow: 0.25 }), Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0); c.rotation.z = a - Math.PI / 2; rays.add(c); }
      sun.add(rays); add(sun);
      height = 1.6;
      life = (t) => { rays.rotation.z = t * 0.5; sun.position.y = 0.95 + Math.sin(t * 1.5) * 0.04; };
      break;
    }
    default: {
      add(part(geo.box(0.6, 0.6, 0.6, 0.12), plastic(P.sky), 0, 0.3, 0));
      add(part(starGeo(), plastic(P.sun), 0, 0.3, 0.31, 0.5));
    }
  }

  /* ── state on top of every toy ── */
  const zzz = wordSprite('Zzz', { bg: 'none', fg: '#41B6E6', outline: '#FFFFFF', size: 0.38 });
  zzz.position.set(0.3, height + 0.2, 0); zzz.visible = false; root.add(zzz);
  // a gift box that wraps a toy still being made
  const gift = new THREE.Group(); gift.visible = false;
  gift.add(part(geo.box(0.9, 0.8, 0.9, 0.08), glass(P.red, 0.55), 0, 0.42, 0));
  gift.add(part(geo.box(0.14, 0.84, 0.94, 0.03), plastic(P.sun), 0, 0.42, 0));
  gift.add(part(geo.box(0.94, 0.84, 0.14, 0.03), plastic(P.sun), 0, 0.42, 0));
  for (const sx of [-1, 1]) { const b = part(geo.ring(0.13, 0.05, 16), plastic(P.sun), sx * 0.12, 0.92, 0); b.rotation.set(0, Math.PI / 2, sx * 0.6); gift.add(b); }
  root.add(gift);
  // a halo that shows the chosen toy
  const halo = part(geo.ring(0.62, 0.05, 48), plastic(P.white, { glow: 0.6 }), 0, 0.04, 0); halo.rotation.x = Math.PI / 2; halo.visible = false; halo.castShadow = false; root.add(halo);
  const hugRing = part(geo.ring(0.55, 0.035, 40), plastic(P.pink, { glow: 0.5 }), 0, 0.1, 0); hugRing.rotation.x = Math.PI / 2; hugRing.visible = false; root.add(hugRing);

  // the progress pill: a camera-facing sprite redrawn only when what it says changes
  const pc = document.createElement('canvas'); pc.width = 256; pc.height = 64;
  const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace;
  const pill = new THREE.Sprite(new THREE.SpriteMaterial({ map: ptex, depthTest: false, depthWrite: false, transparent: true }));
  pill.scale.set(1.1, 0.275, 1); pill.renderOrder = 12; pill.visible = false; root.add(pill);
  let pillSig = '';
  function drawPill(frac: number, color: string, label: string) {
    const x = pc.getContext('2d')!;
    x.clearRect(0, 0, 256, 64);
    const r = 28;
    const rr = (a: number, b: number, w: number, h: number, rad: number) => { x.beginPath(); x.moveTo(a + rad, b); x.arcTo(a + w, b, a + w, b + h, rad); x.arcTo(a + w, b + h, a, b + h, rad); x.arcTo(a, b + h, a, b, rad); x.arcTo(a, b, a + w, b, rad); x.closePath(); };
    x.fillStyle = '#1D2A5C'; rr(2, 2, 252, 60, r + 2); x.fill();
    x.fillStyle = '#FFFFFF'; rr(7, 7, 242, 50, r - 3); x.fill();
    const w = Math.max(50, 160 * frac);
    x.fillStyle = color; rr(9, 9, w, 46, r - 5); x.fill();
    x.fillStyle = '#1D2A5C'; x.font = '700 32px Fredoka, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(label, 210, 34);
    ptex.needsUpdate = true;
  }

  let L: ToyLook = {};
  let squashT = -1, squashP = 1;
  const fading: THREE.Material[] = [];
  const origMats = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  function setHidden(on: boolean) {
    body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (on) {
        if (!origMats.has(m)) origMats.set(m, m.material);
        const src = origMats.get(m) as THREE.Material;
        const c = src.clone(); c.transparent = true; (c as THREE.MeshStandardMaterial).opacity = 0.32; c.depthWrite = false;
        fading.push(c); m.material = c;
      } else if (origMats.has(m)) { m.material = origMats.get(m)!; }
    });
    if (!on) { fading.forEach((m) => m.dispose()); fading.length = 0; origMats.clear(); }
  }

  const ctl: ToyCtl = {
    root, body, typeId, height,
    tick(t, dt) {
      for (const s of spins) s.o.rotation[s.axis] += s.speed * dt * (L.sleep || L.building ? 0.05 : 1);
      if (!L.sleep && !L.building) life(t, dt);
      // breathing, hopping when chosen
      const hop = L.picked ? Math.abs(Math.sin(t * 4)) * 0.12 : L.hover ? Math.abs(Math.sin(t * 6)) * 0.05 : 0;
      body.position.y = hop;
      let sx = 1, sy = 1;
      if (L.sleep) { sy = 1 + Math.sin(t * 1.6) * 0.02; body.rotation.z = 0.22; }
      else if (!L.picked) sy = 1 + Math.sin(t * 2.4 + typeId) * 0.015;
      if (squashT >= 0) {
        squashT += dt;
        const k = squashT / 0.5;
        if (k >= 1) squashT = -1;
        else { const w = Math.sin(k * Math.PI * 3) * (1 - k) * 0.35 * squashP; sy -= w; sx += w * 0.6; }
      }
      body.scale.set(sx, sy, sx);
      if (L.building) { gift.rotation.z = Math.sin(t * 18) * 0.05 * (Math.sin(t * 2) > 0 ? 1 : 0.2); gift.rotation.x = Math.cos(t * 15) * 0.03; }
      zzz.position.y = height + 0.2 + Math.sin(t * 1.5) * 0.08;
      halo.rotation.z = t * 0.8; halo.scale.setScalar(1 + Math.sin(t * 4) * 0.04);
      hugRing.rotation.z = -t;
      for (const e of eyes) e.scale.y = L.sleep ? e.scale.x * 0.15 : e.scale.x * (Math.sin(t * 0.9 + typeId * 2) > 0.985 ? 0.15 : 1.25);
    },
    look(l) {
      const was = L; L = { ...l };
      zzz.visible = !!L.sleep && !L.building;
      gift.visible = !!L.building;
      body.visible = true;
      body.scale.setScalar(1);
      if (L.building) body.scale.setScalar(0.6);
      if (!L.sleep) body.rotation.z = 0;
      halo.visible = !!L.picked;
      hugRing.visible = !!L.hug;
      if (!!was.hidden !== !!L.hidden) setHidden(!!L.hidden);
    },
    squash(power = 1) { squashT = 0; squashP = power; },
    progress(frac, color = '#43B02A', label = '') {
      pill.visible = frac != null;
      if (frac == null) return;
      const sig = `${Math.round(frac * 40)}|${color}|${label}`;
      if (sig !== pillSig) { pillSig = sig; drawPill(Math.max(0, Math.min(1, frac)), color, label); }
      pill.position.y = (L.building ? 1.25 : height + 0.55) + (L.sleep && !L.building ? 0.35 : 0);
    },
    dispose() {
      ptex.dispose(); pill.material.dispose(); setHidden(false); (zzz.material as THREE.SpriteMaterial).map?.dispose(); zzz.material.dispose(); },
  };
  // a toy never shows its box unless it is being made
  ctl.look({});
  return ctl;
}

/** A pile of rocks (stored ore), up to a dozen pebbles. */
export function rockPile(n: number): THREE.Group {
  const g = new THREE.Group();
  const cols = [P.grey, 0xB59A73, 0xD8C6A2, 0x9C8664];
  const k = Math.min(12, n);
  for (let i = 0; i < k; i++) {
    const a = i * 2.4, r = 0.08 + Math.sqrt(i) * 0.12, layer = i > 6 ? 1 : 0;
    const m = ball(cols[i % cols.length], 0.1 + (i % 3) * 0.02, Math.cos(a) * r * (layer ? 0.5 : 1), 0.08 + layer * 0.14, Math.sin(a) * r * (layer ? 0.5 : 1));
    m.scale.y *= 0.75; m.rotation.set(i, i * 2, 0);
    g.add(m);
  }
  return g;
}
