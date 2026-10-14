/* Game verbs: every struct, fleet and planet action as one call that checks what it can,
 * names itself, prices its charge and queues the transaction. (The engine, borrowed whole; only
 * the labels speak toy.) */
import { txq, type TxJob } from '../wallet/queue';
import { wallet } from '../wallet/wallet';
import { empire, type OwnedStruct, type PlayerState } from './empire';
import { typeOf, type StructType, type WeaponSystem } from '../data/catalogue';
import { beastName } from '../lore';

const M = (name: string, value: Record<string, unknown>) => ({ typeUrl: `/structs.structs.${name}`, value });

export interface Verb { id: string; label: string; icon: string; cost: number; danger?: boolean; run: () => TxJob }

function q(p: PlayerState, name: string, value: Record<string, unknown>, label: string, cost?: number, source = 'you'): TxJob {
  return txq.enqueue(M(name, value), {
    account: p.account, playerId: p.playerId, label, source,
    lane: cost != null ? 'action' : 'immediate', chargeCost: cost,
  });
}

export const act = {
  build(p: PlayerState, t: StructType, ambit: string, slot: number, source?: string) {
    return q(p, 'MsgStructBuildInitiate', { playerId: p.playerId, structTypeId: t.id, operatingAmbit: ambit, slot }, `Make · ${beastName(t.id)}`, t.buildCharge, source);
  },
  cancelBuild: (p: PlayerState, s: OwnedStruct) => q(p, 'MsgStructBuildCancel', { structId: s.id }, `Stop · ${name(s)}`),
  activate: (p: PlayerState, s: OwnedStruct, source?: string) => q(p, 'MsgStructActivate', { structId: s.id }, `Wake · ${name(s)}`, s.type?.activateCharge ?? 0, source),
  deactivate: (p: PlayerState, s: OwnedStruct) => q(p, 'MsgStructDeactivate', { structId: s.id }, `Nap · ${name(s)}`),
  stealthOn: (p: PlayerState, s: OwnedStruct) => q(p, 'MsgStructStealthActivate', { structId: s.id }, `Hide · ${name(s)}`, s.type?.stealthActivateCharge ?? 0),
  stealthOff: (p: PlayerState, s: OwnedStruct) => q(p, 'MsgStructStealthDeactivate', { structId: s.id }, `Peek · ${name(s)}`, s.type?.stealthActivateCharge ?? 0),
  defend: (p: PlayerState, s: OwnedStruct, protectedId: string, source?: string) => q(p, 'MsgStructDefenseSet', { defenderStructId: s.id, protectedStructId: protectedId }, `Hug · ${name(s)} · ${nameOf(protectedId)}`, s.type?.defendChangeCharge ?? 0, source),
  clearDefense: (p: PlayerState, s: OwnedStruct) => q(p, 'MsgStructDefenseClear', { defenderStructId: s.id }, `Free · ${name(s)}`, s.type?.defendChangeCharge ?? 0),
  move: (p: PlayerState, s: OwnedStruct, locationType: 'planet' | 'fleet', ambit: string, slot: number) =>
    q(p, 'MsgStructMove', { structId: s.id, locationType, ambit, slot }, `Hop · ${name(s)} · ${ambit}`, s.type?.moveCharge ?? 0),
  attack(p: PlayerState, s: OwnedStruct, targets: string[], weapon: WeaponSystem, source?: string) {
    const t = s.type!;
    const cost = weapon === 'primaryWeapon' ? t.primaryWeaponCharge : t.secondaryWeaponCharge;
    return q(p, 'MsgStructAttack', { operatingStructId: s.id, targetStructId: targets, weaponSystem: weapon }, `Bonk · ${name(s)} · ${targets.map(nameOf).join(' ')}`, cost, source);
  },
  infuseGenerator: (p: PlayerState, s: OwnedStruct, ualpha: bigint) => q(p, 'MsgStructGeneratorInfuse', { structId: s.id, infuseAmount: `${ualpha}ualpha` }, `Feed · ${name(s)}`),
  trash: (p: PlayerState, s: OwnedStruct) => q(p, 'MsgStructTrash', { structId: s.id }, `Toss · ${name(s)}`, s.type?.buildCharge ?? 8),
  fleetMove(p: PlayerState, destination: string, source?: string) {
    // a second press while the wagon's last move is still on its way is the same move, not another
    const going = txq.active.find((j) => j.playerId === p.playerId && j.msgs.some((m) => m.typeUrl.endsWith('MsgFleetMove')));
    if (going) return going;
    return q(p, 'MsgFleetMove', { fleetId: p.fleetId, destinationLocationId: destination }, destination === p.planetId ? 'Home' : 'Roll', undefined, source);
  },
  explore: (p: PlayerState, source?: string) => q(p, 'MsgPlanetExplore', { playerId: p.playerId }, 'Find', undefined, source),
  renamePlanet: (p: PlayerState, nm: string) => q(p, 'MsgPlanetUpdateName', { planetId: p.planetId, name: nm }, `Name · ${nm}`),
  renamePlayer: (p: PlayerState, nm: string) => q(p, 'MsgPlayerUpdateName', { playerId: p.playerId, name: nm }, `Name · ${nm}`),
  send: (p: PlayerState, to: string, ualpha: bigint, source?: string) => q(p, 'MsgPlayerSend', { from_address: p.address, to_address: to, amount: [{ denom: 'ualpha', amount: ualpha.toString() }] }, 'Give', undefined, source),
};

/** Why the chain would refuse a build for this player right now (BuildInitiateReadiness and
 * MsgStructBuildInitiate in v0.21), or null when it would take it. */
