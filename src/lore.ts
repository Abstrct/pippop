/* The toy box in words. Pip Pop never says a sentence: every thing has one small word and a symbol,
 * every refusal becomes one word, every rite becomes one verb. Mechanics come from the catalogue
 * (src/data/catalogue.ts); only the names change here. */
import { typeOf, type Ambit } from './data/catalogue';

/* ── The colours (one toy-box palette, used by the page and the 3D world) ── */
export const C = {
  red: '#E4002B', sun: '#FFC72C', blue: '#0077C8', leaf: '#43B02A', peach: '#FF8F1C', plum: '#8246AF',
  sky: '#41B6E6', ink: '#1D2A5C', cream: '#FFF8E7', white: '#FFFFFF', pink: '#FF8FB1', brown: '#B07A42',
} as const;

/* ── Where toys stand: four levels of the stacking pole ── */
export type Realm = 'moon' | 'sky' | 'grass' | 'tub';
export const REALM_OF_AMBIT: Record<Ambit, Realm> = { space: 'moon', air: 'sky', land: 'grass', water: 'tub' };
export const AMBIT_OF_REALM: Record<Realm, Ambit> = { moon: 'space', sky: 'air', grass: 'land', tub: 'water' };
export const REALMS: Realm[] = ['moon', 'sky', 'grass', 'tub'];
export const REALM_NAME: Record<Realm, string> = { moon: 'Moon', sky: 'Sky', grass: 'Grass', tub: 'Tub' };
export const REALM_COLOR: Record<Realm, string> = { moon: C.plum, sky: C.sky, grass: C.leaf, tub: C.blue };

/* ── The toys ── */
export interface Toy { word: string; color: string; icon: string }
export const TOYS: Record<number, Toy> = {
  1: { word: 'Bear', color: C.brown, icon: 'bear' },
  2: { word: 'Rocket', color: C.red, icon: 'rocket' },
  3: { word: 'Zoom', color: C.sun, icon: 'zoom' },
  4: { word: 'Saucer', color: C.plum, icon: 'saucer' },
  5: { word: 'Plane', color: C.red, icon: 'plane' },
  6: { word: 'Kite', color: C.peach, icon: 'kite' },
  7: { word: 'Copter', color: C.blue, icon: 'copter' },
  8: { word: 'Choo', color: C.red, icon: 'choo' },
  9: { word: 'Truck', color: C.sun, icon: 'truck' },
  10: { word: 'Squirt', color: C.leaf, icon: 'squirt' },
  11: { word: 'Duck', color: C.sun, icon: 'duck' },
  12: { word: 'Boat', color: C.red, icon: 'boat' },
  13: { word: 'Fish', color: C.peach, icon: 'fish' },
  14: { word: 'Digger', color: C.sun, icon: 'digger' },
  15: { word: 'Popper', color: C.blue, icon: 'popper' },
  16: { word: 'Bubble', color: C.sky, icon: 'bubble' },
  17: { word: 'Rattle', color: C.pink, icon: 'rattle' },
  18: { word: 'Piggy', color: C.pink, icon: 'piggy' },
  19: { word: 'Popgun', color: C.blue, icon: 'popgun' },
  20: { word: 'Pinwheel', color: C.leaf, icon: 'pinwheel' },
  21: { word: 'Windmill', color: C.plum, icon: 'windmill' },
  22: { word: 'Sun', color: C.sun, icon: 'sun' },
};
export const toy = (typeId: number): Toy => TOYS[typeId] ?? { word: 'Toy', color: C.sky, icon: 'make' };
export const beastName = (typeId: number) => toy(typeId).word;
export const toyWord = beastName;
export const isMatToy = (typeId: number) => typeOf(typeId)?.category === 'planet';

/** The toy a ledger type name stands for ("Command Ship" → Bear). */
export function toyOfLedgerName(name?: string): number {
  if (!name) return 0;
  for (let id = 1; id <= 22; id++) if (typeOf(id)?.type === name) return id;
  return 0;
}

/** Tricks, by the chain's unitDefenses value. */
export const WARD_CRAFT: Record<string, string> = {
  noUnitDefenses: '—', signalJamming: 'Wiggle', defensiveManeuver: 'Duck', stealthMode: 'Hide',
  armour: 'Tough', indirectCombatModule: 'Lob',
};
export const TRICK_ICON: Record<string, string> = { signalJamming: 'rattle', defensiveManeuver: 'duck', stealthMode: 'hide', armour: 'fort', indirectCombatModule: 'choo' };

export function reachOf(mask: number): Realm[] {
  const out: Realm[] = [];
  if (mask & 16) out.push('moon');
  if (mask & 8) out.push('sky');
  if (mask & 4) out.push('grass');
  if (mask & 2) out.push('tub');
  return out;
}

