#!/usr/bin/env node
/* The smoke test: build the site, serve it the way GitHub Pages does, and open every room in headless
 * Chrome against the live testnet, at desktop and phone sizes.
 *
 *   pnpm smoke                                   # root build (https://pippop.pet layout)
 *   SMOKE_SITE=https://example.github.io/pippop pnpm smoke   # under a project path
 *   SMOKE_QUICK=1  desktop only · SMOKE_NO_BUILD=1  reuse the last build · SMOKE_SHOTS=dir  keep screenshots
 *   SMOKE_BROWSER=firefox  the same rooms in Firefox (its built-in WebDriver BiDi; no geckodriver)
 *
 * A room fails on: an uncaught exception or console error, a room that never mounts, sideways scroll,
 * a blank 3D view, or (under a project path) any request outside the base path. Without the browser
 * it skips, and with CI set a skip is a failure. */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { decodePng, measure } from './lib/png.mjs';
import { siteOf, build, serve } from './lib/pages.mjs';

/* SMOKE_BROWSER=firefox drives Firefox (WebDriver BiDi, built in) instead of Chrome */
const FIREFOX = /^(firefox|ff)$/i.test(process.env.SMOKE_BROWSER || '');
const driver = FIREFOX ? await import('../playtest/lib/bidi.mjs') : await import('../playtest/lib/cdp.mjs');
const { sleep } = driver;
const find = FIREFOX ? driver.findFirefox : driver.findChrome;
const launch = FIREFOX ? () => driver.launchFirefox() : () => driver.launchChrome({ width: 1280, height: 800 });

const { SITE, BASE, OUT } = siteOf(process.env.SMOKE_SITE || 'https://pippop.pet');
const QUICK = !!process.env.SMOKE_QUICK;
const SHOTS = process.env.SMOKE_SHOTS ? resolve(process.env.SMOKE_SHOTS) : null;
const CI = !!process.env.CI;

try { find(); } catch {
  console.log(`smoke: no ${FIREFOX ? 'Firefox' : 'Chrome'} here, skipped`);
  process.exit(CI ? 1 : 0);
}

/* ── build, then a Pages-like server ── */
build({ SITE, BASE, OUT }, { reuse: !!process.env.SMOKE_NO_BUILD });
const pages = await serve({ BASE, OUT });
const ORIGIN = pages.origin, outside = pages.outside;

/* ── the rooms ── */
const ROOMS = ['#/hi', '#/', '#/toys', '#/toys/14', '#/sky', '#/bonk', '#/fridge', '#/book', '#/bonk/abc', '#/nowhere'];
const DEVICES = QUICK ? [['desktop', 1280, 800, false]] : [['desktop', 1280, 800, false], ['phone', 390, 844, true]];
// third parties a visitor's browser may be refused by (guild servers without CORS, a chain hiccup):
// the game says so in its own words; they are not the page's errors
const ALLOW = [/blocked by CORS policy/i, /paste\.c-net\.org/i, /net::ERR_(FAILED|NAME_NOT_RESOLVED|CONNECTION_REFUSED|TIMED_OUT)/i, /cosmos\/tx\/v1beta1\/txs\/[0-9A-F]+/, /status of 404.*\/structs\/(player|planet|fleet|struct)\//i, /WebSocket connection to 'wss:/i, /GL Driver Message \(OpenGL, Performance/i];

const results = [];
const b = await launch();
console.log(`smoke: ${b.version || ''}`);
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
} finally { await b.close(); pages.close(); }

if (outside.length) results.push({ dev: '-', room: 'base path', ok: false, fails: [...new Set(outside)].map((p) => 'request outside the base: ' + p) });
const bad = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.dev.padEnd(8)} ${r.room.padEnd(12)}${r.landed ? ' → ' + r.landed : ''}${r.fails.length ? '\n       ' + r.fails.join('\n       ') : ''}`);
console.log(`\nsmoke: ${results.length - bad.length}/${results.length} passed (${SITE}, ${FIREFOX ? 'Firefox' : 'Chrome'})`);
if (SHOTS) await writeFile(join(SHOTS, 'smoke.json'), JSON.stringify(results, null, 2));
process.exit(bad.length ? 1 : 0);