export function buildBlock(p: PlayerState, t?: StructType): string | null {
  if (!p.online) return 'juice';
  const f = p.fleet;
  if (!f || f.status === 'away') return 'away';
  const cmd = f.commandStruct ? p.structs.get(f.commandStruct) : undefined;
  if (!cmd || cmd.destroyed) return 'bear';
  if (!cmd.online) return 'nap';
  if (t && p.load + p.structsLoad + BigInt(t.buildDraw) > p.capacity + p.connectionCapacity) return 'juice';
  return null;
}

/** Why struct actions (attack, guard, move, stealth, activate) would be refused for the player, or null. */
export const actionBlock = (p: PlayerState): string | null => (p.online ? null : 'juice');

/** Slots a queued build or move is already headed for ("planet:land:0"): don't offer them twice. */
export function reservedSlots(playerId: string): Set<string> {
  const out = new Set<string>();
  for (const j of txq.active) {
    if (j.playerId !== playerId) continue;
    for (const m of j.msgs) {
      const v = m.value as Record<string, unknown>;
      if (m.typeUrl.endsWith('MsgStructBuildInitiate')) out.add(`${typeOf(Number(v.structTypeId))?.category}:${v.operatingAmbit}:${v.slot}`);
      // A Command Ship changes battleground without taking a slot.
      if (m.typeUrl.endsWith('MsgStructMove') && empire.players.get(playerId)?.structs.get(String(v.structId))?.typeId !== 1) out.add(`${v.locationType}:${v.ambit}:${v.slot}`);
    }
  }
  return out;
}

/** Why a new mat cannot be found right now ('rocks': the old one still holds ore; 'away': the wagon
 * is out), or null. Finding one completes the old mat: the chain destroys every mat toy on it. */
export function findBlock(p: PlayerState): string | null {
  if (!p.planetId || !p.planet) return null;
  if (Number(p.planet.gridAttributes?.ore || 0) > 0) return 'rocks';
  if (p.fleet?.status === 'away') return 'away';
  return null;
}
/** The mat toys a new mat would leave behind, by type. */
export function matToysOn(p: PlayerState): number[] {
  const out: number[] = [];
  for (const s of p.structs.values()) if (!s.destroyed && s.type?.category === 'planet' && s.locationId === p.planetId) out.push(s.typeId);
  return out;
}

/** "Again" is for a refusal just heard; a stale one could do harm, so it is offered briefly and only
 * while the rite still makes sense. */
export const AGAIN_MS = 2 * 60_000;
export function canRetry(j: TxJob, now = Date.now()): boolean {
  if (j.status !== 'failed' || now - j.updatedAt > AGAIN_MS) return false;
  if (j.playerId && !wallet.byPlayer(j.playerId)) return false;
  const p = j.playerId ? empire.players.get(j.playerId) : undefined;
  for (const m of j.msgs) {
    const v = m.value as Record<string, unknown>;
    const named = [v.structId, v.operatingStructId, v.defenderStructId, v.protectedStructId, ...(Array.isArray(v.targetStructId) ? v.targetStructId : [])];
    if (named.some((id) => typeof id === 'string' && fallen(id))) return false;
    if (m.typeUrl.endsWith('MsgFleetMove') && p?.fleet && p.fleet.locationId === v.destinationLocationId) return false;
    if (m.typeUrl.endsWith('MsgPlanetExplore') && p?.planetId) return false;
  }
  return true;
}
function fallen(id: string) { for (const pl of empire.players.values()) { const s = pl.structs.get(id); if (s) return s.destroyed; } return false; }

export const name = (s: OwnedStruct) => beastName(s.typeId);
function nameOf(id: string) { for (const pl of empire.players.values()) { const s = pl.structs.get(id); if (s?.type) return beastName(s.typeId); } return 'Toy'; }

/** What a toy can do right now (and what each costs). */
export function verbsFor(p: PlayerState, s: OwnedStruct): Verb[] {
  const t = s.type;
  if (!t || s.destroyed) return [];
  const v: Verb[] = [];
  if (!s.built) {
    v.push({ id: 'cancel', label: 'Stop', icon: 'no', cost: 0, danger: true, run: () => act.cancelBuild(p, s) });
    return v;
  }
  if (s.online) v.push({ id: 'off', label: 'Nap', icon: 'nap', cost: 0, run: () => act.deactivate(p, s) });
  else v.push({ id: 'on', label: 'Wake', icon: 'wake', cost: t.activateCharge, run: () => act.activate(p, s) });
  if (t.stealthSystems) {
    if (s.hidden) v.push({ id: 'unstealth', label: 'Peek', icon: 'peek', cost: t.stealthActivateCharge, run: () => act.stealthOff(p, s) });
    else v.push({ id: 'stealth', label: 'Hide', icon: 'hide', cost: t.stealthActivateCharge, run: () => act.stealthOn(p, s) });
  }
  if (s.protectedStructIndex) v.push({ id: 'undefend', label: 'Free', icon: 'free', cost: t.defendChangeCharge, run: () => act.clearDefense(p, s) });
  return v;
}

/** Struct types buildable in a slot of this kind and ambit. */
export function buildable(where: 'planet' | 'fleet', ambit: string): StructType[] {
  const flag: Record<string, number> = { water: 2, land: 4, air: 8, space: 16 };
  const out: StructType[] = [];
  for (let id = 1; id < 64; id++) {
    const t = typeOf(id);
    if (!t || t.category !== where || id === 1) continue;
    if (t.possibleAmbit & (flag[ambit] || 0)) out.push(t);
  }
  return out;
}

export const signerFor = (playerId: string) => wallet.byPlayer(playerId);
export const stateOf = (playerId: string) => empire.players.get(playerId) ?? null;
