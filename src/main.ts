/* Pip Pop wakes up: the sky (one three.js world behind everything), the ledger's pulse, the key
 * (wallet), the kid it plays (empire), the shake engine (proof of work) and the rite queue — then
 * the rooms, routed by hash. */
import './styles.css';
import { live } from './chain/live';
import { wallet } from './wallet/wallet';
import { empire } from './game/empire';
import { pow } from './pow/pow';
import { txq } from './wallet/queue';
import { resumeEnlist } from './game/enlist';
import { canRetry } from './game/actions';
import { takeClaim } from './core/claims';
import { bubble } from './core/dom';
import { audio, ambience } from './core/audio';
import { world } from './world/world';
import { mountHud, shout } from './ui/hud';
import { mountGuide } from './ui/hand';
import { kidName, oops, verbOf, toy, toyOfLedgerName } from './lore';
import type { Screen, Ctx } from './screens/types';

const ROOMS: Record<string, () => Promise<(ctx: Ctx) => Screen>> = {
  '': () => import('./screens/mat').then((m) => m.mat),
  mat: () => import('./screens/mat').then((m) => m.mat),
  toys: () => import('./screens/toys').then((m) => m.toys),
  sky: () => import('./screens/sky').then((m) => m.sky),
  bonk: () => import('./screens/bonk').then((m) => m.bonk),
  fridge: () => import('./screens/fridge').then((m) => m.fridge),
  book: () => import('./screens/book').then((m) => m.book),
  hi: () => import('./screens/hi').then((m) => m.hi),
};

const app = document.getElementById('app')!;
let current: Screen | null = null;
let routing = 0;

/** A room and its parameter, or where a bad link should land instead. */
function parse(): { name: string; param?: string; fix?: string } {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [name, p0] = raw.split('/');
  let param = p0 ? decodeURIComponent(p0) : undefined;
  if (name && !ROOMS[name]) return { name: '', fix: '#/' };
  // only kid ids go to a mat or a fight; only real toys to the shelf
  if ((name === 'mat' || name === 'bonk') && param && !/^1-\d+$/.test(param)) return { name, fix: name === 'mat' ? '#/' : '#/bonk' };
  if (name === 'toys' && param && !(Number(param) >= 1 && Number(param) <= 22)) param = undefined;
  return { name, param };
}

async function route() {
  const my = ++routing;
  const r = parse();
  if (r.fix) { history.replaceState(null, '', r.fix); return route(); }
  const make = await ROOMS[r.name]();
  if (my !== routing) return;
  current?.leave();
  document.querySelectorAll('.veil').forEach((v) => v.remove());
  const keep = app.querySelector('#hud');
  for (const c of [...app.children]) if (c !== keep) c.remove();
  document.body.dataset.room = r.name || 'mat';
  try {
    current = make({ param: r.param, go: (p) => { if (location.hash === p) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = p; } });
  } catch (e) {
    // a room that will not open never strands you: say so, and stay in the sky
    console.error('[pippop] room failed', e);
    current = null;
    bubble('Oops', 'oops', 'uh', { action: { label: 'Mat', icon: 'mat', run: () => { location.hash = '#/'; } } });
    return;
  }
  app.append(current.el);
  document.title = current.title ? `${current.title} · Pip Pop` : 'Pip Pop';
  audio.chime('tap');
}

/* Rites that land or fail: one bubble each, wherever you are. */
const toyIn = (j: { msgs: { value: unknown }[] }) => {
  const v = (j.msgs[0]?.value || {}) as Record<string, unknown>;
  if (v.structTypeId) return toy(Number(v.structTypeId)).icon;
  const sid = String(v.structId || v.operatingStructId || v.defenderStructId || '');
  for (const p of empire.players.values()) { const s = p.structs.get(sid); if (s) return toy(s.typeId).icon; }
  return undefined;
};
txq.onSettled((j) => {
  const url = j.msgs[0]?.typeUrl || '';
  const v = verbOf(url);
  if (j.status === 'success') {
    if (/PlanetRaidComplete$/.test(url)) return; // the shout tells it
    if (j.source === 'pow' && /OreMinerComplete|OreRefineryComplete/.test(url) && document.body.dataset.room === 'mat') return; // the mat tells it
    if (/StructAttack$/.test(url) && document.body.dataset.room === 'bonk') return;
    bubble(v.w, v.i, 'yay', { toy: toyIn(j) });
    return;
  }
  if (j.status !== 'failed' || takeClaim(j.id)) return;
  if (j.source === 'pow' && /PlanetRaidComplete$/.test(url)) return;
  const w = oops(j.error);
  bubble(w.w, w.i, 'uh', { toy: v.i, ms: 6000, action: canRetry(j) ? { label: 'Again', icon: 'roll', run: () => { if (canRetry(j)) txq.retry(j.id); } } : undefined });
});