/* ── Counting ── */
/** Juice (energy): milliwatts → a toy number. */
export const juice = (mw: bigint | number) => Math.round(Number(mw) / 1000);
export const fmtJuice = (mw: bigint | number) => short(juice(mw));
/** Stars (alpha): ualpha → stars, one per gram. */
export const stars = (ualpha: bigint) => Number(ualpha) / 1e6;
export function fmtStars(ualpha: bigint) {
  const n = stars(ualpha);
  if (n === 0) return '0';
  if (n < 10) return (Math.floor(n * 100) / 100).toString();
  return short(n);
}
export function short(n: number) {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}
/** The engine asks for these by their old names. */
export const sheaves = (n: number) => `${n} rocks`;
export const fmtMana = fmtJuice;
export const fmtAlpha = fmtStars;
export const fmtBreath = (n: number) => (n >= 99 ? '99' : String(n));

/** Ticks as a wait a person can feel. One tick is about six seconds. */
export function ticksAsTime(n: number) {
  const s = Math.max(0, n) * 6;
  if (s < 60) return `${Math.max(5, Math.round(s / 5) * 5)}s`;
  const m = s / 60;
  if (m < 90) return `${Math.round(m)}m`;
  const hr = m / 60;
  return hr < 36 ? `${Math.round(hr)}h` : `${Math.round(hr / 24)}d`;
}
export const bellsAsTime = ticksAsTime;

/* ── Clubs ── */
export const CLUB_COLORS = [C.red, C.blue, C.sun, C.leaf, C.peach, C.plum, C.sky, C.pink];
export function clubColor(id: string) { const n = Number(String(id).split('-')[1] || 0); return CLUB_COLORS[(n - 1 + CLUB_COLORS.length * 8) % CLUB_COLORS.length]; }
export const CLUB_ANIMALS = ['Owl', 'Frog', 'Cat', 'Pup', 'Bun', 'Fox', 'Bee', 'Cub', 'Ram', 'Hen', 'Yak', 'Elk'];
/** A club's name: its own published short name when it is one simple word, else an animal. */
export function clubName(id: string, published?: string) {
  if (!id) return 'Wild';
  const p = (published || '').trim();
  if (p && /^[A-Za-z]{2,10}$/.test(p)) return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  const first = p.split(/\s+/).find((w) => /^[A-Za-z]{2,9}$/.test(w) && !/^(the|of|and|guild|a)$/i.test(w));
  if (first) return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  const n = Number(id.split('-')[1] || 0);
  return CLUB_ANIMALS[(n - 1 + CLUB_ANIMALS.length * 8) % CLUB_ANIMALS.length];
}

/* ── Kids ── */
const FIRST = ['Pip', 'Bo', 'Dot', 'Kip', 'Lu', 'Mo', 'Nim', 'Tot', 'Bix', 'Zu', 'Fen', 'Wix', 'Gus', 'Ree', 'Jo', 'Pim', 'Tik', 'Bun', 'Ollie', 'Mimi'];
const LAST = ['by', 'po', 'zoo', 'kins', 'loo', 'pop', 'bee', 'boo', 'dee', 'sy', 'mo', 'lo', 'tot', 'ba'];
export const rollName = () => FIRST[Math.floor(Math.random() * FIRST.length)] + LAST[Math.floor(Math.random() * LAST.length)];
export const kidName = (p: { name?: string; playerId?: string; id?: string }) => {
  const id = p.playerId || p.id || '';
  return p.name && p.name !== id ? p.name : id.split('-')[1] || '?';
};

