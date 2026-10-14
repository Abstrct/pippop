/* The toy maker's bench: shiny plastic, chunky rounded shapes, word stickers, confetti and
 * little tweens. Everything in the world is built from these. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const P = {
  red: 0xE4002B, sun: 0xFFC72C, blue: 0x0077C8, leaf: 0x43B02A, peach: 0xFF8F1C, plum: 0x8246AF,
  sky: 0x41B6E6, ink: 0x1D2A5C, cream: 0xFFF8E7, white: 0xFFFDF5, pink: 0xFF8FB1, brown: 0xB07A42,
  tan: 0xF2D2A6, grey: 0xC9B38F, black: 0x26263A, mint: 0x9BE3C4,
} as const;

/* ── materials ── */
const mats = new Map<string, THREE.Material>();
/** Glossy toy plastic, one per colour (shared). */
export function plastic(color: number, o: { rough?: number; glow?: number; opacity?: number } = {}): THREE.MeshPhysicalMaterial {
  const key = `p:${color}:${o.rough ?? 0.34}:${o.glow ?? 0}:${o.opacity ?? 1}`;
  let m = mats.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({
      color, roughness: o.rough ?? 0.34, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.25,
      emissive: o.glow ? color : 0x000000, emissiveIntensity: o.glow ?? 0,
      transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1,
    });
    mats.set(key, m);
  }
  return m;
}
/** Soft felt / fabric (the play mat, clouds). */
export function felt(color: number): THREE.MeshStandardMaterial {
  const key = `f:${color}`;
  let m = mats.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 }); mats.set(key, m); }
  return m;
}
/** Clear plastic (the popper dome, the bubble). */
export function glass(color = 0xffffff, opacity = 0.32): THREE.MeshPhysicalMaterial {
  const key = `g:${color}:${opacity}`;
  let m = mats.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, metalness: 0, transmission: 0.0, transparent: true, opacity, clearcoat: 1, iridescence: 0.6, iridescenceIOR: 1.3, depthWrite: false });
    mats.set(key, m);
  }
  return m;
}

/* ── geometry ── */
const geos = new Map<string, THREE.BufferGeometry>();
function g<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let x = geos.get(key) as T | undefined;
  if (!x) { x = make(); geos.set(key, x); }
  return x;
}
export const geo = {
  ball: (seg = 28) => g(`ball${seg}`, () => new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7))),
  box: (w: number, h: number, d: number, r = 0.12) => g(`rb${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2.01, h / 2.01, d / 2.01))),
  cyl: (rt: number, rb: number, h: number, seg = 28) => g(`cy${rt}:${rb}:${h}:${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  cone: (r: number, h: number, seg = 24) => g(`co${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  ring: (r: number, tube: number, seg = 48) => g(`to${r}:${tube}:${seg}`, () => new THREE.TorusGeometry(r, tube, 16, seg)),
  capsule: (r: number, len: number) => g(`ca${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, 8, 20)),
  disc: (r: number, seg = 64) => g(`di${r}:${seg}`, () => new THREE.CircleGeometry(r, seg)),
};

/** One mesh, placed. */
export function part(geom: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx): THREE.Mesh {
  const m = new THREE.Mesh(geom, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
export const ball = (color: number, r: number, x = 0, y = 0, z = 0) => part(geo.ball(), plastic(color), x, y, z, r);

/* ── word stickers ── */
const FONT = '700 1px Fredoka, "Baloo 2", system-ui, sans-serif';
/** A rounded word sticker as a sprite (always faces the camera). */
export function wordSprite(text: string, o: { bg?: string; fg?: string; size?: number; outline?: string } = {}): THREE.Sprite {
  const px = 96;
  const c = document.createElement('canvas');
  const x = c.getContext('2d')!;
  x.font = FONT.replace('1px', px + 'px');
  const w = Math.ceil(x.measureText(text).width) + px * 0.9;
  c.width = w; c.height = Math.round(px * 1.5);
  const r = c.height / 2;
  x.font = FONT.replace('1px', px + 'px');
  if (o.bg !== 'none') {
    x.fillStyle = o.outline || '#1D2A5C';
    rr(x, 0, 0, w, c.height, r); x.fill();
    x.fillStyle = o.bg || '#FFFFFF';
    rr(x, 7, 7, w - 14, c.height - 14, r - 7); x.fill();
  }
  x.fillStyle = o.fg || '#1D2A5C';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (o.bg === 'none') { x.lineWidth = 16; x.strokeStyle = o.outline || '#1D2A5C'; x.lineJoin = 'round'; x.strokeText(text, w / 2, c.height / 2 + px * 0.06); }
  x.fillText(text, w / 2, c.height / 2 + px * 0.06);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false, transparent: true }));
  const h = o.size ?? 0.6;
  s.scale.set(h * (w / c.height), h, 1);
  s.renderOrder = 10;
  return s;
}
function rr(x: CanvasRenderingContext2D, a: number, b: number, w: number, h: number, r: number) {
  x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
}

/** A comic burst ("BONK!") with spiky edges. */
export function burstSprite(text: string, fill = '#FFC72C', fg = '#E4002B'): THREE.Sprite {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.translate(S / 2, S / 2);
  const spikes = 12;
  x.beginPath();
  for (let i = 0; i <= spikes * 2; i++) { const a = (i / (spikes * 2)) * Math.PI * 2; const r = i % 2 ? S * 0.3 : S * 0.47; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  x.closePath(); x.fillStyle = '#1D2A5C'; x.fill();
  x.scale(0.9, 0.9); x.fillStyle = fill; x.fill();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.font = FONT.replace('1px', (text.length > 5 ? 50 : 66) + 'px');
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 10; x.strokeStyle = '#FFFFFF'; x.lineJoin = 'round'; x.strokeText(text, S / 2, S / 2 + 4);
  x.fillStyle = fg; x.fillText(text, S / 2, S / 2 + 4);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false, transparent: true }));
  s.renderOrder = 11;
  return s;
}

