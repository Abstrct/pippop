/* Reading the ledger as a toy box: a kid's toys on their mat, free spots for new toys, and every
 * other kid out there. */
import { LCD_URL, lcd, num, type PlanetFull, type RawFleet, type RawPlayer } from './chain/lcd';
import type { OwnedStruct, PlayerState } from './game/empire';
import { reservedSlots } from './game/actions';
import { AMBIT_FLAG, AMBITS, typeOf, type Ambit, type StructType } from './data/catalogue';
import { REALM_OF_AMBIT, type Realm } from './lore';
import { dataGuild, gget, kidReady, type GGrid, type GPlayer, type GPlayerFull, type GRoster, type GStruct, type GFleet } from './guild/data';


export interface MatUnit {
  id: string; type: number; realm: Realm; mat: boolean; slot: number;
  offline: boolean; building: boolean; hidden: boolean; hugging: boolean; health: number; max: number;
}

export function realmOf(s: OwnedStruct): Realm { return REALM_OF_AMBIT[(s.ambit as Ambit)] || 'grass'; }

/** Every toy that stands on this kid's mat right now (wagon toys only while the wagon is home). */
export function unitsOf(p: PlayerState): MatUnit[] {
  const out: MatUnit[] = [];
  const away = p.fleet?.status === 'away';
  for (const s of p.structs.values()) {
    if (s.destroyed || !s.typeId || !s.type) continue;
    const goToy = s.type.category === 'fleet';
    if (goToy && away) continue;
    out.push({
      id: s.id, type: s.typeId, realm: realmOf(s), mat: !goToy, slot: s.slot,
      offline: s.built && !s.online, building: !s.built, hidden: s.hidden, hugging: !!s.protectedStructIndex,
      health: s.health, max: s.type.maxHealth,
    });
  }
  return out;
}

/** A free spot for a new toy of type `t`, honouring toys already on their way. */
export function freeSpot(p: PlayerState, t: StructType): { ambit: Ambit; slot: number } | null {
  const where = t.category;
  const holder = (where === 'planet' ? p.planet?.Planet : p.fleet) as unknown as Record<string, string[] | string> | undefined;
  if (!holder) return null;
  const held = reservedSlots(p.playerId);
  for (const a of AMBITS) {
    if (!(t.possibleAmbit & AMBIT_FLAG[a])) continue;
    const ids = (holder[a] as string[]) || [];
    const n = Math.max(num(holder[a + 'Slots'] as string), ids.length);
    for (let i = 0; i < n; i++) if (!ids[i] && !held.has(`${where}:${a}:${i}`)) return { ambit: a, slot: i };
  }
  return null;
}
export const freeCircle = freeSpot;

export function owned(p: PlayerState, typeId: number) {
  let n = 0;
  for (const s of p.structs.values()) if (s.typeId === typeId && !s.destroyed) n++;
  return n;
}

/* ── Every kid ── */
export interface Kid { id: string; name: string; guildId: string; planetId: string; fleetId: string; address: string }
let cache: { at: number; list: Kid[] } | null = null;

/** The newest kids with mats, straight from the ledger (one page, newest first). */
export async function kids(limit = 400): Promise<Kid[]> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.list;
  const r = await fetch(`${LCD_URL}/structs/player?pagination.limit=${limit}&pagination.reverse=true`, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`answered ${r.status}`);
  const body = await r.json() as { Player?: RawPlayer[] };
  const list = (body.Player || [])
    .filter((p) => p.planetId)
    .map((p) => ({ id: p.id, name: p.name || '', guildId: p.guildId, planetId: p.planetId, fleetId: p.fleetId, address: p.primaryAddress }));
  cache = { at: Date.now(), list };
  return list;
}
export const wardens = kids;

/** Other kids' wagons parked over this mat (first in line first). */
export async function raidersAt(planet: { Planet: { id: string; owner: string; locationListStart: string } } | null): Promise<{ fleetId: string; owner: string }[]> {
  if (!planet?.Planet.locationListStart) return [];
  const out: { fleetId: string; owner: string }[] = [];
  let id = planet.Planet.locationListStart;
  for (let guard = 0; id && guard < 24; guard++) {
    const f = await lcd.fleet(id).catch(() => null);
    if (!f) break;
    if (f.owner !== planet.Planet.owner && f.status === 'away' && f.locationId === planet.Planet.id) out.push({ fleetId: f.id, owner: f.owner });
    id = f.locationListForward;
  }
  return out;
}

/** A mat's sky holds 1 + its extra places of visiting wagons; the ledger refuses a roll into a full one.
 * 'full' when `rider` cannot roll there now, or null. */
export function skyFull(mat: PlanetFull | null | undefined, rider?: { planetId: string; fleet: RawFleet | null } | null): string | null {
  if (!mat || mat.Planet.id === rider?.planetId) return null;
  if (rider?.fleet?.status === 'away' && rider.fleet.locationId === mat.Planet.id) return null;
  const cap = 1 + num(mat.Planet.locationListExtra);
  return num(mat.Planet.locationListCount) >= cap ? 'full' : null;
}

