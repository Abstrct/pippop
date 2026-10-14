/* Bonk! Your wagon toys against a real kid's toys. Roll your wagon to their mat, bonk their Bear
 * until it is out of hearts, and the shake engine grabs their rocks by itself (MsgPlanetRaidComplete).
 * When someone rolls onto your mat, this is where you bonk them back. Every bonk is MsgStructAttack;
 * the odds come from the ledger's own rules (game/war.ts). */
import { h, bubble, keepFocus, morph } from '../core/dom';
import { icon } from '../ui/icons';
import { shout } from '../ui/hud';
import { world } from '../world/world';
import { bonkStage, type BonkUnit } from '../world/bonk';
import { empire, type OwnedStruct, type PlayerState } from '../game/empire';
import { act, actionBlock } from '../game/actions';
import { wallet } from '../wallet/wallet';
import { txq, type TxJob } from '../wallet/queue';
import { claimJob, releaseClaim } from '../core/claims';
import { live } from '../chain/live';
import { pow } from '../pow/pow';
import { typeOf, type Ambit } from '../data/catalogue';
import { audio } from '../core/audio';
import { REALM_OF_AMBIT, kidName, oops, toy } from '../lore';
import { raidersAt, realmOf, skyFull } from '../realm';
import { alive, forecast, isWyrm, moves, reach, readBlow, wardKeeper, wisest, wyrmOf, type Blow, type Move } from '../game/war';
import type { Ctx, Screen } from './types';

const LEVEL_ICON: Record<string, string> = { space: 'moon', air: 'cloud', land: 'grass', water: 'tub' };
// the verdict always wears one of four faces, so it can be learned
const FACE: Record<string, [string, string]> = { good: ['check', 'Yes'], fair: ['check', 'Ok'], risky: ['oops', 'Eek'], deadly: ['no', 'No'], futile: ['no', 'No'] };

