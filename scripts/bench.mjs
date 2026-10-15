#!/usr/bin/env node
/* The browser bench: the built site, served the way Pages serves it, in Chrome and in Firefox side by
 * side, on this machine's GPU. Per browser:
 *   load   time until the first room is up, DOMContentLoaded, load, script bytes
 *   rooms  frames per second over 4 s in each room, the 95th-percentile frame time, frames over 50 ms
 *   shake  proof-of-work hashing with the real hash worker: million hashes a second over 5 s
 *   has    the features the game leans on (WebGL2, WebGPU, module workers, Web Locks, speech…)
 *
 *   pnpm bench                  both browsers (whichever are installed)
 *   BENCH_BROWSERS=firefox pnpm bench · BENCH_NO_BUILD=1 reuse the last build
 * Writes .smoke/bench.json. Needs the public testnet for the rooms' data, like the smoke test. */
import { readdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { siteOf, build, serve, ROOT } from './lib/pages.mjs';

process.env.LAB_GPU = '1';   // Chrome on the real GPU too, so the two are compared fairly
const cdp = await import('../playtest/lib/cdp.mjs');
const bidi = await import('../playtest/lib/bidi.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BROWSERS = (process.env.BENCH_BROWSERS || 'chrome,firefox').split(',').map((s) => s.trim().toLowerCase()).filter((name) => {
  try { (name === 'firefox' ? bidi.findFirefox : cdp.findChrome)(); return true; } catch { console.log(`bench: no ${name} here, skipped`); return false; }
});
const site = siteOf('https://pippop.pet');
build(site, { reuse: !!process.env.BENCH_NO_BUILD });
const pages = await serve(site);
const worker = readdirSync(join(site.OUT, 'assets')).find((f) => /^hash\.worker-.*\.js$/.test(f));

const ROOMS = ['#/hi', '#/toys', '#/sky', '#/bonk', '#/fridge', '#/book'];
const FPS = `new Promise((res) => { const ts = []; let t0 = 0;
  const f = (t) => { if (!t0) t0 = t; ts.push(t); if (t - t0 < 4000) requestAnimationFrame(f); else {
    const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b);
    res({ fps: +((ts.length - 1) / ((ts[ts.length - 1] - ts[0]) / 1000)).toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), long: d.filter((x) => x > 50).length }); } };
  requestAnimationFrame(f); })`;
const LOAD = `(() => { const n = performance.getEntriesByType('navigation')[0] || {}; const js = performance.getEntriesByType('resource').filter((r) => /\\.js($|\\?)/.test(r.name));
  return { dcl: Math.round(n.domContentLoadedEventEnd || 0), load: Math.round(n.loadEventEnd || 0), jsKB: Math.round(js.reduce((a, r) => a + (r.encodedBodySize || r.transferSize || 0), 0) / 1024) }; })()`;
const HAS = `(async () => {
  const c = document.createElement('canvas'), gl = c.getContext('webgl2'), dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
  let gpu = false; try { gpu = !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch {}
  let mod = false; try { const w = new Worker(URL.createObjectURL(new Blob(['export {}; postMessage(1)'], { type: 'text/javascript' })), { type: 'module' }); mod = await new Promise((r) => { w.onmessage = () => r(true); w.onerror = () => r(false); setTimeout(() => r(false), 3000); }); w.terminate(); } catch {}
  return { webgl2: !!gl, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl ? gl.getParameter(gl.RENDERER) : null, webgpu: gpu, moduleWorker: mod,
    locks: !!navigator.locks, speech: 'speechSynthesis' in window, dvh: CSS.supports('height', '1dvh'), has: CSS.supports('selector(:has(a))'), cores: navigator.hardwareConcurrency };
})()`;
const SHAKE = (url) => `(async () => {
  const n = Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 4) / 2)));
  let total = 0; const ws = [];
  for (let i = 0; i < n; i++) { const w = new Worker(${JSON.stringify(url)}, { type: 'module' }); w.onmessage = (e) => { if (e.data && e.data.type === 'progress') total += e.data.hashes; }; w.postMessage({ type: 'start', taskId: 'bench', prefix: 'bench' + i, start: i * 1e9, floor: 64 }); ws.push(w); }
  await new Promise((r) => setTimeout(r, 1500)); total = 0;
  await new Promise((r) => setTimeout(r, 5000));
  ws.forEach((w) => w.terminate());
  return { threads: n, mhs: +(total / 5 / 1e6).toFixed(2) };
})()`;