/* ── One word for every refusal ── */
export interface Word { w: string; i: string }
const OOPS: [RegExp, Word][] = [
  [/sealed|locked|soulstone|unseal|passphrase/i, { w: 'Key', i: 'key' }],
  [/breath|charge|next bell|this bell|one .* at a time/i, { w: 'Wind', i: 'wind' }],
  [/mana|load|capacity|overdrawn|drink more|power/i, { w: 'Juice', i: 'juice' }],
  [/slumber|offline|asleep/i, { w: 'Nap', i: 'nap' }],
  [/abroad|away|on_station|is home|at home/i, { w: 'Away', i: 'wagon' }],
  [/queue_full|full sky|hangs first|first in line|another warband|not_first/i, { w: 'Full', i: 'full' }],
  [/guards their isle|shields_active|still guards/i, { w: 'Bear', i: 'bear' }],
  [/raiders|under_raid/i, { w: 'Grab', i: 'grab' }],
  [/alpha|insufficient funds|funds/i, { w: 'Stars', i: 'star' }],
  [/reach|unreachable|out_of_range|beyond/i, { w: 'Far', i: 'far' }],
  [/veil|hidden/i, { w: 'Hide', i: 'hide' }],
  [/fallen|destroyed|felled/i, { w: 'Gone', i: 'gone' }],
  [/dug out|ore available|still holds/i, { w: 'Rocks', i: 'rock' }],
  [/spent|empty|nothing to mine|complete, move on/i, { w: 'Empty', i: 'empty' }],
  [/no elder wyrm|no command|command struct/i, { w: 'Bear', i: 'bear' }],
  [/permission|not yours|no right/i, { w: 'No', i: 'no' }],
  [/only one|limit|already/i, { w: 'Got', i: 'check' }],
  [/answer|timeout|fetch|network|reach the|did not|silent|keeper/i, { w: 'Slow', i: 'slow' }],
];
/** The short codes the game's own checks return (buildBlock, findBlock…). */
const CODES: Record<string, Word> = {
  nap: { w: 'Nap', i: 'nap' }, juice: { w: 'Juice', i: 'juice' }, bear: { w: 'Bear', i: 'bear' }, away: { w: 'Away', i: 'wagon' },
  rocks: { w: 'Rocks', i: 'rock' }, wind: { w: 'Wind', i: 'wind' }, full: { w: 'Full', i: 'full' }, key: { w: 'Key', i: 'key' },
};
export function oops(text?: string): Word {
  const t = String(text || '');
  if (CODES[t]) return CODES[t];
  for (const [re, w] of OOPS) if (re.test(t)) return w;
  return { w: 'Oops', i: 'oops' };
}
/** Old engine sentences pass through here on their way to the screen: they become one word. */
export const speak = (text: string) => oops(text).w;
export const retell = speak;
export const retellError = speak;

/* ── One verb for every rite ── */
const VERB: [RegExp, Word][] = [
  [/StructBuildInitiate$/, { w: 'Make', i: 'make' }], [/StructBuildComplete$/, { w: 'Make', i: 'make' }], [/StructBuildCancel$/, { w: 'Stop', i: 'no' }],
  [/StructActivate$/, { w: 'Wake', i: 'wake' }], [/StructDeactivate$/, { w: 'Nap', i: 'nap' }],
  [/StructStealthActivate$/, { w: 'Hide', i: 'hide' }], [/StructStealthDeactivate$/, { w: 'Peek', i: 'peek' }],
  [/StructDefenseSet$/, { w: 'Hug', i: 'hug' }], [/StructDefenseClear$/, { w: 'Free', i: 'free' }],
  [/StructMove$/, { w: 'Hop', i: 'hop' }], [/StructAttack$/, { w: 'Bonk', i: 'bonk' }],
  [/StructGeneratorInfuse$/, { w: 'Feed', i: 'feed' }], [/StructTrash$/, { w: 'Toss', i: 'toss' }],
  [/FleetMove$/, { w: 'Roll', i: 'roll' }], [/PlanetExplore$/, { w: 'Find', i: 'find' }],
  [/PlanetRaidComplete$/, { w: 'Grab', i: 'grab' }], [/OreMinerComplete$/, { w: 'Dig', i: 'dig' }], [/OreRefineryComplete$/, { w: 'Pop', i: 'pop' }],
  [/ReactorInfuse$/, { w: 'Fill', i: 'fridge' }], [/ReactorDefuse$/, { w: 'Take', i: 'take' }],
  [/PlayerUpdateName$|PlanetUpdateName$/, { w: 'Name', i: 'kid' }], [/PlayerSend$/, { w: 'Give', i: 'star' }],
  [/GuildMembership/, { w: 'Club', i: 'club' }],
];
export function verbOf(typeUrl: string): Word {
  for (const [re, w] of VERB) if (re.test(typeUrl)) return w;
  return { w: 'Do', i: 'make' };
}

/** How long ago something happened, as a toy clock. */
export function agoMs(t: number, now = Date.now()) {
  const s = (now - t) / 1000;
  if (s < 45) return 'now';
  return ticksAsTime(s / 6);
}

/** A wait, short: "now", "20s", "3m", "2h", "4d". */
export function fmtWait(secs: number): string {
  if (!Number.isFinite(secs)) return '…';
  if (secs < 3) return 'now';
  if (secs < 60) return `${Math.round(secs / 5) * 5 || 5}s`;
  if (secs < 5400) return `${Math.round(secs / 60)}m`;
  if (secs < 172800) return `${Math.round(secs / 3600)}h`;
  return `${Math.round(secs / 86400)}d`;
}
