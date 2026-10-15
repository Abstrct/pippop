/* One sky for the whole toy box. A single renderer lives behind every screen: the clouds, the
 * floating sparkles and the sun never go away; each screen brings its own stage (a play mat, the
 * crib mobile, the fridge…) which pops in while the last one floats off. Drag spins the stage like a
 * lazy susan; a tap picks a toy. */
import * as THREE from 'three';
import { P, felt, stepTweens, tween, ease, disposeTree } from './kit';

export interface Stage {
  group: THREE.Group;
  /** Where the camera likes to sit for this stage, and what it looks at. */
  view: { pos: THREE.Vector3; look: THREE.Vector3; fov?: number; /** world units that must fit across the screen */ fitWidth?: number; /** …and up and down, in the space the page leaves open */ fitHeight?: number };
  /** Drag turns the stage (true), or nothing. */
  spin?: boolean;
  tick(t: number, dt: number): void;
  /** Objects that can be tapped; each carries userData.pick (an id) on itself or a parent. */
  pickables(): THREE.Object3D[];
  /** Instanced picking: an InstancedMesh and its ids. */
  instancedPick?(mesh: THREE.InstancedMesh, index: number): string | null;
  onPick?(id: string | null, point?: THREE.Vector3): void;
  onHover?(id: string | null): void;
  dispose(): void;
}

class World {
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  private stage: Stage | null = null;
  private timer = new THREE.Timer();
  private t = 0;
  private canvas!: HTMLCanvasElement;
  private camLook = new THREE.Vector3();
  private camGoal = { pos: new THREE.Vector3(0, 6, 14), look: new THREE.Vector3(0, 1, 0) };
  private zoom = 1;
  private shake = 0;
  private clouds: THREE.Group[] = [];
  private motes!: THREE.Points;

  ok = false;
  /** Keep the stage centred in the open space between panels (pixels left of centre). */
  private frameX = 0;

  mount(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (e) { console.warn('[pippop] no webgl', e); return; }
    this.ok = true;
    const r = this.renderer;
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.08;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color(0x8fd3f2);
    this.scene.fog = new THREE.Fog(0xcdeefc, 40, 150);
    this.buildSky();
    const hemi = new THREE.HemisphereLight(0xffffff, 0xffe2b8, 1.25); this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff4dc, 2.4);
    sun.position.set(7, 14, 9); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    const sc = sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 50;
    this.scene.add(sun); this.scene.add(sun.target);
    const fill = new THREE.DirectionalLight(0xbfe3ff, 0.6); fill.position.set(-8, 5, -6); this.scene.add(fill);

