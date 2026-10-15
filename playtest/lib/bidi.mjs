/* A small Firefox driver over WebDriver BiDi (built into Firefox; no geckodriver, no downloads),
 * with the same page surface as cdp.mjs where the smoke test and the bench need it: goto, eval,
 * waitFor, setViewport, screenshot, wheel, errors, close. Each page gets its own user context, so
 * storage is isolated like the Chrome lab's. Node 22+ (global WebSocket). */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FIREFOX_PATHS = [
  process.env.QA_FIREFOX,
  '/Applications/Firefox.app/Contents/MacOS/firefox',
  '/Applications/Firefox Nightly.app/Contents/MacOS/firefox',
  '/usr/bin/firefox', '/usr/local/bin/firefox', '/opt/homebrew/bin/firefox', '/snap/bin/firefox',
].filter(Boolean);

export function findFirefox() {
  for (const p of FIREFOX_PATHS) if (existsSync(p)) return p;
  throw new Error('No Firefox found. Set QA_FIREFOX=/path/to/firefox');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchFirefox({ port = 9600 + Math.floor(Math.random() * 300), headed = false } = {}) {
  const profile = join(tmpdir(), `pippop-ff-${process.pid}-${port}`);
  rmSync(profile, { recursive: true, force: true }); mkdirSync(profile, { recursive: true });
  // quiet, fast, and like a player's: real GPU WebGL, no first-run pages, no update checks
  writeFileSync(join(profile, 'user.js'), [
    ['browser.shell.checkDefaultBrowser', false], ['browser.startup.homepage_override.mstone', '"ignore"'], ['datareporting.policy.dataSubmissionEnabled', false],
    ['app.update.auto', false], ['app.update.enabled', false], ['toolkit.telemetry.reportingpolicy.firstRun', false], ['browser.aboutwelcome.enabled', false],
    ['webgl.force-enabled', true], ['media.autoplay.default', 0], ['dom.min_background_timeout_value', 4], ['browser.tabs.remote.autostart', true],
    ['remote.active-protocols', 1], ['dom.webgpu.enabled', true],
  ].map(([k, v]) => `user_pref("${k}", ${v});`).join('\n'));
  const args = [headed ? '' : '--headless', '--no-remote', '--profile', profile, `--remote-debugging-port=${port}`, 'about:blank'].filter(Boolean);
  const proc = spawn(findFirefox(), args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MOZ_CRASHREPORTER_DISABLE: '1' } });
  let log = '';
  const take = (d) => { log += d; if (log.length > 20000) log = log.slice(-10000); };
  proc.stdout.on('data', take); proc.stderr.on('data', take);
  let ws = null;
  for (let i = 0; i < 150 && !ws; i++) {
    await sleep(100);
    if (!/WebDriver BiDi listening/.test(log)) continue;
    try { ws = await open(`ws://127.0.0.1:${port}/session`); } catch { ws = null; }
  }
  if (!ws) { proc.kill(); throw new Error('Firefox did not open its BiDi port. ' + log.slice(-600)); }
  const b = new Browser(ws);
  const s = await b.send('session.new', { capabilities: { alwaysMatch: { acceptInsecureCerts: true, unhandledPromptBehavior: { default: 'dismiss' } } } });
  b.version = `Firefox/${s.capabilities?.browserVersion || '?'}`;
  await b.send('session.subscribe', { events: ['log.entryAdded'] });
  b.proc = proc; b.profile = profile;
  return b;
}

function open(url) {
  return new Promise((res, rej) => { const ws = new WebSocket(url); ws.onopen = () => res(ws); ws.onerror = () => rej(new Error('BiDi socket failed')); });
}

class Browser {
  id = 0; pending = new Map(); pages = new Map(); closed = false;
  constructor(ws) {
    this.ws = ws;
    ws.onmessage = (m) => this.dispatch(JSON.parse(m.data));
    ws.onclose = () => { this.closed = true; for (const [, p] of this.pending) p.reject(new Error('BiDi socket closed')); this.pending.clear(); };
  }
  send(method, params = {}) {
    if (this.closed) return Promise.reject(new Error('BiDi socket closed'));
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject, method }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  dispatch(msg) {
    if (msg.id != null && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id); this.pending.delete(msg.id);
      if (msg.type === 'error' || msg.error) p.reject(new Error(`${p.method}: ${msg.error} ${msg.message || ''}`.trim())); else p.resolve(msg.result);
      return;
    }
    if (msg.method === 'log.entryAdded') {
      const e = msg.params, page = this.pages.get(e.source?.context);
      if (page) page.log(e);
    }
  }
  async newPage({ width = 1280, height = 800, isolated = true } = {}) {
    const userContext = isolated ? (await this.send('browser.createUserContext', {})).userContext : undefined;
    const { context } = await this.send('browsingContext.create', { type: 'tab', ...(userContext ? { userContext } : {}) });
    const page = new Page(this, context, userContext);
    this.pages.set(context, page);
    await page.setViewport(width, height);
    return page;
  }
  async close() {
    try { await this.send('browser.close', {}); } catch { /* already going */ }
    try { this.ws.close(); } catch { /* fine */ }
    await sleep(300);
    try { this.proc.kill(); } catch { /* fine */ }
    rmSync(this.profile, { recursive: true, force: true });
  }
}

