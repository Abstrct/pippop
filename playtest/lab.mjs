/* The Pip Pop playtest lab. One headless Chrome; every playtester gets an isolated browser context (their
 * own storage, so their own key and their own kid) on the private devnet. Testers drive it through
 * `pt.mjs` (or HTTP), the way a player would: look at the screen, tap things by the name they see, spin
 * the mat, type. Every step is recorded: a screenshot, what was on screen, game state, console errors,
 * frame rate, and every rite that landed or failed. `report.mjs` turns a run into a report.
 *
 *   node playtest/lab.mjs                 # http://127.0.0.1:7810, run folder playtest/runs/<stamp>
 *   LAB_HEADED=1 node playtest/lab.mjs    # watch the browser
 *
 * Env: GAME_URL (http://localhost:5198/, the devnet build; started here if it isn't up), LAB_PORT (7810),
 * LAB_RUN (run folder name), STRUCTSD and DEVNET_HOME (for the faucet).
 * Plays only on the private devnet: nothing here signs up or acts on a public network. */
import { createServer } from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { mkdirSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, sleep } from './lib/cdp.mjs';
import { INSTRUMENT, LOOK, STATE, FIND, FPS } from './lib/probe.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const GAME_URL = process.env.GAME_URL || 'http://localhost:5198/';
const LCD = process.env.LAB_LCD || 'http://127.0.0.1:41317';
const PORT = Number(process.env.LAB_PORT || 7810);
const RUN = process.env.LAB_RUN || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const RUN_DIR = join(HERE, 'runs', RUN);
const STRUCTSD = process.env.STRUCTSD || '';
const DEVNET_HOME = process.env.DEVNET_HOME || join(ROOT, 'devnet/.home');
const FAUCET_MAX = 10;   // stars per tester, a test cheat logged as such
mkdirSync(RUN_DIR, { recursive: true });

const DEVICES = {
  desktop: { width: 1280, height: 800, mobile: false },
  wide: { width: 1440, height: 900, mobile: false },
  tablet: { width: 834, height: 1112, mobile: true },
  phone: { width: 390, height: 844, mobile: true },
};

/* ── the game server ── */
async function up(url) { try { const r = await fetch(url, { signal: AbortSignal.timeout(3000) }); return r.ok; } catch { return false; } }
async function ensureGame() {
  if (await up(GAME_URL)) return;
  console.log('[lab] starting the devnet game server');
  const env = { ...process.env, VITE_GRASS_URL: 'off', VITE_LCD_URL: LCD, VITE_RPC_WS_URL: 'ws://127.0.0.1:46657/websocket', STRUCTS_LCD: LCD, VITE_DEFAULT_GUILD: '0-1' };
  const port = new URL(GAME_URL).port || '5198';
  const p = spawn('npx', ['vite', '--config', 'devnet/vite.config.mjs', '--port', port, '--strictPort'], { cwd: ROOT, env, stdio: 'ignore', detached: true });
  p.unref();
  for (let i = 0; i < 60 && !(await up(GAME_URL)); i++) await sleep(500);
  if (!(await up(GAME_URL))) throw new Error('the game server did not come up at ' + GAME_URL);
}

/* ── testers ── */
const testers = new Map();
const browser = await (async () => { await ensureGame(); return launchChrome({ headed: !!process.env.LAB_HEADED, width: 1280, height: 800 }); })();
console.log(`[lab] ${browser.version} · game ${GAME_URL} · run ${RUN_DIR}`);
writeFileSync(join(RUN_DIR, 'run.json'), JSON.stringify({ run: RUN, game: GAME_URL, started: new Date().toISOString(), chrome: browser.version }, null, 2));

function tester(name) {
  const t = testers.get(name);
  if (!t) throw new Error(`no tester "${name}": start one first (pt.mjs ${name} start [device])`);
  return t;
}
function log(t, entry) { appendFileSync(join(t.dir, 'log.jsonl'), JSON.stringify({ t: new Date().toISOString(), s: Math.round((Date.now() - t.started) / 1000), ...entry }) + '\n'); }
const lock = (t, f) => (t.queue = t.queue.then(f, f));