/* Grabs and bonks out in the sky. */
const seen = new Set<string>();
const un = (d: unknown, k: string) => (d && typeof d === 'object' && k in (d as object) ? (d as Record<string, unknown>)[k] : d) as Record<string, unknown>;
let lastStruck = 0;
live.onTx((tx) => {
  const ids = new Set(wallet.playerIds());
  const planets = new Set<string>(), fleets = new Set<string>();
  for (const p of empire.players.values()) if (ids.has(p.playerId)) { if (p.planetId) planets.add(p.planetId); if (p.fleetId) fleets.add(p.fleetId); }
  for (const e of tx.events) {
    if (e.type === 'EventRaid') {
      const d = un(e.data, 'eventRaidDetail');
      const key = `${d.fleetId}|${d.planetId}|${d.status}|${tx.height}`;
      if (seen.has(key)) continue; seen.add(key);
      const theft = tx.events.find((x) => x.type === 'EventOreTheft');
      const seized = Number(d.seized_ore ?? d.seizedOre ?? (theft ? un(theft.data, 'eventOreTheftDetail').amount : 0) ?? 0) || 0;
      if (d.status === 'raidSuccessful' && fleets.has(String(d.fleetId))) {
        audio.chime('grab');
        if (seized > 0) shout('+' + seized, 'rock'); else shout('Empty', 'empty', 'uh');
      } else if (d.status === 'raidSuccessful' && planets.has(String(d.planetId))) {
        shout(seized > 0 ? '-' + seized : 'Uh oh!', seized > 0 ? 'rock' : 'grab', 'uh');
        const thief = theft ? String(un(theft.data, 'eventOreTheftDetail').thiefPlayerId || '') : '';
        const who = thief ? empire.players.get(thief) : undefined;
        bubble(who ? kidName(who) : thief ? thief.split('-')[1] : 'Grab', 'grab', 'uh', { toy: 'rock', ms: 9000 });
      }
      else if (planets.has(String(d.planetId)) && d.status === 'initiated') bubble('Raid!', 'grab', 'uh', { ms: 8000, action: { label: 'Bonk', icon: 'bonk', run: () => { location.hash = '#/bonk'; } } });
      else if (planets.has(String(d.planetId)) && d.status === 'attackerDefeated') shout('Yay!', 'bear');
    }
    if (e.type === 'EventAttack') {
      const d = un(e.data, 'eventAttackDetail') as { attackerPlayerId?: string; eventAttackShotDetail?: { targetPlayerId?: string; targetStructType?: string; targetDestroyed?: boolean | string }[] };
      const shot = (d.eventAttackShotDetail || []).find((s) => s.targetPlayerId && ids.has(s.targetPlayerId));
      if (!shot || !d.attackerPlayerId || ids.has(d.attackerPlayerId)) continue;
      // whoever was bonked is read again now, so no screen keeps showing a toy that is gone
      void empire.refresh(shot.targetPlayerId);
      const t = toyOfLedgerName(shot.targetStructType);
      const who = empire.players.get(d.attackerPlayerId);
      const name = who ? kidName(who) : d.attackerPlayerId.split('-')[1];
      const felled = shot.targetDestroyed === true || shot.targetDestroyed === 'true';
      if (felled && t === 1) { shout('Uh oh!', 'bear', 'uh'); bubble(name, 'bonk', 'uh', { toy: 'bear', ms: 10000, action: { label: 'Bonk', icon: 'bonk', run: () => { location.hash = `#/bonk/${d.attackerPlayerId}`; } } }); continue; }
      if (document.body.dataset.room === 'bonk' || Date.now() - lastStruck < 15000) continue;
      lastStruck = Date.now();
      bubble(name, felled ? 'gone' : 'bonk', 'uh', { toy: t ? toy(t).icon : undefined, ms: 8000, action: { label: 'Bonk', icon: 'bonk', run: () => { location.hash = `#/bonk/${d.attackerPlayerId}`; } } });
    }
  }
});

/* Mobile browsers zoom on a pinch or a quick double tap; zoomed in, the game's fixed controls no longer
 * sit under the finger. The page never zooms (the 3D mat has its own pinch); text fields still can. */
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => { if (!(e.target as HTMLElement | null)?.closest?.('input, textarea')) e.preventDefault(); }, { passive: false });

/* Escape closes the top box, with its safe answer. */
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return;
  const veils = document.querySelectorAll('.veil');
  const veil = veils[veils.length - 1] as HTMLElement | undefined;
  // a box on top keeps the keyboard inside it
  if (e.key === 'Tab' && veil) {
    const f = [...veil.querySelectorAll<HTMLElement>('button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter((x) => !(x as HTMLButtonElement).disabled && x.offsetParent);
    if (!f.length) return;
    const i = f.indexOf(document.activeElement as HTMLElement);
    if (i < 0 || (e.shiftKey && i === 0) || (!e.shiftKey && i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
    return;
  }
  if (e.key !== 'Escape') return;
  if (veil) { const btn = veil.querySelector<HTMLElement>('[data-dismiss]'); if (btn) btn.click(); else veil.remove(); return; }
  // no box: Escape closes an open card
  const x = [...document.querySelectorAll<HTMLElement>('section.card .x')].find((b) => b.offsetParent);
  x?.click();
});

async function boot() {
  world.mount(document.getElementById('world') as HTMLCanvasElement);
  live.start();
  await Promise.race([wallet.restore(), new Promise((r) => setTimeout(r, 5000))]).catch(() => bubble('Key', 'key', 'uh'));
  wallet.onChange(resumeEnlist); resumeEnlist();
  void empire; void pow;
  const hud = document.createElement('div'); hud.id = 'hud'; app.append(hud);
  mountHud(hud);
  window.addEventListener('hashchange', route);
  if (!location.hash || location.hash === '#') {
    if (wallet.state === 'empty') history.replaceState(null, '', '#/hi');
  }
  await route().catch((e) => console.error('[pippop] route', e));
  mountGuide();
  const b = document.getElementById('boot');
  b?.classList.add('gone');
  setTimeout(() => b?.remove(), 900);
  document.addEventListener('pointerdown', () => { audio.chime('tap'); ambience.start(); }, { once: true });
}

void boot();