class Page {
  console = []; exceptions = [];
  constructor(b, context, userContext) { this.b = b; this.context = context; this.userContext = userContext; }
  log(e) {
    const text = e.text || (e.args || []).map((a) => a.value ?? a.type).join(' ');
    if (e.type === 'javascript') this.exceptions.push({ text, at: Date.now() });
    else this.console.push({ level: e.level === 'warn' ? 'warning' : e.level, text, at: Date.now() });
  }
  async setViewport(width, height, { scale = 1 } = {}) {
    this.viewport = { width, height };
    await this.b.send('browsingContext.setViewport', { context: this.context, viewport: { width, height }, devicePixelRatio: scale });
  }
  async goto(url, { timeout = 30000 } = {}) {
    await Promise.race([this.b.send('browsingContext.navigate', { context: this.context, url, wait: 'complete' }), sleep(timeout).then(() => { throw new Error('goto timed out: ' + url); })]);
  }
  /** Evaluate an expression (it may be a promise); the value comes back through JSON. */
  async eval(expression, { timeout = 90000 } = {}) {
    const r = await Promise.race([
      this.b.send('script.evaluate', { expression: `(async () => { const v = await (${expression}); return v === undefined ? 'null' : JSON.stringify(v); })()`, target: { context: this.context }, awaitPromise: true, resultOwnership: 'none' }),
      sleep(timeout + 2000).then(() => { throw new Error('eval: no answer in ' + timeout + 'ms'); }),
    ]);
    if (r.type === 'exception') throw new Error('eval: ' + (r.exceptionDetails?.text || 'exception'));
    const s = r.result?.value;
    return s == null ? null : JSON.parse(s);
  }
  async waitFor(expression, { timeout = 30000, every = 150, what = expression } = {}) {
    const t0 = Date.now(); let last;
    while (Date.now() - t0 < timeout) {
      try { if (await this.eval(`!!(${expression})`, { timeout: 5000 })) return true; } catch (e) { last = e.message; }
      await sleep(every);
    }
    throw new Error(`waited ${timeout}ms for ${what}` + (last ? ` (last: ${last})` : ''));
  }
  async screenshot(path) {
    const { data } = await this.b.send('browsingContext.captureScreenshot', { context: this.context, origin: 'viewport' });
    const buf = Buffer.from(data, 'base64');
    if (path) await writeFile(path, buf);
    return buf;
  }
  async wheel(x, y, deltaY) {
    await this.b.send('input.performActions', { context: this.context, actions: [{ type: 'wheel', id: 'wheel', actions: [{ type: 'scroll', x: Math.round(x), y: Math.round(y), deltaX: 0, deltaY: Math.round(deltaY) }] }] });
  }
  async click(x, y) {
    await this.b.send('input.performActions', { context: this.context, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [{ type: 'pointerMove', x: Math.round(x), y: Math.round(y) }, { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 }] }] });
  }
  async drag(x0, y0, x1, y1, steps = 8) {
    const moves = Array.from({ length: steps }, (_, i) => ({ type: 'pointerMove', x: Math.round(x0 + (x1 - x0) * (i + 1) / steps), y: Math.round(y0 + (y1 - y0) * (i + 1) / steps), duration: 16 }));
    await this.b.send('input.performActions', { context: this.context, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [{ type: 'pointerMove', x: Math.round(x0), y: Math.round(y0) }, { type: 'pointerDown', button: 0 }, ...moves, { type: 'pointerUp', button: 0 }] }] });
  }
  errors(allow = []) {
    const bad = [...this.exceptions.map((e) => ({ kind: 'exception', text: e.text })), ...this.console.filter((c) => c.level === 'error' || (c.level === 'warning' && /WebGL|CONTEXT_LOST|THREE\./.test(c.text))).map((c) => ({ kind: 'console', text: c.text }))];
    return bad.filter((b) => !allow.some((re) => re.test(b.text)));
  }
  async close() {
    try { await this.b.send('browsingContext.close', { context: this.context }); } catch { /* gone */ }
    if (this.userContext) try { await this.b.send('browser.removeUserContext', { userContext: this.userContext }); } catch { /* gone */ }
    this.b.pages.delete(this.context);
  }
}

export { sleep };
