/* Toy sounds, made live with WebAudio: xylophone taps, pops, boings, a squeaky bonk, and a little
 * music box that plays a lullaby while you play. One switch silences it all. */
const MUTE = 'pippop.quiet';

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let echo: DelayNode | null = null;
function ac(): AudioContext | null {
  if (quiet()) return null;
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
    out = ctx.createGain(); out.gain.value = 0.55; out.connect(ctx.destination);
    // a little room: a soft echo makes the music box shimmer
    echo = ctx.createDelay(1); echo.delayTime.value = 0.23;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(out);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
function quiet() { try { return localStorage.getItem(MUTE) === '1'; } catch { return false; } }

/** One struck note: a wooden bar (sine + a bright overtone) that rings and fades. */
function note(freq: number, at = 0, gain = 0.25, decay = 0.9, type: OscillatorType = 'sine', wet = true) {
  const c = ac(); if (!c || !out) return;
  const t = c.currentTime + at;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.connect(out); if (wet && echo) g.connect(echo);
  for (const [mul, lvl] of [[1, 1], [3.98, 0.18], [9.1, 0.05]] as const) {
    const o = c.createOscillator(); o.type = mul === 1 ? type : 'sine'; o.frequency.value = freq * mul;
    const og = c.createGain(); og.gain.value = lvl;
    o.connect(og); og.connect(g); o.start(t); o.stop(t + decay + 0.05);
  }
}
/** A slide: boing, whoosh, squeak. */
function slide(f0: number, f1: number, at = 0, dur = 0.3, gain = 0.2, type: OscillatorType = 'triangle') {
  const c = ac(); if (!c || !out) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
}
/** A puff of noise: a pop, a dig. */
function puff(at = 0, dur = 0.08, gain = 0.3, freq = 1800) {
  const c = ac(); if (!c || !out) return;
  const t = c.currentTime + at;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.4;
  const g = c.createGain(); g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(out); s.start(t);
}

// C major pentatonic, two octaves up from C5
const P = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98, 1760];

export type Chime = 'tap' | 'yay' | 'uh' | 'boop' | 'pop' | 'bonk' | 'boing' | 'dig' | 'whoosh' | 'make' | 'grab' | 'squeak' | 'shake' | 'open' | 'hug' | 'nap' | 'wake';

class Toys {
  chime(name: Chime) {
    switch (name) {
      case 'tap': note(P[2 + Math.floor(Math.random() * 4)], 0, 0.16, 0.5); break;
      case 'yay': [0, 2, 4, 7].forEach((k, i) => note(P[k], i * 0.08, 0.2, 0.9)); break;
      case 'uh': note(392, 0, 0.2, 0.5, 'triangle'); note(311.1, 0.16, 0.2, 0.8, 'triangle'); break;
      case 'boop': slide(660, 330, 0, 0.18, 0.14, 'sine'); break;
      case 'pop': puff(0, 0.05, 0.4, 2400); note(P[5 + Math.floor(Math.random() * 4)], 0.01, 0.12, 0.35); break;
      case 'bonk': slide(220, 70, 0, 0.22, 0.4, 'sine'); puff(0, 0.06, 0.35, 900); slide(900, 1600, 0.05, 0.12, 0.08, 'square'); break;
      case 'boing': slide(180, 520, 0, 0.12, 0.2, 'sine'); slide(520, 240, 0.12, 0.35, 0.16, 'sine'); break;
      case 'dig': puff(0, 0.12, 0.3, 500); puff(0.14, 0.1, 0.24, 650); break;
      case 'whoosh': { const c = ac(); if (!c) break; puff(0, 0.5, 0.18, 700); slide(300, 900, 0, 0.45, 0.05, 'sine'); break; }
      case 'make': [0, 4, 7, 9].forEach((k, i) => note(P[k], i * 0.06, 0.16, 0.6)); break;
      case 'grab': [7, 5, 4, 2, 0].forEach((k, i) => note(P[k] / 2, i * 0.07, 0.2, 0.6, 'triangle')); break;
      case 'squeak': slide(1200, 1900, 0, 0.09, 0.08, 'square'); slide(1900, 1300, 0.09, 0.1, 0.06, 'square'); break;
      case 'shake': for (let i = 0; i < 5; i++) puff(i * 0.06, 0.03, 0.18, 5200); break;
      case 'open': [0, 2, 4, 5, 7, 9].forEach((k, i) => note(P[k], i * 0.09, 0.18, 1.4)); break;
      case 'hug': note(P[0], 0, 0.16, 1.1); note(P[2], 0.02, 0.12, 1.1); note(P[4], 0.04, 0.1, 1.1); break;
      case 'nap': [4, 2, 0].forEach((k, i) => note(P[k] / 2, i * 0.18, 0.12, 1.2)); break;
      case 'wake': [0, 2, 4].forEach((k, i) => note(P[k], i * 0.07, 0.14, 0.7)); break;
    }
  }
  /** Engine compatibility: a struck bell, and the old stingers. */
  bell(freq = 523.25, gain = 0.2, decay = 1.6) { note(freq, 0, Math.min(0.3, gain * 1.2), Math.min(2.4, decay)); }
  stinger(name: string, _gain = 0.6) {
    if (name === 'alpha' || name === 'secure') this.chime('yay');
    else if (name === 'vulnerable' || name === 'youExploded') this.chime('grab');
  }
  get quiet() { return quiet(); }
  toggle() {
    const q = !quiet();
    try { localStorage.setItem(MUTE, q ? '1' : '0'); } catch { /* ignore */ }
    if (q) { ambience.stop(); void ctx?.suspend(); } else { void ctx?.resume(); ambience.start(); }
    return q;
  }
}

/** The music box: a slow lullaby made of the pentatonic bars, never quite the same twice. */
class MusicBox {
  private timer = 0;
  private step = 0;
  // a gentle shape that rises and settles; the box varies a note now and then
  private tune = [0, 4, 7, 4, 5, 4, 2, -1, 0, 2, 4, 2, 0, -1, -1, -1, 4, 7, 9, 7, 5, 4, 2, -1, 2, 4, 2, 0, 0, -1, -1, -1];
  start() {
    if (this.timer || quiet()) return;
    const tick = () => {
      const k = this.tune[this.step % this.tune.length];
      if (k >= 0) {
        const jig = Math.random() < 0.12 ? (Math.random() < 0.5 ? 1 : -1) : 0;
        note(P[Math.max(0, Math.min(P.length - 1, k + jig))], 0, 0.05, 1.8);
        if (this.step % 8 === 0) note(P[k % 5] / 2, 0, 0.035, 2.4);
      }
      this.step++;
    };
    this.timer = window.setInterval(tick, 430);
  }
  stop() { clearInterval(this.timer); this.timer = 0; }
}

export const audio = new Toys();
export const ambience = new MusicBox();
