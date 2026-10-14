#!/usr/bin/env node
/* The smoke test: build the site, serve it the way GitHub Pages does, and open every room in headless
 * Chrome against the live testnet, at desktop and phone sizes.
 *
 *   pnpm smoke                                   # root build (https://pippop.pet layout)
 *   SMOKE_SITE=https://example.github.io/pippop pnpm smoke   # under a project path
 *   SMOKE_QUICK=1  desktop only · SMOKE_NO_BUILD=1  reuse the last build · SMOKE_SHOTS=dir  keep screenshots
 *
 * A room fails on: an uncaught exception or console error, a room that never mounts, sideways scroll,
 * a blank 3D view, or (under a project path) any request outside the base path. Without Chrome it
 * skips, and with CI set a skip is a failure. */
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, findChrome, sleep } from '../playtest/lib/cdp.mjs';
import { decodePng, measure } from './lib/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = (process.env.SMOKE_SITE || 'https://pippop.pet').replace(/\/+$/, '');
const BASE = new URL(SITE + '/').pathname.replace(/\/?$/, '/');
const OUT = join(ROOT, '.smoke', BASE === '/' ? 'root' : BASE.replace(/\W+/g, '_'));
const QUICK = !!process.env.SMOKE_QUICK;
const SHOTS = process.env.SMOKE_SHOTS ? resolve(process.env.SMOKE_SHOTS) : null;
const CI = !!process.env.CI;

try { findChrome(); } catch {
  console.log('smoke: no Chrome here, skipped');
  process.exit(CI ? 1 : 0);
}

/* ── build ── */
if (!process.env.SMOKE_NO_BUILD || !existsSync(join(OUT, 'index.html'))) {
  console.log(`smoke: building for ${SITE} (base ${BASE}) into ${OUT}`);
  const r = spawnSync('npx', ['vite', 'build', '--outDir', OUT, '--emptyOutDir'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, VITE_SITE_URL: SITE } });
  if (r.status !== 0) process.exit(r.status || 1);
}

/* ── a Pages-like server: files under BASE, 404.html for unknown paths, nothing outside BASE ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml', '.wasm': 'application/wasm' };
const outside = [];
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!path.startsWith(BASE)) {
    if (path !== '/favicon.ico') outside.push(path);
    res.writeHead(404); res.end('outside the base path'); return;
  }
  let rel = path.slice(BASE.length) || 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const abs = resolve(OUT, rel);
  let file = abs.startsWith(OUT + sep) && existsSync(abs) && (await stat(abs)).isFile() ? abs : null;
  const code = file ? 200 : 404;
  if (!file) file = join(OUT, '404.html');
  res.writeHead(code, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(await readFile(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

/* ── the rooms ── */
const ROOMS = ['#/hi', '#/', '#/toys', '#/toys/14', '#/sky', '#/bonk', '#/fridge', '#/book', '#/bonk/abc', '#/nowhere'];
const DEVICES = QUICK ? [['desktop', 1280, 800, false]] : [['desktop', 1280, 800, false], ['phone', 390, 844, true]];
// third parties a visitor's browser may be refused by (guild servers without CORS, a chain hiccup):
// the game says so in its own words; they are not the page's errors
const ALLOW = [/blocked by CORS policy/i, /paste\.c-net\.org/i, /net::ERR_(FAILED|NAME_NOT_RESOLVED|CONNECTION_REFUSED|TIMED_OUT)/i, /cosmos\/tx\/v1beta1\/txs\/[0-9A-F]+/, /status of 404.*\/structs\/(player|planet|fleet|struct)\//i, /WebSocket connection to 'wss:/i, /GL Driver Message \(OpenGL, Performance/i];

const results = [];
const b = await launchChrome({ width: 1280, height: 800 });
try {
  if (SHOTS) await mkdir(SHOTS, { recursive: true });
  for (const [dev, w, h, mobile] of DEVICES) {
    const page = await b.newPage({ width: w, height: h, isolated: true });
    if (mobile) await page.setViewport(w, h, { mobile: true });
    for (const room of ROOMS) {
      const fails = [];
      const url = `${ORIGIN}${BASE}${room}`;
      try {
        await page.goto(url);
        // the boot splash leaves once the first room has mounted
        await page.waitFor(`!document.getElementById('boot') && !!document.body.dataset.room`, { timeout: 25000, what: 'the room to mount' }).catch((e) => fails.push('never mounted: ' + e.message.split(' (last')[0]));
        await sleep(2500);
        const m = await page.eval(`({ room: document.body.dataset.room, title: document.title, over: document.documentElement.scrollWidth - innerWidth, app: document.getElementById('app')?.children.length || 0, lab: (window.__lab && window.__lab.errors) || [] })`);
        if (m.over > 1) fails.push(`sideways scroll: ${m.over}px`);
        if (!/Pip Pop/.test(m.title)) fails.push(`title "${m.title}"`);
        const png = await page.screenshot(SHOTS ? join(SHOTS, `${dev}-${room.replace(/\W+/g, '_') || 'root'}.png`) : null);
        const img = decodePng(png);
        const sky = measure(img, { x: Math.floor(w * 0.2), y: Math.floor(h * 0.25), w: Math.floor(w * 0.6), h: Math.floor(h * 0.4) });
        if (sky.dark > 0.85 || sky.mean < 20) fails.push(`blank 3D view (mean ${sky.mean.toFixed(0)}, dark ${(sky.dark * 100).toFixed(0)}%)`);
        for (const e of page.errors(ALLOW)) fails.push(`${e.kind}: ${e.text.split('\n')[0].slice(0, 180)}`);
        results.push({ dev, room, ok: !fails.length, fails, landed: m.room });
      } catch (e) {
        results.push({ dev, room, ok: false, fails: [e.message] });
      }
    }
    await page.close();
  }
} finally { await b.close(); server.close(); }

if (outside.length) results.push({ dev: '-', room: 'base path', ok: false, fails: [...new Set(outside)].map((p) => 'request outside the base: ' + p) });
const bad = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.dev.padEnd(8)} ${r.room.padEnd(12)}${r.landed ? ' → ' + r.landed : ''}${r.fails.length ? '\n       ' + r.fails.join('\n       ') : ''}`);
console.log(`\nsmoke: ${results.length - bad.length}/${results.length} passed (${SITE})`);
if (SHOTS) await writeFile(join(SHOTS, 'smoke.json'), JSON.stringify(results, null, 2));
process.exit(bad.length ? 1 : 0);