/* ── Who has rocks lying out, and who is asleep ── */
export interface Sight { ore: number; lastAction: number }
let sightCache: { at: number; map: Map<string, Sight> } | null = null;

/** Every kid's stored (grabbable) rocks and last-move tick. Grid records are keyed
 * "<attr>-1-<kid index>": 0 is stored ore, 11 the last action's block. */
export async function sight(force = false): Promise<Map<string, Sight>> {
  if (!force && sightCache && Date.now() - sightCache.at < 60_000) return sightCache.map;
  const from = (prefix: string) => encodeURIComponent(btoa(prefix));
  const page = async (prefix: string) => {
    const r = await fetch(`${LCD_URL}/structs/grid?pagination.limit=8000&pagination.key=${from(prefix)}`);
    if (!r.ok) throw new Error(`answered ${r.status}`);
    return ((await r.json()).gridRecords || []) as { attributeId: string; value: string }[];
  };
  const [oreRecs, lastRecs] = await Promise.all([page('0-1-'), page('11-1-')]);
  const map = new Map<string, Sight>();
  const at = (pid: string) => { let s = map.get(pid); if (!s) { s = { ore: 0, lastAction: 0 }; map.set(pid, s); } return s; };
  for (const g of [...oreRecs, ...lastRecs]) {
    const m = /^(\d+)-1-(\d+)$/.exec(g.attributeId);
    if (!m) continue;
    if (m[1] === '0') at('1-' + m[2]).ore = Number(g.value) || 0;
    else if (m[1] === '11') at('1-' + m[2]).lastAction = Number(g.value) || 0;
  }
  sightCache = { at: Date.now(), map };
  return map;
}

/* ── The same, from the Guild API: a few small requests instead of the ledger's big pages ── */

/** Every kid with a mat, their names, stored rocks and last move, from the guild's index; null when
 * there is no guild session to read with (the caller falls back to the ledger). */
export async function kidsFromGuild(): Promise<{ list: Kid[]; seen: Map<string, Sight> } | null> {
  await kidReady();
  if (!dataGuild()) return null;
  const [players, ore, last] = await Promise.all([
    gget<GPlayer[]>('player/list/all/page/0?limit=10000'),
    gget<GGrid[]>('grid/attribute-type/ore/object-type/player/page/0?limit=10000').catch(() => [] as GGrid[]),
    gget<GGrid[]>('grid/attribute-type/lastAction/object-type/player/page/0?limit=10000').catch(() => [] as GGrid[]),
  ]);
  const gids = [...new Set(players.map((p) => p.guild_id).filter(Boolean))];
  const rosters = await Promise.all(gids.map((g) => gget<GRoster[]>(`guild/${g}/roster`).catch(() => [] as GRoster[])));
  const names = new Map<string, string>();
  for (const r of rosters.flat()) if (r.username) names.set(r.id, r.username);
  const seen = new Map<string, Sight>();
  const at = (id: string) => { let s = seen.get(id); if (!s) { s = { ore: 0, lastAction: 0 }; seen.set(id, s); } return s; };
  for (const g of ore) at(g.object_id).ore = Number(g.val) || 0;
  for (const g of last) at(g.object_id).lastAction = Number(g.val) || 0;
  const list = players.filter((p) => p.planet_id).map((p) => ({ id: p.id, name: names.get(p.id) || '', guildId: p.guild_id || '', planetId: p.planet_id, fleetId: p.fleet_id, address: p.primary_address }));
  return { list, seen };
}

/** One kid at a glance for their card: Bear hearts, wagon away or home, rocks lying out. */
export interface Glance { bear: { health: number; max: number } | 'gone' | null; away: boolean; ore: number; fleetAt: string }
export async function glanceFromGuild(kidId: string): Promise<Glance | null> {
  if (!dataGuild()) return null;
  const [p, structs] = await Promise.all([gget<GPlayerFull>(`player/${kidId}`), gget<GStruct[]>(`struct/player/${kidId}`).catch(() => [] as GStruct[])]);
  const fleet: GFleet | null = typeof p.fleet === 'string' ? (() => { try { return JSON.parse(p.fleet as string); } catch { return null; } })() : p.fleet;
  const cmd = structs.find((s) => (fleet?.command_struct && s.id === fleet.command_struct) || (Number(s.type) === 1 && !s.is_destroyed));
  const dead = !cmd || cmd.is_destroyed || (Number(cmd.status) & 32) !== 0 || Number(cmd.health) <= 0;
  return { bear: dead ? 'gone' : { health: Number(cmd!.health), max: typeOf(1)?.maxHealth ?? 6 }, away: fleet?.status === 'away', ore: Number(p.ore) || 0, fleetAt: fleet?.location_id || '' };
}