async function shot(t, label) {
  t.n++;
  const file = join(t.dir, `${String(t.n).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').slice(0, 30)}.jpg`);
  await t.page.screenshot(file, { format: 'jpeg', quality: 72 }).catch(() => null);
  return file;
}
function newErrors(t) {
  const pg = t.page;
  const ex = pg.exceptions.slice(t.seenEx).map((e) => 'exception: ' + e.text.split('\n')[0]);
  // polling a rite that is still in the mempool answers 404 until it lands: that is not an error
  const co = pg.console.slice(t.seenCo).filter((c) => c.level === 'error' && !/cosmos\/tx\/v1beta1\/txs\/[0-9A-F]+/.test(c.text)).map((c) => 'console: ' + c.text.split('\n')[0]);
  t.seenEx = pg.exceptions.length; t.seenCo = pg.console.length;
  return [...ex, ...co].map((s) => s.slice(0, 240)).slice(0, 8);
}
async function settle(t, ms = 900) { await sleep(ms); }

async function look(t, label = 'look', full = true) {
  const file = await shot(t, label);
  const seen = await t.page.eval(LOOK, { timeout: 15000 }).catch((e) => ({ error: e.message }));
  const fps = await t.page.eval(FPS, { timeout: 5000 }).catch(() => null);
  const errors = newErrors(t);
  return { screenshot: file, fps, errors, ...(full ? seen : { route: seen.route, counters: seen.counters, signs: seen.signs, bubbles: seen.bubbles, dialogs: seen.dialogs, shout: seen.shout }) };
}