/** A sprite from an SVG string (icons in the world). */
export function svgSprite(svg: string, size = 0.6): THREE.Sprite {
  const img = new Image();
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  img.onload = () => { tex.needsUpdate = true; };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(size, size, 1);
  return s;
}

/* ── little tweens ── */
type TweenFn = (t: number) => void;
interface Tw { t0: number; dur: number; fn: TweenFn; done?: () => void; ease: (t: number) => number }
const tweens = new Set<Tw>();
export const ease = {
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t: number) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  elastic: (t: number) => (t === 0 || t === 1 ? t : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  lin: (t: number) => t,
};
export function tween(dur: number, fn: TweenFn, o: { ease?: (t: number) => number; done?: () => void; delay?: number } = {}) {
  const tw: Tw = { t0: performance.now() + (o.delay || 0) * 1000, dur: dur * 1000, fn, done: o.done, ease: o.ease || ease.out };
  tweens.add(tw);
  return () => tweens.delete(tw);
}
export function stepTweens(now: number) {
  for (const tw of [...tweens]) {
    if (now < tw.t0) continue;
    const k = Math.min(1, (now - tw.t0) / tw.dur);
    try { tw.fn(tw.ease(k)); } catch (e) { console.error(e); }
    if (k >= 1) { tweens.delete(tw); try { tw.done?.(); } catch (e) { console.error(e); } }
  }
}

/* ── confetti ── */
const CONF = [P.red, P.sun, P.blue, P.leaf, P.peach, P.plum, P.pink, P.sky];
/** A burst of tumbling confetti and stars from a point, cleaned up on its own. */
export function confetti(parent: THREE.Object3D, at: THREE.Vector3, o: { n?: number; power?: number; colors?: number[]; stars?: boolean } = {}) {
  const n = o.n ?? 40, power = o.power ?? 3;
  const group = new THREE.Group(); parent.add(group);
  const bits: { m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3 }[] = [];
  const starG = g('star', () => starGeometry(0.5, 0.22, 0.12));
  for (let i = 0; i < n; i++) {
    const col = (o.colors || CONF)[i % (o.colors || CONF).length];
    const star = o.stars && i % 3 === 0;
    const m = new THREE.Mesh(star ? starG : geo.box(0.16, 0.04, 0.1, 0.015), plastic(star ? P.sun : col, { glow: star ? 0.3 : 0 }));
    m.position.copy(at); m.scale.setScalar(star ? 0.35 : 1);
    const a = Math.random() * Math.PI * 2, up = 0.6 + Math.random() * 0.9;
    bits.push({ m, v: new THREE.Vector3(Math.cos(a) * power * (0.3 + Math.random() * 0.7), up * power * 1.4, Math.sin(a) * power * (0.3 + Math.random() * 0.7)), w: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9) });
    group.add(m);
  }
  const t0 = performance.now();
  let last = t0;
  const stop = tween(2.6, () => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const b of bits) {
      b.v.y -= 6.5 * dt; b.v.multiplyScalar(0.985);
      b.m.position.addScaledVector(b.v, dt);
      b.m.rotation.x += b.w.x * dt; b.m.rotation.y += b.w.y * dt; b.m.rotation.z += b.w.z * dt;
    }
    const k = (now - t0) / 2600;
    if (k > 0.7) group.scale.setScalar(Math.max(0.001, 1 - (k - 0.7) / 0.3));
  }, { ease: ease.lin, done: () => { parent.remove(group); } });
  return stop;
}

/** A puffy five-point star, extruded. */
export function starGeometry(r = 0.5, ri = 0.22, depth = 0.14): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rad = i % 2 ? ri : r;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  s.closePath();
  const geom = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3 });
  geom.center();
  return geom;
}
export const starGeo = () => g('star:1', () => starGeometry(0.5, 0.24, 0.14));

/** A heart, extruded. */
export const heartGeo = () => g('heart', () => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.35, -0.55, -0.1, -0.55, 0.18);
  s.bezierCurveTo(-0.55, 0.45, -0.25, 0.55, 0, 0.3);
  s.bezierCurveTo(0.25, 0.55, 0.55, 0.45, 0.55, 0.18);
  s.bezierCurveTo(0.55, -0.1, 0.15, -0.35, 0, -0.5);
  const geom = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3 });
  geom.center();
  return geom;
});

/** Soft round shadow blob under a toy. */
export function blob(r = 0.6): THREE.Mesh {
  const tex = g('blobtex', () => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d')!; const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(29,42,92,0.35)'); gr.addColorStop(1, 'rgba(29,42,92,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    const geom = new THREE.PlaneGeometry(1, 1);
    (geom as unknown as { userData: Record<string, unknown> }).userData.tex = t;
    return geom;
  });
  const m = new THREE.Mesh(tex, new THREE.MeshBasicMaterial({ map: (tex.userData as { tex: THREE.Texture }).tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.scale.setScalar(r * 2);
  return m;
}

export function disposeTree(o: THREE.Object3D) {
  o.traverse((x) => {
    const s = x as THREE.Sprite;
    if (s.isSprite) { (s.material as THREE.SpriteMaterial).map?.dispose(); s.material.dispose(); }
  });
}
