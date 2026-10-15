/* The bonk bubble: every bonk heard on the chain is played again, up close, in a little soap bubble
 * in the corner. The striker winds up, hops over and bonks; the other toy squashes or dodges, or its
 * hugging pal hops in front and takes it behind a purple shield; every bonk back (the pal's counter,
 * the target's own) flies home at the striker; a knocked-out toy tips over in stars. Then the bubble
 * pops. Its own small renderer, only drawing while a bubble is up. */
import * as THREE from 'three';
import { makeToy, type ToyCtl } from './toys';
import { P, plastic, part, geo, burstSprite, confetti } from './kit';
import { audio } from '../core/audio';

export interface Replay {
  a: number;            // the striker's toy
  b: number;            // the toy that was aimed at
  g?: number;           // the hugging pal that jumped in and took it
  mine: boolean;        // our toy is the striker
  miss: boolean;        // it dodged
  dmg: number;
  felled: boolean;      // the toy that took the hit (the pal, if there was one) is knocked out
  backs: { type: number; dmg: number }[];   // every bonk back at the striker, in order
  aFelled: boolean;     // the striker was knocked out
}

const HOME = 1.0;
let r: THREE.WebGLRenderer | null = null, broken = false;
let wrap: HTMLElement, scene: THREE.Scene, camera: THREE.PerspectiveCamera, ours: THREE.Mesh, theirs: THREE.Mesh;
const queue: Replay[] = [];
let busy = false, raf = 0, gen = 0;

function setup(): boolean {
  if (r) return true;
  if (broken) return false;
  try {
    wrap = document.createElement('div');
    wrap.className = 'bonk-bubble'; wrap.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    const shine = document.createElement('span'); shine.className = 'shine';
    wrap.append(canvas, shine);
    document.body.append(wrap);
    r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.08;
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffe2b8, 1.4));
    const sun = new THREE.DirectionalLight(0xfff4dc, 2.2); sun.position.set(2, 6, 5); scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbfe3ff, 0.6); fill.position.set(-4, 3, -3); scene.add(fill);
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    camera.position.set(0, 1.55, 5.4); camera.lookAt(0, 0.62, 0);
    // a little round rug, split in two: the striker's half and the other half
    scene.add(part(geo.cyl(2.75, 2.85, 0.16, 48), plastic(P.sun), 0, -0.1, 0));
    const half = (from: number) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.04, 48, 1, false, from, Math.PI), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 })); scene.add(m); return m; };
    theirs = half(0); ours = half(Math.PI);
    return true;
  } catch { broken = true; r = null; return false; }
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const bonkBubble = {
  play(x: Replay) {
    if (document.hidden || reduced()) return;
    queue.push(x);
    while (queue.length > 3) queue.shift();
    if (!busy) next();
  },
  /** Leaving the room: the bubble pops now and nothing waits. */
  stop() {
    queue.length = 0;
    if (busy) { gen++; cancelAnimationFrame(raf); finish(); }
  },
};

let cleanup: (() => void) | null = null;
function finish() {
  wrap?.classList.remove('on');
  wrap?.classList.add('bye');
  cleanup?.(); cleanup = null;
  busy = false;
}