async function tapAt(t, x, y) {
  if (t.device.mobile) {
    await t.page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await sleep(60);
    await t.page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else await t.page.click(x, y);
}

/* ── commands ── */
const COMMANDS = {
  async start(name, [device = 'desktop', ...persona]) {
    if (testers.has(name)) return { already: true, ...(await look(tester(name), 'restart', false)) };
    const d = DEVICES[device] || DEVICES.desktop;
    const dir = join(RUN_DIR, name.replace(/[^a-z0-9_-]/gi, '_'));
    mkdirSync(dir, { recursive: true });
    const page = await browser.newPage({ width: d.width, height: d.height, isolated: true });
    if (d.mobile) await page.setViewport(d.width, d.height, { mobile: true, scale: 1 });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT });
    const t = { name, page, device: { name: device, ...d }, dir, n: 0, started: Date.now(), queue: Promise.resolve(), seenEx: 0, seenCo: 0, faucet: 0, persona: persona.join(' ') };
    testers.set(name, t);
    await page.goto(GAME_URL);
    await settle(t, 4000);
    log(t, { kind: 'start', device, persona: t.persona });
    return look(t, 'start');
  },
  look: async (name) => look(tester(name)),
  async tap(name, [label, nth = '0', region = '']) {
    const t = tester(name);
    if (!label) throw new Error('tap what? e.g. tap Make');
    const f = await t.page.eval(FIND(label, Number(nth), region), { timeout: 10000 });
    if (!f.found) return { tapped: false, why: `nothing named "${label}" on screen`, onScreen: f.candidates };
    await tapAt(t, f.x, f.y);
    await settle(t);
    return { tapped: f.name, disabled: f.disabled || undefined, sameName: f.matches > 1 ? f.matches : undefined, ...(await look(t, 'tap-' + label, false)) };
  },
  async tapxy(name, [x, y]) {
    const t = tester(name);
    await tapAt(t, Number(x), Number(y));
    await settle(t);
    return { tapped: `${x},${y}`, ...(await look(t, `tapxy-${x}-${y}`, false)) };
  },
  async tapthing(name, [what, nth = '0']) {
    const t = tester(name);
    const seen = await t.page.eval(LOOK, { timeout: 15000 });
    const w = String(what || '').toLowerCase();
    const list = (seen.things || []).filter((x) => x.id.toLowerCase() === w || x.label.toLowerCase() === w || x.label.toLowerCase().startsWith(w));
    const th = list[Number(nth)] || null;
    if (!th) return { tapped: false, why: `no "${what}" in the 3D scene`, things: seen.things };
    await tapAt(t, th.x, th.y);
    await settle(t);
    return { tapped: `${th.label} (${th.owner || 'thing'})`, ...(await look(t, 'thing-' + th.label, false)) };
  },
  async spin(name, [dx = '300']) {
    const t = tester(name); const d = t.device;
    await t.page.drag(d.width / 2, d.height / 2, d.width / 2 + Number(dx), d.height / 2);
    await settle(t, 1200);
    return look(t, 'spin', false);
  },
  async zoom(name, [dir = 'in']) {
    const t = tester(name); const d = t.device;
    for (let i = 0; i < 4; i++) await t.page.wheel(d.width / 2, d.height / 2, dir === 'in' ? -120 : 120);
    await settle(t, 1200);
    return look(t, 'zoom-' + dir, false);
  },
  async key(name, [k = 'Escape', times = '1']) {
    const t = tester(name);
    for (let i = 0; i < Math.min(30, Number(times) || 1); i++) await t.page.key(k);
    await settle(t, 600);
    const focus = await t.page.eval(`(() => { const a = document.activeElement; if (!a || a === document.body) return 'nothing'; return (a.getAttribute('aria-label') || a.innerText || a.tagName).replace(/\\s+/g, ' ').trim().slice(0, 60) + ' <' + a.tagName.toLowerCase() + '>'; })()`).catch(() => '?');
    return { pressed: k, focus, ...(await look(t, 'key-' + k, false)) };
  },
  async type(name, words) {
    const t = tester(name);
    await t.page.type(words.join(' '));
    await settle(t, 500);
    return look(t, 'type', false);
  },
  /** Clear a field (by name) and type into it. */
  async fill(name, [label, ...words]) {
    const t = tester(name);
    const f = await t.page.eval(FIND(label, 0), { timeout: 10000 });
    if (!f.found) return { filled: false, why: `no field "${label}"`, onScreen: f.candidates };
    await t.page.click(f.x, f.y);
    await t.page.eval(`(() => { const a = document.activeElement; if (a && 'value' in a) { a.value = ''; a.dispatchEvent(new Event('input', { bubbles: true })); } return true; })()`);
    await t.page.type(words.join(' '));
    await settle(t, 500);
    return { filled: f.name, ...(await look(t, 'fill', false)) };
  },
  async goto(name, [route = '#/']) {
    const t = tester(name);
    if (route === 'reload') { await t.page.reload(); await settle(t, 4000); }
    else { await t.page.eval(`(() => { location.hash = ${JSON.stringify(route.startsWith('#') ? route : '#/' + route.replace(/^\//, ''))}; return true; })()`); await settle(t, 2500); }
    return look(t, 'goto', false);
  },
  async wait(name, [secs = '5']) {
    const t = tester(name);
    await sleep(Math.min(120, Math.max(1, Number(secs))) * 1000);
    return look(t, `wait-${secs}`, false);
  },
  async device(name, [device = 'desktop']) {
    const t = tester(name); const d = DEVICES[device] || DEVICES.desktop;
    t.device = { name: device, ...d };
    await t.page.setViewport(d.width, d.height, { mobile: d.mobile });
    await settle(t, 1500);
    return look(t, 'device-' + device, false);
  },
  state: async (name) => tester(name).page.eval(STATE, { timeout: 15000 }),
  /** The ledger's own truth for this tester's kid (to check what the screen claims). */
  async chain(name) {
    const t = tester(name);
    const s = await t.page.eval(STATE, { timeout: 15000 });
    if (!s.kid) return { kid: null };
    const j = async (p) => (await fetch(LCD + p)).json();
    const pl = await j(`/structs/player/${s.kid.id}`);
    const planet = pl.Player.planetId ? await j(`/structs/planet/${pl.Player.planetId}`) : null;
    return { player: pl.Player, grid: pl.gridAttributes, alpha: pl.playerInventory, planet: planet && { id: planet.Planet.id, ore: planet.gridAttributes?.ore, shield: planet.planetAttributes?.planetaryShield, structs: ['space', 'air', 'land', 'water'].flatMap((a) => planet.Planet[a] || []).filter(Boolean) } };
  },
  async note(name, words) {
    const t = tester(name);
    const text = words.join(' ');
    const file = await shot(t, 'note');
    log(t, { kind: 'note', text, screenshot: file });
    return { noted: text, screenshot: file };
  },
  /** End of session: ratings 1–5 and a summary, e.g. verdict fun=4 clarity=2 magic=5 "short summary". */
  async verdict(name, words) {
    const t = tester(name);
    const scores = {}; const rest = [];
    for (const w of words) { const m = /^([a-z]+)=(\d)$/i.exec(w); if (m) scores[m[1].toLowerCase()] = Number(m[2]); else rest.push(w); }
    log(t, { kind: 'verdict', scores, text: rest.join(' ') });
    return { recorded: scores, text: rest.join(' ') };
  },
  /** Devnet only: stars from the faucet, logged as a test cheat (up to 10 per tester). */
  async faucet(name, [amount = '5']) {
    const t = tester(name);
    if (!STRUCTSD || !existsSync(STRUCTSD)) return { given: 0, why: 'faucet needs STRUCTSD (the devnet binary) set for the lab' };
    const n = Math.max(0, Math.min(FAUCET_MAX - t.faucet, Number(amount) || 0));
    if (!n) return { given: 0, why: 'faucet limit reached' };
    const addr = await t.page.eval(`(async () => (await import('/src/wallet/wallet.ts')).wallet.active?.address || null)()`);
    if (!addr) return { given: 0, why: 'no key yet' };
    const out = await new Promise((res) => execFile(STRUCTSD, ['tx', 'bank', 'send', 'bob', addr, `${n * 1e6}ualpha`, '--home', DEVNET_HOME, '--keyring-backend', 'test', '--chain-id', 'pippop-devnet-1', '--node', 'tcp://127.0.0.1:46657', '--yes', '--output', 'json'], { timeout: 30000 }, (e, so, se) => res(e ? String(se || e.message) : so)));
    const ok = /"code":\s*0/.test(out);
    if (ok) t.faucet += n;
    log(t, { kind: 'cheat', what: 'faucet', stars: n, ok });
    return { given: ok ? n : 0, note: 'a test cheat; logged', raw: ok ? undefined : out.slice(0, 200) };
  },
  async end(name) {
    const t = tester(name);
    const st = await t.page.eval(STATE, { timeout: 15000 }).catch(() => null);
    const file = await shot(t, 'end');
    log(t, { kind: 'end', state: st, screenshot: file, exceptions: t.page.exceptions.length, consoleErrors: t.page.console.filter((c) => c.level === 'error').length });
    await t.page.close();
    testers.delete(name);
    return { ended: name, minutes: Math.round((Date.now() - t.started) / 6000) / 10 };
  },
};

