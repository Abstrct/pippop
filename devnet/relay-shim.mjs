// A local-only stand-in for relay/relay.mjs, for the devnet: the same route shapes, but it reads the
// devnet LCD and talks plain http to guild endpoints on 127.0.0.1 / localhost — exactly what the real
// relay refuses by design (https, public, named hosts only). It refuses everything that is NOT local.
//
//   GET  /__relay/health
//   GET  /__relay/guilds                       chain guilds + the guild.json each local endpoint serves
//   ANY  /__relay/guild/<guildId>/api/<path>   that guild's API, one cookie jar per (x-relay-session, guild)
//   POST /__relay/matrix/login                 502: no Matrix on the devnet
//
// Used by scripts/devnet/vite.config.mjs in place of the real relay plugin.
import { relayMiddleware } from '../relay/relay.mjs';
const LCD = process.env.STRUCTS_LCD || 'http://127.0.0.1:41317';
const SESSION_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** Only loopback http(s) targets: this shim must never become a way out. */
export function localUrl(u) {
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(x.hostname) && !x.username && !x.password; } catch { return false; }
}

function send(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(obj));
}
const readBody = (req) => new Promise((r) => { const c = []; req.on('data', (x) => c.push(x)); req.on('end', () => r(Buffer.concat(c).toString('utf8'))); });

let dir = { at: 0, guilds: [] };
async function directory(fresh = false) {
  if (!fresh && Date.now() - dir.at < 30_000) return dir.guilds;
  if (!localUrl(LCD)) throw new Error('STRUCTS_LCD must be a local URL for the devnet shim');
  const list = (await (await fetch(`${LCD}/structs/guild?pagination.limit=500`)).json()).Guild || [];
  const guilds = await Promise.all(list.map(async (g) => {
    const e = { id: g.id, chain: g, meta: null, services: null, error: null };
    if (!localUrl(g.endpoint)) { e.error = 'no local endpoint'; return e; }
    try {
      const doc = (await (await fetch(g.endpoint, { signal: AbortSignal.timeout(4000) })).json()).guild;
      if (!doc || doc.id !== g.id) { e.error = 'guild.json names another guild'; return e; }
      const s = doc.services || {};
      e.meta = { name: doc.name, tag: doc.tag, description: doc.description };
      e.services = { guild_api: localUrl(s.guild_api) ? s.guild_api.replace(/\/+$/, '') : null, grass: null, matrix: null, explorer: null };
    } catch (x) { e.error = String(x.message || x); }
    return e;
  }));
  dir = { at: Date.now(), guilds };
  return guilds;
}

const jars = new Map();   // session|guild → cookie string

async function proxy(req, res, guildId, rest, session) {
  const g = (await directory()).find((x) => x.id === guildId) || (await directory(true)).find((x) => x.id === guildId);
  if (!g?.services?.guild_api) return send(res, 404, { success: false, errors: { relay: `Guild ${guildId} publishes no guild API` }, data: null });
  const target = `${g.services.guild_api.replace(/\/api$/, '')}/api/${rest}`;
  if (!localUrl(target)) return send(res, 400, { success: false, errors: { relay: 'not local' }, data: null });
  const key = `${session}|${guildId}`;
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
  const r = await fetch(target, { method: req.method, body, redirect: 'manual', headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...(jars.get(key) ? { cookie: jars.get(key) } : {}) } });
  for (const c of r.headers.getSetCookie?.() || []) {
    const pair = c.split(';')[0];
    if (/=deleted$|Max-Age=0/i.test(c)) jars.delete(key); else jars.set(key, pair);
  }
  const text = await r.text();
  try { return send(res, r.status, JSON.parse(text)); } catch { return send(res, 502, { success: false, errors: { relay: `guild API answered ${r.status} with non-JSON` }, data: null }); }
}

const realRelay = relayMiddleware();

export function shimMiddleware() {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/__relay/')) return next();
    // The co-pilot bridge is the real relay's (it touches no guild host): hand it over.
    if (/^\/__relay\/(mcp|agent\/)/.test(req.url)) return realRelay(req, res, next);
    const url = new URL(req.url, 'http://relay');
    try {
      if (url.pathname === '/__relay/health') return send(res, 200, { ok: true, shim: 'devnet' });
      if (url.pathname === '/__relay/guilds') return send(res, 200, { guilds: await directory(url.searchParams.has('fresh')) });
      const m = /^\/__relay\/guild\/(\d+-\d+)\/api\/(.*)$/.exec(url.pathname);
      if (m) {
        const session = String(req.headers['x-relay-session'] || '');
        if (!SESSION_RE.test(session)) return send(res, 400, { success: false, errors: { relay: 'missing or malformed x-relay-session' }, data: null });
        if (m[2].split('/').some((s) => s === '..' || s === '.')) return send(res, 400, { success: false, errors: { relay: 'bad path' }, data: null });
        return await proxy(req, res, m[1], m[2] + url.search, session);
      }
      if (url.pathname === '/__relay/matrix/login') return send(res, 502, { error: 'no Matrix homeserver on the devnet', steps: [] });
      return send(res, 404, { error: 'no such relay route' });
    } catch (e) { return send(res, 502, { error: String(e.message || e).slice(0, 200) }); }
  };
}

export function devnetRelayPlugin() {
  return { name: 'structs-relay-devnet-shim', configureServer(s) { s.middlewares.use(shimMiddleware()); }, configurePreviewServer(s) { s.middlewares.use(shimMiddleware()); } };
}