export function bonk(ctx: Ctx): Screen {
  const stage = bonkStage({ pick: (id) => { if (!id) return; const p = me(); if (p?.structs.has(id)) chooseA(id); else chooseT(id); } });
  world.use(stage);
  const bar = h('div', { class: 'war', role: 'group', 'aria-label': 'Steps' });
  const side = h('section', { class: 'card panel left stack hide-phone wide-only', 'aria-label': 'Toys' });
  const strike = h('section', { class: 'card panel center strike', 'aria-label': 'Bonk' });
  // the live sections; each paint builds a fresh copy and morphs these to match, so only what changed changes
  const barBox = bar, sideBox = side, strikeBox = strike;
  const el = h('div', null, bar, side, strike);

  let target: string | null = ctx.param || null;
  let atk: string | null = null, mark: string | null = null, chose = false;
  let won = false, grabbed = 0;
  let say: { w: string; i: string } | null = null;
  const watched = new Set<string>();
  const claims = new Set<string>();
  const offs: (() => unknown)[] = [];

  const me = () => empire.commander;
  const foe = (): PlayerState | null => (target ? empire.players.get(target) ?? null : null);
  const abroad = () => { const p = me(), f = foe(); return !!(p && f && p.fleet?.status === 'away' && p.fleet.locationId === f.planetId); };
  const defending = () => { const p = me(), f = foe(); return !!(p && f && f.fleet?.status === 'away' && f.fleet.locationId === p.planetId && p.fleet?.status !== 'away'); };
  const inFight = () => abroad() || defending();
  const ours = (p: PlayerState | null) => (p ? [...p.structs.values()].filter((s) => alive(s) && s.type!.category === 'fleet') : []);
  function theirs(f: PlayerState | null) {
    if (!f) return [];
    if (defending()) return [...f.structs.values()].filter((s) => alive(s) && s.type!.category === 'fleet');
    const home = f.fleet?.status !== 'away';
    return [...f.structs.values()].filter((s) => alive(s) && (s.type!.category === 'planet' || home));
  }
  const wardOpen = () => abroad() && !wardKeeper(foe());
  const allMoves = (): Move[] => moves(ours(me()), theirs(foe()), me(), foe());

  let looked = 0;
  async function findTarget() {
    const p = me();
    if (!target && p?.fleet?.status === 'away' && p.target) target = p.target.Planet.owner;
    if (!target && p?.planet && Date.now() - looked > 5000) {
      looked = Date.now();
      const r = await raidersAt(p.planet).catch(() => []);
      if (r.length && !target) { target = r[0].owner; paint(); return; }
    }
    if (target && !watched.has(target) && !wallet.byPlayer(target)) { watched.add(target); empire.watch(target); }
  }

  function settle() {
    const p = me(), f = foe();
    const a = p?.structs.get(atk || ''), t = f?.structs.get(mark || '');
    if (atk && (!a || !alive(a))) { atk = null; chose = false; }
    if (mark && (!t || !alive(t) || !theirs(f).some((s) => s.id === mark))) { mark = null; chose = false; }
    if (!chose || !atk || !mark) {
      const list = allMoves();
      const best = wisest(wardOpen() ? list.filter((m) => m.t.type?.category === 'fleet') : list);
      if (best) { atk = best.a.id; mark = best.t.id; return; }
      const ow = wyrmOf(p), tw = wyrmOf(f);
      if (!atk && ow && alive(ow)) atk = ow.id;
      if (!mark && tw && alive(tw) && theirs(f).some((s) => s.id === tw.id)) mark = tw.id;
      else if (!mark) mark = theirs(f)[0]?.id || null;
    }
  }
  function chooseA(id: string) { atk = id; chose = true; say = null; const a = me()?.structs.get(id), t = foe()?.structs.get(mark || ''); if (a && (!t || !reach(a, t).weapon)) { const m = allMoves().find((x) => x.a.id === id); if (m) mark = m.t.id; } audio.chime('squeak'); paint(); }
  function chooseT(id: string) { mark = id; chose = true; say = null; const list = allMoves().filter((m) => m.t.id === id); if (list[0] && !list.some((m) => m.a.id === atk)) atk = list[0].a.id; audio.chime('squeak'); paint(); }

  const pending = (): TxJob | undefined => { const p = me(); return p ? txq.active.find((j) => j.playerId === p.playerId && j.msgs.some((m) => /MsgStructAttack$/.test(m.typeUrl))) : undefined; };
  function guard(p: PlayerState): boolean {
    if (!wallet.unlocked) { say = { w: 'Key', i: 'key' }; paint(); return false; }
    const b = actionBlock(p); if (b) { say = oops(b); paint(); return false; }
    return true;
  }
  function rollThere() {
    const p = me(), f = foe(); if (!p || !f || !guard(p)) return;
    if (skyFull(f.planet, p)) { say = { w: 'Full', i: 'full' }; paint(); return; }
    const b = wyrmOf(p);
    if (!b || !alive(b)) { say = { w: 'Bear', i: 'bear' }; paint(); return; }
    if (!b.online) { say = { w: 'Nap', i: 'nap' }; paint(); return; }
    try { act.fleetMove(p, f.planetId); audio.chime('whoosh'); bubble('Roll', 'roll', 'yay', { toy: 'wagon' }); } catch (e) { say = oops((e as Error).message); paint(); }
  }
  function goHome() { const p = me(); if (!p) return; try { act.fleetMove(p, p.planetId); audio.chime('whoosh'); } catch (e) { say = oops((e as Error).message); paint(); } }
  function hop(a: OwnedStruct, to: Ambit) { const p = me(); if (!p || !guard(p)) return; try { act.move(p, a, 'fleet', to, 0); audio.chime('boing'); } catch (e) { say = oops((e as Error).message); paint(); } }
  function hit() {
    const p = me(), f = foe();
    const a = p?.structs.get(atk || ''), t = f?.structs.get(mark || '');
    if (!p || !a || !t || !guard(p)) return;
    if (!a.online) { say = { w: 'Nap', i: 'nap' }; paint(); return; }
    const r = reach(a, t);
    if (!r.weapon) { if (r.soar) hop(a, r.soar); else { say = { w: 'Far', i: 'far' }; paint(); } return; }
    const job0 = pending();
    if (job0 && ['queued', 'waiting'].includes(job0.status)) { txq.cancel(job0.id); paint(); return; }
    say = null;
    try {
      const job = act.attack(p, a, [t.id], r.weapon);
      claimJob(job.id); claims.add(job.id);
      audio.chime('tap');
      const off = txq.onSettled((j) => {
        if (j.id !== job.id) return;
        off(); claims.delete(j.id);
        if (j.status === 'success') hear(j.events || [], j.hash || j.id, j.height);
        else if (j.status === 'failed') { say = oops(j.error); paint(); }
      });
      offs.push(off);
      chose = true; paint();
    } catch (e) { say = oops((e as Error).message); paint(); }
  }

  /* ── every blow, shown ── */
  const told = new Set<string>();
  function applyBlow(bw: Blow, height?: number) {
    const find = (id: string) => { for (const pl of empire.players.values()) { const st = pl.structs.get(id); if (st) return st; } return null; };
    const set = (id: string | undefined, hp: number | undefined, felled: boolean) => { const s = id ? find(id) : null; if (!s) return; if (hp != null && Number.isFinite(hp)) s.health = hp; if (felled) { s.health = 0; s.destroyed = true; } };
    for (const sh of bw.shots) { set(sh.targetId, sh.targetHpAfter, sh.targetFelled); if (sh.blockerId) set(sh.blockerId, sh.blockerHpAfter, sh.blockerFelled); }
    set(bw.attackerId, bw.attackerHpAfter, bw.attackerFelled);
    const owner = bw.attackerOwner ? empire.players.get(bw.attackerOwner) : null;
    if (owner && height && height > owner.lastAction) owner.lastAction = height;
  }
  function hear(events: { type: string; data: unknown }[], key: string, height?: number) {
    events.forEach((e, i) => {
      if (e.type !== 'EventAttack') return;
      const bw = readBlow(e.data, `${key}:${i}`, (id) => typeOf(id));
      if (!bw) return;
      const sig = `${bw.attackerId}>${bw.shots.map((s) => `${s.targetId}:${s.targetHpAfter}:${s.evaded}:${s.damage}`).join(',')}:${bw.attackerHpAfter}`;
      if (told.has(sig)) return;
      const p = me(), f = foe();
      const party = new Set([p?.playerId, f?.playerId].filter(Boolean) as string[]);
      if (!party.has(bw.attackerOwner) && !bw.shots.some((s) => party.has(s.targetOwner))) return;
      told.add(sig);
      const mine = !!p && bw.attackerOwner === p.playerId;
      const sh = bw.shots[0];
      applyBlow(bw, height);
      if (!sh) return;
      const onId = sh.blockerId || sh.targetId;
      stage.strike(bw.attackerId, onId, { miss: sh.evaded, mine, done: () => {
        if (sh.evaded) { stage.pop(sh.targetId, 'Boing!', 'miss'); audio.chime('boing'); }
        else { stage.pop(onId, sh.damage ? `-${sh.damage}` : 'Bonk!', sh.blockerId ? 'guard' : 'hit'); audio.chime('bonk'); }
        for (const c of sh.counters) if (c.dmg) setTimeout(() => stage.pop(bw.attackerId, `-${c.dmg}`, 'hit'), 380);
        if (sh.back) setTimeout(() => stage.pop(bw.attackerId, `-${sh.back}`, 'hit'), 420);
        const gone = (id: string) => setTimeout(() => { stage.pop(id, 'Poof!', 'fell'); stage.fell(id); audio.chime('pop'); }, 500);
        if (sh.targetFelled) gone(sh.targetId);
        if (sh.blockerFelled && sh.blockerId) gone(sh.blockerId);
        if (bw.attackerFelled) gone(bw.attackerId);
        if (sh.targetFelled && isWyrm(empire.ownerOf(sh.targetId)?.structs.get(sh.targetId))) setTimeout(() => shout(mine ? 'Bonk!' : 'Uh oh!', 'bear', mine ? 'yay' : 'uh'), 900);
      } });
      if (!mine) bubble('Bonk', 'bonk', 'uh', { toy: toy(bw.attackerType).icon });
    });
    paint();
  }
  offs.push(live.onTx((tx) => { if (tx.events.some((e) => e.type === 'EventAttack')) hear(tx.events, tx.hash || String(tx.height), tx.height); }));
  offs.push(live.onTx((tx) => {
    const r = tx.events.find((e) => e.type === 'EventRaid'); if (!r) return;
    const d = (r.data && typeof r.data === 'object' && 'eventRaidDetail' in (r.data as object) ? (r.data as Record<string, unknown>).eventRaidDetail : r.data) as Record<string, string>;
    const p = me(), f = foe();
    if (d?.status === 'raidSuccessful' && p && d.fleetId === p.fleetId && f && d.planetId === f.planetId) {
      const th = tx.events.find((x) => x.type === 'EventOreTheft');
      const td = (th && th.data && typeof th.data === 'object' && 'eventOreTheftDetail' in (th.data as object) ? (th.data as Record<string, unknown>).eventOreTheftDetail : th?.data) as Record<string, unknown> | undefined;
      grabbed = Number(d.seized_ore ?? d.seizedOre ?? td?.amount ?? 0) || 0;
      won = true; paint();
    }
  }));

  /* ── paint ── */
  let sceneSig = '';
  const unit = (s: OwnedStruct): BonkUnit => ({ id: s.id, type: s.typeId, realm: realmOf(s), mat: s.type!.category === 'planet', health: s.health, max: s.type!.maxHealth, sleep: s.built && !s.online, hidden: s.hidden });
  function paintScene() {
    const p = me(), f = foe();
    const a = ours(p), b = theirs(f);
    const sig = JSON.stringify([a.map((s) => [s.id, s.health, s.online, s.ambit]), b.map((s) => [s.id, s.health, s.online, s.ambit])]);
    if (sig !== sceneSig) { sceneSig = sig; stage.set(a.map(unit), b.map(unit), { oursName: p ? kidName(p) : undefined, theirsName: f ? kidName(f) : undefined }); }
    stage.mark('a', atk); stage.mark('t', mark);
  }
  function paintBar() { const t = h('div'); buildBar(t); morph(barBox, t); barBox.hidden = t.hidden; }
  function buildBar(bar: HTMLElement) {
    const f = foe();
    const theirBear = wyrmOf(f);
    const bearDown = !theirBear || !alive(theirBear) || !wardKeeper(f);
    const steps: [string, string, boolean, boolean][] = defending()
      ? [['bonk', 'Bonk', true, false], ['bear', 'Bear', !!theirBear && !alive(theirBear), !!theirBear && alive(theirBear)]]
      : [['roll', 'Roll', abroad(), !abroad()], ['bear', 'Bear', abroad() && bearDown, abroad() && !bearDown], ['grab', 'Grab', won, abroad() && bearDown && !won]];
    if (won) for (const st of steps) { st[2] = true; st[3] = false; }
    steps.forEach(([ic, w, done, now], i) => { if (i) bar.append(h('span', { class: 'arrow', 'aria-hidden': 'true' }, '›')); bar.append(h('span', { class: 'st ' + (done ? 'done' : now ? 'now' : '') }, icon(done ? 'check' : ic, 32), w)); });
    // their fort: how hard their mat is to grab from
    const fort = Number(f?.planet?.planetAttributes?.planetaryShield || 0);
    if (f && fort) bar.append(h('span', { class: 'st done', role: 'img', 'aria-label': `Fort ${fort}`, title: 'Fort' }, icon('fort', 30), String(fort)));
    bar.hidden = !f;
  }
  function paintSide() { const t = h('div'); buildSide(t); morph(sideBox, t); sideBox.hidden = t.hidden; }
  function buildSide(side: HTMLElement) {
    const p = me(), f = foe();
    const row = (title: string, ic: string, list: OwnedStruct[], pick: (id: string) => void, on: string | null) => h('div', { class: 'side-list' },
      h('h3', null, icon(ic, 30), title),
      h('div', { class: 'toy-row' }, ...list.map((s) => h('button', { type: 'button', 'aria-label': toy(s.typeId).word, class: (on === s.id ? 'on' : '') + (s.online ? '' : ' off'), onclick: () => pick(s.id) }, icon(toy(s.typeId).icon, 40), h('span', { class: 'mini' }, icon(LEVEL_ICON[s.ambit] || 'grass', 22))))));
    if (p) side.append(row(kidName(p), 'wagon', ours(p), chooseA, atk));
    if (f) side.append(row(kidName(f), 'kid', theirs(f), chooseT, mark));
    side.hidden = !p && !f;
  }
  function paintStrike() { const t = h('div'); buildStrike(t); morph(strikeBox, t); }
  function buildStrike(strike: HTMLElement) {
    const p = me(), f = foe();
    if (!p) { strike.append(h('a', { class: 'pill huge red', href: '#/hi' }, icon('gift', 44), 'Play')); return; }
    if (!f) {
      strike.append(h('div', { class: 'row center' }, icon('sky', 56), h('span', { class: 'big-word' }, '?')), h('a', { class: 'pill huge blue wiggle', href: '#/sky' }, icon('sky', 44), 'Sky'));
      if (target) strike.prepend(h('span', { class: 'state' }, h('span', { class: 'spin' }, icon('tick', 26)), '...'));
      return;
    }
    if (won) {
      strike.append(h('div', { class: 'row center' }, icon('grab', 64), icon(grabbed ? 'rock' : 'empty', 56), h('span', { class: 'big-word' }, grabbed ? '+' + grabbed : 'Empty')),
        h('button', { type: 'button', class: 'pill huge sun', onclick: goHome }, icon('home', 44), 'Home'));
      return;
    }
    const odds = h('div', { class: 'odds' });
    const btns = h('div', { class: 'row center' });
    strike.append(odds, btns);
    if (!inFight()) {
      const away = p.fleet?.status === 'away';
      if (away) odds.append(h('span', { class: 'odd' }, icon('wagon', 32), 'Away'));
      btns.append(h('button', { type: 'button', class: 'pill huge blue bonk-btn wiggle', onclick: rollThere }, icon('roll', 48), 'Roll'));
      if (away) btns.append(h('button', { type: 'button', class: 'pill big sun', onclick: goHome }, icon('home', 34), 'Home'));
    } else {
      const a = p.structs.get(atk || ''), t = f.structs.get(mark || '');
      const r = a && t ? reach(a, t) : null;
      const fc = a && t && r?.weapon ? forecast(a, t, r.weapon, f) : null;
      if (a && t) odds.append(h('span', { class: 'odd' }, icon(toy(a.typeId).icon, 34), h('span', { class: 'arrow' }, '›'), icon(toy(t.typeId).icon, 34)));
      if (fc) {
        const dots = (k: number, risk = false) => h('span', { class: 'dots' + (risk ? ' risk' : '') }, ...Array.from({ length: 5 }, (_, i) => h('i', { class: i < Math.round(k * 5) ? 'on' : '' })));
        const [fi, fw] = FACE[fc.verdict.tone];
        odds.append(...[
          h('span', { class: 'odd', title: 'Hit', 'aria-label': `Hit ${Math.round(fc.land * 100)}` }, icon('bonk', 30), dots(fc.land)),
          h('span', { class: 'odd', title: 'Them', 'aria-label': `${toy((fc.guard || t!).typeId).word} -${fc.dmg.max}` }, icon(toy((fc.guard || t!).typeId).icon, 30), icon('heart', 22), fc.dmg.max ? `-${fc.dmg.min === fc.dmg.max ? fc.dmg.max : fc.dmg.min + '-' + fc.dmg.max}` : '0'),
          fc.guard ? h('span', { class: 'odd', title: 'Hug' }, icon('hug', 30), icon(toy(fc.guard.typeId).icon, 30)) : null,
          fc.fell > 0 ? h('span', { class: 'odd', title: 'Poof' }, icon('gone', 30), dots(fc.fell)) : null,
          fc.backMax ? h('span', { class: 'odd', title: 'Me', 'aria-label': `${toy(a!.typeId).word} -${fc.backMax}` }, icon(toy(a!.typeId).icon, 30), icon('heart', 22), `-${fc.backMax}`) : null,
          fc.lost > 0 ? h('span', { class: 'odd', title: 'Risk' }, icon(toy(a!.typeId).icon, 30), dots(fc.lost, true)) : null,
          h('span', { class: `odd face-${fc.verdict.tone}` }, icon(fi, 30), fw)].filter((x): x is HTMLSpanElement => !!x));
      } else if (r?.soar) odds.append(h('span', { class: 'odd' }, icon('hop', 30), icon(LEVEL_ICON[r.soar], 30)));
      else if (a && t) odds.append(h('span', { class: 'odd' }, icon('far', 30), 'Far'));
      if (wardOpen()) {
        const task = pow.active.find((x) => x.kind === 'raid' && x.playerId === p.playerId);
        const pct = task ? Math.min(1, (task.best?.zeros ?? 0) / Math.max(1, pow.required(task))) : 0;
        odds.prepend(h('span', { class: 'odd face-good' }, h('span', { class: 'spin' }, icon('shake', 30)), icon('grab', 30), `${Math.round(pct * 100)}`));
      }
      const job = pending();
      const cost = fc?.arm.charge ?? 0;
      const label = job ? (['queued', 'waiting'].includes(job.status) ? 'Stop' : '...') : r && !r.weapon && r.soar ? 'Hop' : 'Bonk!';
      btns.append(h('button', { type: 'button', class: 'pill huge red bonk-btn' + (job ? '' : ' wiggle'), disabled: !a || !t || job?.status === 'pending' || job?.status === 'signing', onclick: hit },
        icon(label === 'Hop' ? 'hop' : label === 'Stop' ? 'no' : 'bonk', 48), label, cost && !job ? h('span', { class: 'cost' }, icon('wind', 18), '≥' + cost) : null));
      if (abroad()) btns.append(h('button', { type: 'button', class: 'pill big sun', onclick: goHome }, icon('home', 34)));
      const p2 = me(); if (p2 && a && cost > empire.charge(p2)) strike.append(h('span', { class: 'state' }, icon('wind', 26), `${empire.charge(p2)}/${cost}`));
    }
    if (say) strike.append(h('p', { class: 'note', role: 'alert' }, icon(say.i, 32), say.w));
  }
  function paint() {
    void findTarget();
    settle();
    paintScene();
    keepFocus(el, () => { paintBar(); paintSide(); paintStrike(); });
  }
  let soon = 0;
  offs.push(empire.onChange(paint), wallet.onChange(paint), live.onBlock(paint), txq.onChange(() => paintStrikeSoon()));
  function paintStrikeSoon() { if (soon) return; soon = requestAnimationFrame(() => { soon = 0; keepFocus(el, paintStrike); }); }
  paint();
  void REALM_OF_AMBIT;
  return {
    el, title: 'Bonk',
    leave: () => { offs.forEach((f) => f()); claims.forEach(releaseClaim); for (const w of watched) empire.unwatch(w); },
  };
}