async function run(name, cmd, args) {
  const f = COMMANDS[cmd];
  if (!f) throw new Error(`unknown command "${cmd}". Commands: ${Object.keys(COMMANDS).join(', ')}`);
  if (cmd === 'start') return f(name, args);
  const t = tester(name);
  return lock(t, async () => {
    const t0 = Date.now();
    let result, ok = true;
    try { result = await f(name, args); } catch (e) { ok = false; result = { error: e.message }; }
    if (testers.has(name) && cmd !== 'note' && cmd !== 'verdict') log(t, { kind: 'act', cmd, args, ok, ms: Date.now() - t0, route: result?.route, screenshot: result?.screenshot, errors: result?.errors?.length ? result.errors : undefined, tapped: result?.tapped, why: result?.why, fps: result?.fps });
    return result;
  });
}

createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  try {
    if (req.method === 'GET' && req.url === '/status') return send(200, { run: RUN, dir: RUN_DIR, game: GAME_URL, testers: [...testers.values()].map((t) => ({ name: t.name, device: t.device.name, steps: t.n })) });
    if (req.method !== 'POST' || req.url !== '/cmd') return send(404, { error: 'POST /cmd {tester, cmd, args}' });
    let body = ''; for await (const c of req) body += c;
    const { tester: name, cmd, args = [] } = JSON.parse(body || '{}');
    if (!name || !cmd) return send(400, { error: 'tester and cmd are required' });
    send(200, await run(String(name), String(cmd), args.map(String)));
  } catch (e) { send(500, { error: e.message }); }
}).listen(PORT, '127.0.0.1', () => console.log(`[lab] listening on http://127.0.0.1:${PORT}`));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await browser.close(); process.exit(0); });