function next() {
  const x = queue.shift();
  if (!x || !setup() || !r) return;
  busy = true;
  const my = ++gen;
  // the striker's half wears its side's colour: blue is ours, red is theirs
  (ours.material as THREE.MeshStandardMaterial).color.setHex(x.mine ? 0x41B6E6 : 0xFF5A6E);
  (theirs.material as THREE.MeshStandardMaterial).color.setHex(x.mine ? 0xFF5A6E : 0x41B6E6);

  const fit = (c: ToyCtl) => { const k = Math.min(1, 1.25 / Math.max(0.6, c.height)); c.root.scale.setScalar(k); return k; };
  const A = makeToy(x.a), B = makeToy(x.b), G = x.g ? makeToy(x.g) : null;
  const ka = fit(A), kb = fit(B), kg = G ? fit(G) : 1;
  A.root.position.set(-HOME, 0.02, 0); A.root.rotation.y = Math.PI / 2 - 0.45;
  B.root.position.set(HOME, 0.02, 0); B.root.rotation.y = -Math.PI / 2 + 0.45;
  scene.add(A.root, B.root);
  // the hugging pal waits just behind the toy it hugs, then jumps out in front of it
  const gHome = new THREE.Vector3(HOME + 0.45, 0.02, -0.75), gSpot = new THREE.Vector3(HOME - 0.62, 0.02, 0.2);
  if (G) { G.root.position.copy(gHome); G.root.rotation.y = -Math.PI / 2 + 0.6; G.root.scale.setScalar(kg * 0.85); scene.add(G.root); }
  const took = G ?? B, kTook = G ? kg * 0.85 : kb;
  const stop = G ? gSpot.x - 0.75 : HOME - (x.miss ? 0.45 : 0.3);   // where the striker's hop ends
  let shield: THREE.Mesh | null = null;
  const balls: { m: THREE.Mesh; from: ToyCtl; t0: number; dmg: number; landed: boolean }[] = [];
  const bursts: { s: THREE.Sprite; t0: number; y: number }[] = [];
  const burst = (on: ToyCtl, text: string, fill: string, fg: string, t: number) => {
    const s = burstSprite(text, fill, fg);
    const y = on.root.position.y + on.height * on.root.scale.y + 0.45;
    s.position.set(on.root.position.x, y, 0.2); s.scale.setScalar(0.001); scene.add(s);
    bursts.push({ s, t0: t, y });
  };
  cleanup = () => {
    for (const c of [A, B, G]) if (c) { scene.remove(c.root); c.dispose(); }
    if (shield) { scene.remove(shield); (shield.material as THREE.Material).dispose(); }
    for (const b of balls) { scene.remove(b.m); }
    for (const b of bursts) { scene.remove(b.s); b.s.material.map?.dispose(); b.s.material.dispose(); }
  };

  const size = wrap.clientWidth || 200;
  r.setSize(size, size, false);
  camera.aspect = 1; camera.updateProjectionMatrix();
  wrap.classList.remove('bye');
  void wrap.offsetWidth;
  wrap.classList.add('on');

  const tipOver = (c: ToyCtl, sign: number, k: number, k0: number) => { c.root.rotation.z = sign * Math.min(1, k) * Math.PI * 0.5; c.root.position.y = 0.02 + Math.sin(Math.min(1, k) * Math.PI) * 0.5; c.root.scale.setScalar(k0 * Math.max(0.001, 1 - Math.max(0, k - 1) * 3)); };
  const BACK0 = 1.35, BACK_GAP = 0.5;
  const backsDone = x.backs.length ? BACK0 + x.backs.length * BACK_GAP + 0.4 : 1.4;
  const aFellAt = Math.max(1.65, backsDone);
  const end = Math.max(x.felled ? 3.3 : 2.4, x.aFelled ? aFellAt + 1.6 : backsDone + 1.0);
  const once = new Set<string>();
  const at = (t: number, key: string, when: number) => t >= when && !once.has(key) && !!once.add(key);
  const t0 = performance.now();
  let last = t0;
  const loop = (now: number) => {
    if (my !== gen) return;
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
    A.tick(t, dt); B.tick(t, dt); G?.tick(t, dt);
    // the pal jumps out in front as the striker comes, and back home after
    if (G && !x.miss) {
      if (t >= 0.5 && t < 0.85) { const k = (t - 0.5) / 0.35; G.root.position.lerpVectors(gHome, gSpot, k); G.root.position.y = 0.02 + Math.sin(k * Math.PI) * 0.55; }
      else if (t >= 0.85 && !x.felled && t < 1.9) { const k = Math.max(0, Math.min(1, (t - 1.5) / 0.4)); G.root.position.lerpVectors(gSpot, gHome, k); G.root.position.y = 0.02 + Math.sin(k * Math.PI) * 0.4; }
    }
    // wind up, hop over, bonk, bounce home
    if (at(t, 'wind', 0.35)) A.squash(0.7);
    if (t >= 0.55 && t < 0.9) {
      const k = (t - 0.55) / 0.35;
      A.root.position.x = -HOME + (stop + HOME) * k * k;
      A.root.position.y = 0.02 + Math.sin(k * Math.PI) * 0.45;
      A.root.rotation.z = -Math.sin(k * Math.PI) * 0.35;
    }
    if (at(t, 'hit', 0.9)) {
      const spot = new THREE.Vector3(took.root.position.x - 0.45, 0.6, took.root.position.z + 0.1);
      if (x.miss) burst(B, 'Boing!', '#FFFFFF', '#0077C8', t);
      else if (G) {
        G.squash(1.4);
        shield = new THREE.Mesh(geo.ball(24), new THREE.MeshPhysicalMaterial({ color: P.plum, transparent: true, opacity: 0.45, roughness: 0.1, clearcoat: 1, depthWrite: false }));
        shield.position.set(G.root.position.x, 0.55, G.root.position.z); scene.add(shield);
        confetti(scene, spot, { n: 14, power: 1.3, colors: [P.plum, P.pink, P.white] });
        burst(G, x.dmg ? `-${x.dmg}` : 'Hug!', '#B58BDB', '#FFFFFF', t);
      } else {
        B.squash(1.4);
        confetti(scene, spot, { n: 14, power: 1.3 });
        burst(B, x.dmg ? `-${x.dmg}` : 'Bonk!', '#FFC72C', '#E4002B', t);
      }
    }
    if (t >= 0.9 && t < 1.4) {
      const k = (t - 0.9) / 0.5;
      A.root.position.x = -HOME + (stop + HOME) * (1 - k);
      A.root.position.y = 0.02 + Math.sin(k * Math.PI) * 0.25;
      A.root.rotation.z = 0;
      if (x.miss) { B.root.position.y = 0.02 + Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.8; B.root.position.x = HOME + Math.sin(k * Math.PI) * 0.4; }
      else if (!G) { B.root.position.x = HOME + Math.sin(k * Math.PI) * 0.3; B.root.rotation.z = Math.sin(k * Math.PI * 3) * 0.22 * (1 - k); }
    } else if (t >= 1.4 && !once.has('settled')) { once.add('settled'); A.root.position.set(-HOME, 0.02, 0); if (!x.felled) { B.root.position.set(HOME, 0.02, 0); B.root.rotation.z = 0; } }
    if (shield) { const k = (t - 0.9) / 0.7; shield.scale.setScalar(0.75 * (k < 0.3 ? Math.min(1, k / 0.3) * 1.1 : 1 + (k - 0.3) * 0.2)); (shield.material as THREE.MeshPhysicalMaterial).opacity = 0.45 * Math.max(0, k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5); }
    // every bonk back: a purple ball from the pal (or the target) home at the striker
    x.backs.forEach((c, i) => {
      if (!at(t, 'back' + i, BACK0 + i * BACK_GAP)) return;
      const from = G && c.type === x.g ? G : c.type === x.b || !G ? B : G;
      from.squash(0.8);
      const m = part(geo.ball(14), plastic(P.plum, { glow: 0.35 }), from.root.position.x, 0.6, from.root.position.z, 0.11);
      scene.add(m); balls.push({ m, from, t0: t, dmg: c.dmg, landed: false });
    });
    for (const b of balls) {
      const k = Math.min(1, (t - b.t0) / 0.38);
      const p0 = b.from.root.position, p1 = A.root.position;
      b.m.position.set(p0.x + (p1.x - p0.x) * k, 0.6 + Math.sin(k * Math.PI) * 0.7, p0.z + (p1.z - p0.z) * k);
      if (k >= 1 && !b.landed) { b.landed = true; b.m.visible = false; A.squash(1); burst(A, `-${b.dmg}`, '#FFC72C', '#E4002B', t); confetti(scene, new THREE.Vector3(p1.x, 0.6, p1.z), { n: 8, power: 1, colors: [P.plum, P.sun] }); }
    }
    // knocked out: tip over in a shower of stars
    if (x.felled && !x.miss && t >= 1.55) { const ko = took.root.position; tipOver(took, -1, (t - 1.55) / 0.7, kTook); if (at(t, 'poofB', 2.2)) { confetti(scene, new THREE.Vector3(ko.x, 0.4, ko.z), { n: 30, power: 2, stars: true }); burst(took, 'Poof!', '#FF8FB1', '#E4002B', t); } }
    if (x.aFelled && t >= aFellAt) { tipOver(A, 1, (t - aFellAt) / 0.7, ka); if (at(t, 'poofA', aFellAt + 0.65)) { confetti(scene, new THREE.Vector3(-HOME, 0.4, 0), { n: 30, power: 2, stars: true }); burst(A, 'Poof!', '#FF8FB1', '#E4002B', t); } }
    for (const b of bursts) {
      const k = (t - b.t0) / 1.2;
      const pop = k < 0.18 ? 1 + 0.25 * Math.sin((k / 0.18) * Math.PI) * (k / 0.18) : 1;
      b.s.scale.setScalar(Math.max(0.001, 1.05 * Math.min(1, k / 0.12) * pop));
      b.s.position.y = b.y + Math.min(1, k) * 0.35;
      (b.s.material as THREE.SpriteMaterial).opacity = k > 0.8 ? Math.max(0, 1 - (k - 0.8) / 0.2) : 1;
    }
    // a gentle bob of the whole bubble's camera, so it feels alive
    camera.position.x = Math.sin(t * 1.3) * 0.12; camera.lookAt(0, 0.62, 0);
    r!.render(scene, camera);
    if (t >= end) {
      audio.chime('pop');
      finish();
      setTimeout(() => { if (!busy) next(); }, 420);
      return;
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}