const report = { at: new Date().toISOString(), machine: process.platform + ' ' + process.arch, browsers: {} };
for (const name of BROWSERS) {
  const b = name === 'firefox' ? await bidi.launchFirefox() : await cdp.launchChrome({ width: 1280, height: 800 });
  const r = { version: b.version, rooms: {}, errors: [] };
  try {
    const page = await b.newPage({ width: 1280, height: 800, isolated: true });
    const t0 = Date.now();
    await page.goto(`${pages.origin}/#/hi`);
    await page.waitFor(`!document.getElementById('boot') && !!document.body.dataset.room`, { timeout: 30000 });
    r.load = { firstRoomMs: Date.now() - t0, ...(await page.eval(LOAD)) };
    r.has = await page.eval(HAS);
    for (const room of ROOMS) {
      await page.eval(`(() => { location.hash = ${JSON.stringify(room)}; return 1; })()`);
      await sleep(3000);   // the room's own entrance (camera, tweens) settles first
      r.rooms[room] = await page.eval(FPS);
    }
    r.shake = await page.eval(SHAKE(`/assets/${worker}`));
    r.errors = page.errors([/CORS|Cross-Origin Request Blocked/i, /NetworkError|net::ERR_/i, /WebSocket|can.t establish a connection/i, /GL Driver Message/i, /status of 404/i]).slice(0, 10);
    await page.close();
  } catch (e) { r.failed = e.message; }
  await b.close();
  report.browsers[name] = r;
}
pages.close();

/* ── the table ── */
const names = Object.keys(report.browsers);
const col = (s, n = 18) => String(s ?? '—').padEnd(n);
const row = (label, f) => console.log(col(label, 22) + names.map((n) => col(f(report.browsers[n]))).join(''));
console.log('\n' + col('', 22) + names.map((n) => col(report.browsers[n].version)).join(''));
row('first room (ms)', (r) => r.load?.firstRoomMs);
row('DOMContentLoaded (ms)', (r) => r.load?.dcl);
row('load (ms)', (r) => r.load?.load);
row('script (KB)', (r) => r.load?.jsKB);
for (const room of ROOMS) row(`${room} fps · p95 ms`, (r) => r.rooms[room] ? `${r.rooms[room].fps} · ${r.rooms[room].p95}${r.rooms[room].long ? ` · ${r.rooms[room].long} long` : ''}` : '—');
row('shake (MH/s)', (r) => r.shake ? `${r.shake.mhs} on ${r.shake.threads}` : '—');
row('WebGL2 · WebGPU', (r) => r.has ? `${r.has.webgl2 ? 'yes' : 'NO'} · ${r.has.webgpu ? 'yes' : 'no'}` : '—');
row('module worker · locks', (r) => r.has ? `${r.has.moduleWorker ? 'yes' : 'NO'} · ${r.has.locks ? 'yes' : 'NO'}` : '—');
row('speech · dvh · :has', (r) => r.has ? `${r.has.speech ? 'y' : 'n'} · ${r.has.dvh ? 'y' : 'n'} · ${r.has.has ? 'y' : 'n'}` : '—');
row('renderer', (r) => (r.has?.renderer || '').slice(0, 17));
row('errors', (r) => r.failed ? 'FAILED' : r.errors.length);
for (const n of names) { const r = report.browsers[n]; if (r.failed) console.log(`${n}: ${r.failed}`); for (const e of r.errors) console.log(`${n} ${e.kind}: ${e.text.slice(0, 200)}`); }
await writeFile(join(ROOT, '.smoke', 'bench.json'), JSON.stringify(report, null, 2));
console.log('\nbench: .smoke/bench.json');