    this.camera.position.copy(this.camGoal.pos);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.wire();
    r.setAnimationLoop(() => this.frame());
  }

  private resize() {
    if (!this.ok) return;
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    // a tall phone screen backs the camera off so the stage still fits across
    this.camera.updateProjectionMatrix();
  }

  /* ── the sky that never leaves ── */
  private buildSky() {
    // a gradient dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x3fb0e8) }, mid: { value: new THREE.Color(0x9fdcf7) }, low: { value: new THREE.Color(0xfff1d6) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.7, h)) : mix(mid, low, smoothstep(0.0, -0.35, h)); gl_FragColor = vec4(c, 1.0); }',
    }));
    this.scene.add(dome);
    // a big soft sun
    const sunTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; const g = x.createRadialGradient(64, 64, 8, 64, 64, 64); g.addColorStop(0, 'rgba(255,248,214,1)'); g.addColorStop(0.35, 'rgba(255,230,150,0.85)'); g.addColorStop(1, 'rgba(255,230,150,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false, transparent: true }));
    sunS.position.set(60, 70, -110); sunS.scale.setScalar(55); this.scene.add(sunS);
    // puffy clouds, near and far
    const cloudMat = felt(0xffffff);
    const puff = new THREE.SphereGeometry(1, 20, 14);
    const make = (seed: number, s: number) => {
      const g = new THREE.Group();
      const n = 5 + (seed % 3);
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(puff, cloudMat);
        const k = i / (n - 1) - 0.5;
        m.position.set(k * 3.4 * s, Math.sin(i * 1.7 + seed) * 0.35 * s + (1 - Math.abs(k) * 2) * 0.6 * s, Math.cos(i * 2.3) * 0.5 * s);
        m.scale.setScalar((1 - Math.abs(k) * 1.2) * 1.4 * s + 0.5 * s);
        m.scale.y *= 0.8;
        g.add(m);
      }
      return g;
    };
    for (let i = 0; i < 18; i++) {
      const far = i > 6;
      const c = make(i, far ? 2.2 + (i % 4) * 0.6 : 0.9 + (i % 3) * 0.3);
      // near clouds keep to the back and the sides, never between the camera and the toys
      // clouds keep to the back and the sides, never between the camera and the toys, however far back it stands
      const a = far ? Math.PI * (0.92 + ((i - 7) / 11) * 1.16) : Math.PI * (1.08 + (i / 7) * 0.84);
      const r = far ? 55 + (i % 5) * 12 : 20 + (i % 4) * 5;
      c.position.set(Math.cos(a) * r, far ? -6 + (i % 6) * 5 : -2 + (i % 5) * 2.6, Math.sin(a) * r - (far ? 10 : 0));
      c.userData = { a, r, y: c.position.y, speed: 0, base: a };
      this.scene.add(c); this.clouds.push(c);
    }
    // a soft sea of cloud below everything
    for (let i = 0; i < 26; i++) {
      const c = make(i + 40, 3 + (i % 3));
      const a = (i / 26) * Math.PI * 2, r = 14 + (i % 4) * 16;
      c.position.set(Math.cos(a) * r, -14 - (i % 3) * 2, Math.sin(a) * r);
      c.userData = { a, r, y: c.position.y, speed: 0.002 };
      this.scene.add(c); this.clouds.push(c);
    }
    // magic: sparkles drifting everywhere
    const N = 420, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const pal = [P.sun, P.pink, P.white, P.sky, P.mint, P.peach].map((c) => new THREE.Color(c));
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70; pos[i * 3 + 1] = Math.random() * 30 - 6; pos[i * 3 + 2] = (Math.random() - 0.5) * 70;
      const c = pal[i % pal.length]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const gm = new THREE.BufferGeometry();
    gm.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gm.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const spark = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; x.translate(32, 32); x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = i % 2 ? 6 : 30; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); return new THREE.CanvasTexture(c); })();
    this.motes = new THREE.Points(gm, new THREE.PointsMaterial({ size: 0.32, map: spark, vertexColors: true, transparent: true, depthWrite: false, opacity: 0.85, sizeAttenuation: true }));
    this.scene.add(this.motes);
  }

  /* ── stages ── */
  /** Bring in a new stage; the old one floats off into the sky. */
  use(next: Stage | null, o: { instant?: boolean } = {}) {
    const old = this.stage;
    this.stage = next;
    if (old) {
      const g = old.group;
      const y0 = g.position.y, s0 = g.scale.x;
      if (o.instant) { this.scene.remove(g); disposeTree(g); old.dispose(); }
      else tween(0.6, (k) => { g.position.y = y0 + k * 9; g.scale.setScalar(Math.max(0.001, s0 * (1 - k * 0.7))); g.rotation.y += 0.03; }, { ease: ease.inOut, done: () => { this.scene.remove(g); disposeTree(g); old.dispose(); } });
    }
    this.hoverId = null;
    if (!next) return;
    this.scene.add(next.group);
    this.spinV = 0;
    const g = next.group;
    if (o.instant) g.scale.setScalar(1);
    else { g.scale.setScalar(0.001); tween(0.9, (k) => g.scale.setScalar(Math.max(0.001, k)), { ease: ease.back, delay: old ? 0.25 : 0 }); }
    this.camGoal = { pos: next.view.pos.clone(), look: next.view.look.clone() };
    if (next.view.fov) { const f0 = this.camera.fov, f1 = next.view.fov; tween(0.9, (k) => { this.camera.fov = f0 + (f1 - f0) * k; this.camera.updateProjectionMatrix(); }); }
    this.zoom = 1;
  }
  get current() { return this.stage; }
  /** Move the camera's resting spot (a stage changes what it wants to show). */
  aim(pos: THREE.Vector3, look: THREE.Vector3) { this.camGoal = { pos: pos.clone(), look: look.clone() }; }
  rumble(power = 0.5) { this.shake = Math.max(this.shake, power); }
  /** Give a spinnable stage a push, as a finger dragging across it would (the helping hand's demo). */
  nudge(v = 0.05) { if (this.stage?.spin) this.spinV = v; }
  frame0(px: number) { this.frameX = px; }
  /** Page furniture covering the top and bottom of the screen (px): the stage is centred, and fitted,
   * in the space between. */
  private inset = { top: 0, bottom: 0 };
  frameInset(top: number, bottom: number) { this.inset = { top: Math.max(0, top), bottom: Math.max(0, bottom) }; }

  /* ── input: drag to spin, tap to pick, wheel to zoom ── */
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private down: { x: number; y: number; t: number; id: number } | null = null;
  private lastX = 0;
  private spinV = 0;
  private hoverId: string | null = null;
  private pinch: { d: number; z: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private wire() {
    const el = this.canvas;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.zoom }; this.down = null; return; }
      this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; this.lastX = e.clientX;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); this.zoom = Math.max(0.6, Math.min(1.5, this.pinch.z * (this.pinch.d / Math.max(1, d)))); return; }
      if (this.down && this.down.id === e.pointerId) {
        const dx = e.clientX - this.lastX; this.lastX = e.clientX;
        if (this.stage?.spin) { this.stage.group.rotation.y += dx * 0.008; this.spinV = dx * 0.008; }
        return;
      }
      if (e.pointerType === 'mouse') {
        const id = this.pickAt(e.clientX, e.clientY)?.id ?? null;
        if (id !== this.hoverId) { this.hoverId = id; this.stage?.onHover?.(id); el.style.cursor = id ? 'pointer' : 'grab'; }
      }
    });
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      const d = this.down; this.down = null;
      if (!d || d.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (moved < 8 && performance.now() - d.t < 600) { const hit = this.pickAt(e.clientX, e.clientY); this.stage?.onPick?.(hit?.id ?? null, hit?.point); }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = Math.max(0.6, Math.min(1.5, this.zoom * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
  }
  private pickAt(cx: number, cy: number): { id: string; point: THREE.Vector3 } | null {
    const st = this.stage; if (!st) return null;
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hits = this.ray.intersectObjects(st.pickables(), true);
    for (const h of hits) {
      const im = h.object as THREE.InstancedMesh;
      if (im.isInstancedMesh && h.instanceId != null && st.instancedPick) { const id = st.instancedPick(im, h.instanceId); if (id) return { id, point: h.point }; continue; }
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.pick == null) o = o.parent;
      if (o) return { id: String(o.userData.pick), point: h.point };
    }
    return null;
  }
  /** Where a world point sits on the page (for words and buttons that follow a toy). */
  toScreen(v: THREE.Vector3): { x: number; y: number; behind: boolean } {
    const p = v.clone().project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, behind: p.z > 1 };
  }

  private frame() {
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    this.t += dt;
    const t = this.t;
    stepTweens(performance.now());
    // clouds drift, sparkles float
    for (const c of this.clouds) { const u = c.userData as { a: number; r: number; y: number; speed: number }; u.a += u.speed * dt; c.position.x = Math.cos(u.a) * u.r; c.position.z = Math.sin(u.a) * u.r; c.position.y = u.y + Math.sin(t * 0.3 + u.a * 5) * 0.3; }
    const pa = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) { let y = pa.getY(i) + dt * (0.25 + (i % 7) * 0.05); if (y > 24) y = -6; pa.setY(i, y); pa.setX(i, pa.getX(i) + Math.sin(t * 0.5 + i) * dt * 0.15); }
    pa.needsUpdate = true;
    (this.motes.material as THREE.PointsMaterial).size = 0.28 + Math.sin(t * 2) * 0.04;
    // the stage's own life, and the lazy-susan coast
    const st = this.stage;
    if (st) {
      if (st.spin && !this.down) { st.group.rotation.y += this.spinV; this.spinV *= 0.93; }
      try { st.tick(t, dt); } catch (e) { console.error(e); }
    }
    // camera eases to its goal, with a little float
    const goal = this.camGoal.pos.clone().sub(this.camGoal.look).multiplyScalar(this.zoom * this.fitFactor()).add(this.camGoal.look);
    goal.y += Math.sin(t * 0.4) * 0.08;
    this.camera.position.lerp(goal, 1 - Math.exp(-3.2 * dt));
    this.camLook.lerp(this.camGoal.look, 1 - Math.exp(-3.2 * dt));
    if (this.shake > 0.001) { this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.3; this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.3; this.shake *= 0.88; }
    this.camera.lookAt(this.camLook);
    // shift the view so the stage sits in the open space between the panels
    const offY = Math.round((this.inset.bottom - this.inset.top) / 2);
    if (this.frameX || offY) this.camera.setViewOffset(this.canvas.clientWidth, this.canvas.clientHeight, this.frameX, offY, this.canvas.clientWidth, this.canvas.clientHeight);
    else if (this.camera.view?.enabled) this.camera.clearViewOffset();
    this.govern();
    this.renderer.render(this.scene, this.camera);
  }

  /* ── keeping it smooth: when frames start to drop (a slower browser, a small phone, a busy room)
   * the shadows are redrawn every third frame instead of every frame, and if that is not enough the
   * picture is drawn a little smaller; when all is smooth again it steps back up. ── */
  private quality = 0;
  private qAt = performance.now();
  private qFrames = 0;
  private qSlow = 0;
  private qLast = performance.now();
  private qTick = 0;
  private qGood = 0;
  private govern() {
    const now = performance.now(), dt = now - this.qLast; this.qLast = now;
    if (document.hidden || dt > 250) { this.qAt = now; this.qFrames = this.qSlow = 0; return; }   // a hidden tab or a stall is not a slow frame
    this.qFrames++; if (dt > 22) this.qSlow++;
    const r = this.renderer;
    if (this.quality > 0) { r.shadowMap.autoUpdate = false; if (++this.qTick % 3 === 0) r.shadowMap.needsUpdate = true; }
    if (now - this.qAt < 2500) return;
    const slow = this.qSlow / Math.max(1, this.qFrames);
    const was = this.quality;
    // down quickly, up slowly (four smooth windows in a row), so it never flickers between the two
    this.qGood = slow < 0.02 ? this.qGood + 1 : 0;
    if (slow > 0.12 && this.quality < 2) this.quality++;
    else if (this.qGood >= 4 && this.quality > 0) { this.quality--; this.qGood = 0; }
    if (this.quality !== was) {
      if (this.quality === 0) { r.shadowMap.autoUpdate = true; }
      const full = Math.min(2, window.devicePixelRatio || 1);
      r.setPixelRatio(this.quality >= 2 ? Math.max(1, full * 0.75) : full);
      this.resize();
    }
    this.qAt = now; this.qFrames = this.qSlow = 0;
  }
  /** A narrow (portrait) screen backs the camera off so the stage fits across. */
  /** How much further back the camera stands so the stage's width fits across this screen. */
  private fitFactor() {
    const a = this.camera.aspect, st = this.stage;
    const fw = st?.view.fitWidth;
    // close-ups (the camera aimed at one toy) keep their own distance; only the room's view fits the width
    if (!fw || !st || st.view.pos.distanceTo(this.camGoal.pos) > 0.01) return a >= 1.2 ? 1 : 1 + (1.2 - a) * 0.6;
    const tv = Math.tan((this.camera.fov * Math.PI) / 360);
    const half = Math.atan(tv * a);
    let need = fw / 2 / Math.tan(half);
    // the height has to fit in what the page leaves open, not the whole screen
    const fh = st.view.fitHeight, H = this.canvas.clientHeight || 1;
    if (fh) { const open = Math.max(0.2, (H - this.inset.top - this.inset.bottom) / H); need = Math.max(need, fh / (2 * tv * open)); }
    const base = this.camGoal.pos.distanceTo(this.camGoal.look);
    return Math.max(1, need / Math.max(1, base));
  }
}

export const world = new World();
