/* Where a kid's stars live (ledger v0.22). Each player has a vault: a protocol address that holds what
 * the game spends (Feed, Fill, Give). Stars that still sit on the key's own address are "retained":
 * they are the player's, but a vault spend can't reach them. So a spend takes the vault first and, when
 * that is short, the same transaction first moves just the shortfall from the key's address into the
 * vault (MsgPlayerSend). Never more, never as a separate send, never in the background.
 *
 * Reactor positions follow the same order the other way: a Take draws on the vault's position first,
 * then the key address's older one, each with its own selector, all in one transaction. */
import { lcd, big, type RawInfusion } from '../chain/lcd';
import type { Msg } from '../wallet/encode';
import type { PlayerState } from './empire';

const M = (name: string, value: Record<string, unknown>): Msg => ({ typeUrl: `/structs.structs.${name}`, value });
const ualpha = (n: bigint) => ({ denom: 'ualpha', amount: n.toString() });

/** A vault's address never changes: one read per player per visit. */
const vaults = new Map<string, Promise<string>>();
export function vaultOf(playerId: string): Promise<string> {
  let v = vaults.get(playerId);
  if (!v) {
    v = lcd.vault(playerId).then((r) => { if (r.ownerId !== playerId || !r.address) throw new Error('vault lookup changed'); return r.address; });
    v.catch(() => vaults.delete(playerId));
    vaults.set(playerId, v);
  }
  return v;
}

/** Everything a player can spend: the vault plus what the key's own address still holds. */
export const available = (p: PlayerState) => p.alpha + p.retained;

export interface Funding { vault: string; inVault: bigint; retained: bigint }

/** Fresh balances for a spend, read together just before it is queued. */
export async function readFunding(p: PlayerState): Promise<Funding> {
  const vault = p.vault || (await vaultOf(p.playerId));
  const [inVault, retained] = await Promise.all([lcd.spendable(vault), lcd.spendable(p.address)]);
  return { vault, inVault, retained };
}

/** The collection legs a spend of `amount` from the vault needs, or throws when even both can't cover it. */
export function collect(p: PlayerState, f: Funding, amount: bigint): Msg[] {
  const short = amount > f.inVault ? amount - f.inVault : 0n;
  if (short === 0n) return [];
  if (short > f.retained) throw new Error('stars');
  return [M('MsgPlayerSend', { from_address: p.address, to_address: f.vault, amount: [ualpha(short)] })];
}

/** Fill: stake `amount` into a reactor from the vault (topped up from the key's address if needed). */
export async function fillMsgs(p: PlayerState, validator: string, amount: bigint): Promise<Msg[]> {
  const f = await readFunding(p);
  return [...collect(p, f, amount), M('MsgReactorInfuse', { validator_address: validator, amount: ualpha(amount), ownerId: p.playerId })];
}

/** Feed: burn `amount` into a generator. The chain only spends the vault for this. */
export async function feedMsgs(p: PlayerState, structId: string, amount: bigint): Promise<Msg[]> {
  const f = await readFunding(p);
  return [...collect(p, f, amount), M('MsgStructGeneratorInfuse', { structId, infuseAmount: `${amount}ualpha` })];
}

/** Give: vault to vault, player to player. */
export async function giveMsgs(p: PlayerState, toPlayerId: string, amount: bigint): Promise<Msg[]> {
  const f = await readFunding(p);
  return [...collect(p, f, amount), M('MsgVaultSend', { ownerId: p.playerId, recipientOwnerId: toPlayerId, amount: [ualpha(amount)] })];
}

/** A player's stake in one reactor: the vault's position and the key address's, either may be absent. */
export interface Stake { vault: RawInfusion | null; key: RawInfusion | null; total: bigint }
export async function stakeIn(p: PlayerState, reactorId: string): Promise<Stake> {
  const vault = p.vault || (await vaultOf(p.playerId));
  const [v, k] = await Promise.all([lcd.infusion(reactorId, vault), vault === p.address ? null : lcd.infusion(reactorId, p.address)]);
  // a position here owned by somebody else (a guild's, say) isn't ours to take
  const mine = (i: RawInfusion | null) => (i && (i.ownerId || i.playerId) === p.playerId ? i : null);
  const vv = mine(v), kk = mine(k);
  return { vault: vv, key: kk, total: big(vv?.fuel) + big(kk?.fuel) };
}

/** Take: unstake `amount` from a reactor, the vault's position first, then the key address's. */
export function takeMsgs(p: PlayerState, validator: string, s: Stake, amount: bigint): Msg[] {
  if (amount <= 0n || amount > s.total) throw new Error('stars');
  const fromVault = big(s.vault?.fuel) < amount ? big(s.vault?.fuel) : amount;
  const rest = amount - fromVault;
  const out: Msg[] = [];
  if (fromVault > 0n) out.push(M('MsgReactorDefuse', { validator_address: validator, amount: ualpha(fromVault), ownerId: p.playerId }));
  if (rest > 0n) out.push(M('MsgReactorDefuse', { delegator_address: s.key!.address, validator_address: validator, amount: ualpha(rest) }));
  return out;
}
