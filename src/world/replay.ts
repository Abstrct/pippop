/* The bonk bubble: every bonk heard on the chain is played again, up close, in a little soap bubble
 * in the corner. The striker winds up, hops over and bonks; the other toy squashes (or dodges, or its
 * hugging pal takes it); the hit number pops out; a knocked-out toy tips over in stars. Then the
 * bubble pops. Its own small renderer, only drawing while a bubble is up. */
import * as THREE from 'three';
import { makeToy, type ToyCtl } from './toys';
import { P, plastic, part, geo, burstSprite, confetti } from './kit';
import { audio } from '../core/audio';

export interface Replay {
  a: number;            // the striker's toy
  b: number;            // the toy that is hit (the hugging pal, when one steps in)
  mine: boolean;        // our toy is the striker
  miss: boolean;        // it dodged
  guard: boolean;       // a pal stepped in
  dmg: number;
  felled: boolean;      // the toy that was hit is knocked out
  back: number;         // what the striker took back
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
  const A = makeToy(x.a), B = makeToy(x.b);
  const ka = fit(A), kb = fit(B);
  A.root.position.set(-HOME, 0.02, 0); A.root.rotation.y = Math.PI / 2 - 0.45;
  B.root.position.set(HOME, 0.02, 0); B.root.rotation.y = -Math.PI / 2 + 0.45;
  scene.add(A.root, B.root);
  const bursts: { s: THREE.Sprite; t0: number; y: number }[] = [];
  const burst = (on: ToyCtl, text: string, fill: string, fg: string, t: number) => {
    const s = burstSprite(text, fill, fg);
    const y = on.root.position.y + on.height * on.root.scale.y + 0.45;
    s.position.set(on.root.position.x, y, 0.2); s.scale.setScalar(0.001); scene.add(s);
    bursts.push({ s, t0: t, y });
  };
  cleanup = () => {
    for (const c of [A, B]) { scene.remove(c.root); c.dispose(); }
    for (const b of bursts) { scene.remove(b.s); b.s.material.map?.dispose(); b.s.material.dispose(); }
  };

  const size = wrap.clientWidth || 200;
  r.setSize(size, size, false);
  camera.aspect = 1; camera.updateProjectionMatrix();
  wrap.classList.remove('bye');
  void wrap.offsetWidth;
  wrap.classList.add('on');

  const tipOver = (c: ToyCtl, sign: number, k: number, k0: number) => { c.root.rotation.z = sign * Math.min(1, k) * Math.PI * 0.5; c.root.position.y = 0.02 + Math.sin(Math.min(1, k) * Math.PI) * 0.5; c.root.scale.setScalar(k0 * Math.max(0.001, 1 - Math.max(0, k - 1) * 3)); };
  const end = (x.felled || x.aFelled ? 3.3 : 2.4);
  const once = new Set<string>();
  const at = (t: number, key: string, when: number) => t >= when && !once.has(key) && !!once.add(key);
  const t0 = performance.now();
  let last = t0;
  const loop = (now: number) => {
    if (my !== gen) return;
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
    A.tick(t, dt); B.tick(t, dt);
    // wind up, hop over, bonk, bounce home
    if (at(t, 'wind', 0.35)) A.squash(0.7);
    if (t >= 0.55 && t < 0.9) {
      const k = (t - 0.55) / 0.35;
      A.root.position.x = -HOME + (HOME - (x.miss ? 0.45 : 0.3)) * k * k;
      A.root.position.y = 0.02 + Math.sin(k * Math.PI) * 0.45;
      A.root.rotation.z = -Math.sin(k * Math.PI) * 0.35;
    }
    if (at(t, 'hit', 0.9)) {
      const spot = new THREE.Vector3(HOME * 0.55, 0.6, 0.1);
      if (x.miss) burst(B, 'Boing!', '#FFFFFF', '#0077C8', t);
      else {
        B.squash(1.4);
        confetti(scene, spot, { n: 14, power: 1.3 });
        burst(B, x.dmg ? `-${x.dmg}` : 'Bonk!', x.guard ? '#B58BDB' : '#FFC72C', '#E4002B', t);
      }
    }
    if (t >= 0.9 && t < 1.4) {
      const k = (t - 0.9) / 0.5;
      A.root.position.x = -HOME + (HOME - (x.miss ? 0.45 : 0.3)) * (1 - k);
      A.root.position.y = 0.02 + Math.sin(k * Math.PI) * 0.25;
      A.root.rotation.z = 0;
      if (x.miss) { B.root.position.y = 0.02 + Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.8; B.root.position.x = HOME + Math.sin(k * Math.PI) * 0.4; }
      else { B.root.position.x = HOME + Math.sin(k * Math.PI) * 0.3; B.root.rotation.z = Math.sin(k * Math.PI * 3) * 0.22 * (1 - k); }
    } else if (t >= 1.4 && !once.has('settled')) { once.add('settled'); A.root.position.set(-HOME, 0.02, 0); if (!x.felled) { B.root.position.set(HOME, 0.02, 0); B.root.rotation.z = 0; } }
    if (x.back && at(t, 'back', 1.3)) { A.squash(1); burst(A, `-${x.back}`, '#FFC72C', '#E4002B', t); }
    // knocked out: tip over in a shower of stars
    if (x.felled && t >= 1.55) { tipOver(B, -1, (t - 1.55) / 0.7, kb); if (at(t, 'poofB', 2.2)) { confetti(scene, new THREE.Vector3(HOME, 0.4, 0), { n: 30, power: 2, stars: true }); burst(B, 'Poof!', '#FF8FB1', '#E4002B', t); } }
    if (x.aFelled && t >= 1.65) { tipOver(A, 1, (t - 1.65) / 0.7, ka); if (at(t, 'poofA', 2.3)) { confetti(scene, new THREE.Vector3(-HOME, 0.4, 0), { n: 30, power: 2, stars: true }); burst(A, 'Poof!', '#FF8FB1', '#E4002B', t); } }
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
