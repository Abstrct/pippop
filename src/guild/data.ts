/* The Guild API as a data source: the guild's indexed copy of the whole chain, read in a handful of
 * small requests instead of hundreds of ledger reads. Its data routes need a session
 * (POST /api/auth/login with a message signed by the kid's own key).
 *
 * Two ways to hold that session, the same as the rest of the page (src/guild/relay.ts):
 *  - direct (a static build, the default): the page talks to the guild's API itself with
 *    `credentials: 'include'`. That needs the guild to answer CORS with this origin and
 *    Allow-Credentials, and its session cookie to survive a cross-site request (SameSite=None; Secure).
 *  - the relay (`vite` dev, or VITE_RELAY_URL): the relay keeps the cookie in its jar.
 * A guild that can't keep a session either way is remembered for this visit, and callers fall back to
 * the ledger. No kid, no unlocked key or no API → null. */
import { wallet } from '../wallet/wallet';
import { empire } from '../game/empire';
import { relayFetch, RELAY_BASE } from './relay';
import { guildApiBase } from './directory';

interface Envelope<T> { success: boolean; data: T; errors: Record<string, string> | unknown[] | null }

export interface GPlayer { id: string; guild_id: string; planet_id: string; fleet_id: string; primary_address: string }
export interface GGrid { object_id: string; val: string | number }
export interface GRoster { id: string; guild_id: string; username: string }
export interface GFleet { id: string; status: string; location_id: string; location_type: string; command_struct: string }
export interface GPlayerFull { id: string; guild_id: string; planet_id: string; fleet_id: string; username: string; ore: string | number; fleet: GFleet | string | null }
export interface GStruct { id: string; type: number | string; health: number | string; status: number | string; is_destroyed: boolean; location_type: string; operating_ambit: string }

let loggedIn: { guild: string; address: string } | null = null;
let loggingIn: Promise<boolean> | null = null;
let refused = new Set<string>();   // guild|address pairs that refused a login, or whose session would not stick, this visit

/** The guild whose API we can read right now, or null. */
export function dataGuild(): string | null {
  if (!wallet.unlocked) return null;
  const p = empire.commander, a = wallet.active;
  if (!p?.guildId || !a?.address || refused.has(`${p.guildId}|${a.address}`)) return null;
  return p.guildId;
}

async function call<T>(guild: string, path: string, init: RequestInit = {}): Promise<{ status: number; body: Envelope<T> | null }> {
  const headers = { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}) };
  const rest = path.replace(/^\//, '');
  let r: Response;
  if (RELAY_BASE !== null) r = await relayFetch(`/__relay/guild/${guild}/api/${rest}`, { ...init, headers, signal: AbortSignal.timeout(25000) });
  else {
    const base = await guildApiBase(guild);
    if (!base) throw new Error('no guild api');
    r = await fetch(base + rest, { ...init, headers, mode: 'cors', credentials: 'include', redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(25000) });
  }
  let body: Envelope<T> | null = null;
  try { body = await r.json(); } catch { /* not json */ }
  return { status: r.status, body };
}

async function login(guild: string): Promise<boolean> {
  const a = wallet.active;
  if (!a?.address) return false;
  const ts = (await call<{ unix_timestamp: number }>(guild, 'timestamp')).body?.data?.unix_timestamp;
  if (!ts) return false;
  const s = wallet.signMessage(a.index, `LOGIN_GUILD${guild}ADDRESS${a.address}DATETIME${ts}`);
  const r = await call(guild, 'auth/login', { method: 'POST', body: JSON.stringify({ address: s.address, signature: s.signature, pubkey: s.pubkey, guild_id: guild, unix_timestamp: ts }) });
  if (r.status < 300 && r.body?.success) { loggedIn = { guild, address: a.address }; return true; }
  refused.add(`${guild}|${a.address}`);
  return false;
}

async function ensure(guild: string): Promise<boolean> {
  const a = wallet.active;
  if (loggedIn && loggedIn.guild === guild && loggedIn.address === a?.address) return true;
  if (!loggingIn) loggingIn = login(guild).catch(() => false).finally(() => { loggingIn = null; });
  return loggingIn;
}

/** A page opened straight onto the map has not read its kid yet: wait a moment for it. */
export async function kidReady(ms = 5000): Promise<void> {
  if (empire.commander || !wallet.active?.playerId || !wallet.unlocked) return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(done, ms);
    const off = empire.onChange(() => { if (empire.commander) done(); });
    function done() { clearTimeout(t); queueMicrotask(() => off()); resolve(); }
  });
}

/** GET a data route as the logged-in kid; logs in (again) when the guild asks. Throws on failure. */
export async function gget<T>(path: string): Promise<T> {
  const guild = dataGuild();
  if (!guild) throw new Error('no guild data');
  if (!(await ensure(guild))) throw new Error('no login');
  let r = await call<T>(guild, path);
  if (r.status === 401) {
    loggedIn = null;
    if (!(await ensure(guild))) throw new Error('no login');
    r = await call<T>(guild, path);
    // logged in a moment ago and still a stranger: the browser is not keeping the guild's session
    // cookie for this page (a cross-site cookie it blocks). Stop asking; the ledger answers instead.
    if (r.status === 401) { const a = wallet.active; if (a?.address) refused.add(`${guild}|${a.address}`); loggedIn = null; }
  }
  if (r.status >= 300 || !r.body?.success) throw new Error(`guild api ${r.status}`);
  return r.body.data;
}

/** A forgotten key or another kid: the old session is not theirs. */
wallet.onForget(() => { loggedIn = null; refused = new Set(); });
