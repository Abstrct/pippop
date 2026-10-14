/* My Mat: your toys, read live from the ledger and stood up in 3D. Tap a toy for its card; every
 * button signs a real transaction. `#/mat/<kid>` peeks at another kid's mat (look, no touch). */
import { h, clear, bubble, confirmBox, keepFocus, holdButton, morph } from '../core/dom';
import { icon } from '../ui/icons';
import { shout } from '../ui/hud';
import { world } from '../world/world';
import { matStage } from '../world/mat';
import { empire, type OwnedStruct, type PlayerState } from '../game/empire';
import { act, actionBlock, canRetry, findBlock, matToysOn, verbsFor } from '../game/actions';
import { wallet } from '../wallet/wallet';
import { txq, type TxJob } from '../wallet/queue';
import { claimJob, releaseClaim } from '../core/claims';
import { live } from '../chain/live';
import { num } from '../chain/lcd';
import { typeOf } from '../data/catalogue';
import { audio } from '../core/audio';
import { AMBIT_OF_REALM, REALMS, REALM_COLOR, REALM_NAME, TRICK_ICON, WARD_CRAFT, clubColor, fmtStars, fmtWait, kidName, oops, reachOf, short, toy } from '../lore';
import { pow, type PowTask } from '../pow/pow';
import { owned, raidersAt, realmOf, unitsOf } from '../realm';
import type { Ctx, Screen } from './types';

const LEVEL_ICON: Record<string, string> = { moon: 'moon', sky: 'cloud', grass: 'grass', tub: 'tub' };

export function mat(ctx: Ctx): Screen {
  const watching = ctx.param && !wallet.byPlayer(ctx.param) ? ctx.param : null;
  if (watching) empire.watch(watching);
  const player = (): PlayerState | null => (watching ? empire.players.get(watching) ?? null : empire.commander);
  const mine = () => { const p = player(); return !!p && empire.commands(p.playerId); };

  let sel: string | null = null;
  let note: { sid: string; w: string; i: string } | null = null;
  let raiders: { fleetId: string; owner: string }[] = [];
  let raidAt = 0;
  const stage = matStage({ pick: (id) => pick(id) });
  world.use(stage);

  const card = h('section', { class: 'card panel right toy-card', 'aria-label': 'Toy', hidden: true });
  const signs = h('div', { class: 'signs', 'aria-live': 'polite' });
  const fab = h('a', { class: 'fab', href: '#/toys', 'aria-label': 'Make' }, icon('make', 48));
  const peek = h('div');
  // the toy box: every toy on this mat as a button (a way in for keyboards, screen readers and small fingers)
  const strip = h('section', { class: 'card panel toybox', 'aria-label': 'Toys here' });
  const el = h('div', null, signs, strip, card, fab, peek);
  const openedAt = Date.now();

  function pick(id: string | null) {
    if (id && id.startsWith('deco:')) { stage.boing(id); audio.chime(id === 'deco:wagon' ? 'squeak' : 'boing'); return; }
    const was = sel;
    sel = id; stage.select(id); note = null;
    if (id) audio.chime('squeak'); else audio.chime('boop');
    paint();
    // closing a card hands focus back to that toy in the toy box
    if (!id && was) (strip.querySelector(`[data-key="${was}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
  }

  /** The shake (proof of work) a toy is waiting on, and what it is: being made, digging, popping. */
  const KIND: Record<PowTask['kind'], [string, string]> = { build: ['make', '#43B02A'], mine: ['dig', '#B07A42'], refine: ['pop', '#FFC72C'], raid: ['grab', '#FF8F1C'] };
  function shakeOf(sid: string): PowTask | undefined { return pow.active.find((t) => t.objectId === sid && t.kind !== 'raid'); }

  /** Run a rite from the card; trouble comes back to the card as one word. */
  const claims = new Set<string>();
  const offs: (() => unknown)[] = [];
  function rite(p: PlayerState, run: () => TxJob | null | undefined, needsJuice = true, sid?: string) {
    if (!empire.commands(p.playerId)) { bubble('No', 'no', 'uh'); return; }
    if (!wallet.unlocked) { bubble('Key', 'key', 'uh', { action: { label: 'Key', icon: 'key', run: () => import('../ui/me').then((m) => m.openMe()) } }); return; }
    const why = needsJuice ? actionBlock(p) : null;
    if (why) { const w = oops(why); if (sid) { note = { sid, ...w }; paint(); } else bubble(w.w, w.i, 'uh'); return; }
    try {
      const job = run();
      if (!job) return;
      audio.chime('tap');
      if (sid) {
        claimJob(job.id); claims.add(job.id);
        const off = txq.onSettled((j) => {
          if (j.id !== job.id) return;
          off(); claims.delete(j.id);
          if (j.status === 'failed') {
            const w = oops(j.error);
            if (sel === sid) { note = { sid, ...w }; paint(); } else bubble(w.w, w.i, 'uh', canRetry(j) ? { action: { label: 'Again', icon: 'roll', run: () => txq.retry(j.id) } } : undefined);
          }
        });
        offs.push(off);
      }
    } catch (e) { const w = oops((e as Error).message); bubble(w.w, w.i, 'uh'); }
  }

  /* ── the signs: what needs you ── */
  /* each painter builds a fresh copy and morphs it in: only what changed is touched, so nothing that
   * stayed the same blinks or loses a tap that is already under a finger */
  const signsBox = signs, cardBox = card, stripBox = strip;
  function paintSigns(p: PlayerState | null) { const t = h('div'); buildSigns(t, p); morph(signsBox, t); }
  function paintCard(p: PlayerState | null) { const t = h('div'); buildCard(t, p); morph(cardBox, t); cardBox.hidden = t.hidden; }
  function paintStrip(p: PlayerState | null) { const t = h('div'); buildStrip(t, p); morph(stripBox, t); stripBox.hidden = t.hidden; }
  function buildSigns(signs: HTMLElement, p: PlayerState | null) {
    const out: HTMLElement[] = [];
    const sign = (tone: 'uh' | 'yay' | '', ic: string, w: string, action?: [string, string, () => void], extra?: Node) => out.push(h('div', { class: 'sign ' + tone, role: 'status' }, icon(ic, 36), h('span', { class: 'w' }, w), extra || null,
      action ? h('button', { type: 'button', class: 'pill small ' + (tone === 'uh' ? 'red' : 'sun'), onclick: action[2] }, icon(action[1], 22), action[0]) : null));
    if (!p) {
      if (watching && Date.now() - openedAt > 8000) sign('uh', 'gone', '?', ['Sky', 'sky', () => ctx.go('#/sky')]);
      else if (watching) { sign('', 'eye', '...'); setTimeout(() => paint(), 8200); }
      else if (wallet.active?.playerId) sign('', 'tick', '...');
      return void signs.append(...out);
    }
    const me = mine();
    const bear = [...p.structs.values()].find((s) => s.typeId === 1 && !s.destroyed);
    const ground = num(p.planet?.gridAttributes?.ore);
    for (const r of raiders) {
      const who = empire.players.get(r.owner);
      if (me) sign('uh', 'grab', 'Raid!', ['Bonk', 'bonk', () => ctx.go(`#/bonk/${r.owner}`)], who ? h('span', { class: 'state' }, icon('kid', 24), kidName(who)) : undefined);
    }
    if (!bear && p.planetId) {
      if (me) sign('uh', 'bear', 'Bear', ['Make', 'make', () => { const t = typeOf(1); if (t) rite(p, () => act.build(p, t, 'land', 0), false); }]);
      else if (p.ore > 0) sign('yay', 'bear', 'Gone', ['Bonk', 'bonk', () => ctx.go(`#/bonk/${p.playerId}`)]);
    }
    if (!p.online) sign('uh', 'juice', 'Juice');
    if (p.ore > 0) {
      if (me) {
        const popping = p.online && [...p.structs.values()].some((x) => x.typeId === 15 && !x.destroyed && x.built && x.online && x.locationId === p.planetId);
        if (popping) sign('yay', 'pop', String(p.ore), undefined, icon('rock', 30));
        else sign('uh', 'rock', String(p.ore), owned(p, 15) ? undefined : ['Popper', 'popper', () => ctx.go('#/toys/15')]);
      } else sign('yay', 'rock', String(p.ore), ['Bonk', 'bonk', () => ctx.go(`#/bonk/${p.playerId}`)]);
    }
    if (p.fleet?.status === 'away' && me) sign('', 'wagon', 'Away', ['Home', 'home', () => rite(p, () => act.fleetMove(p, p.planetId), false)]);
    if (me && (!p.planetId || (p.planet && ground <= 0 && p.ore === 0))) sign('', 'find', p.planetId ? 'Empty' : 'Mat', ['Find', 'find', () => findMat(p)]);
    else if (me && ground > 0 && !owned(p, 14) && bear) sign('', 'dig', String(ground), ['Digger', 'digger', () => ctx.go('#/toys/14')], icon('rock', 30));
    signs.append(...out.slice(0, 3));
  }

  async function findMat(p: PlayerState) {
    if (!p.planetId) { rite(p, () => act.explore(p), false); return; }
    const why = findBlock(p);
    if (why) { const w = oops(why); bubble(w.w, w.i, 'uh'); return; }
    const lost = matToysOn(p);
    if (!(await confirmBox('New mat?', '', 'Find', 'enemy', { icon: 'find', okIcon: 'find', stay: 'Stay', icons: lost.map((t) => toy(t).icon) }))) return;
    rite(p, () => act.explore(p), false);
  }

  /* ── the toy card ── */
  function buildCard(card: HTMLElement, p: PlayerState | null) {
    const s = p && sel ? p.structs.get(sel) : undefined;
    card.hidden = !s || !s.type || s.destroyed;
    fab.classList.toggle('lifted', !card.hidden);
    world.frame0(!card.hidden && matchMedia('(min-width: 761px)').matches ? 170 : 0);
    if (!p || !s || !s.type || s.destroyed) return;
    const t = s.type, T = toy(s.typeId), me = mine();
    const realm = realmOf(s), isMat = t.category === 'planet';
    const state: [string, string] = !s.built ? ['make', 'Make'] : !s.online ? ['nap', 'Nap'] : s.hidden ? ['hide', 'Hide'] : s.protectedStructIndex ? ['hug', 'Hug'] : ['wake', 'On'];
    const hearts = h('span', { class: 'hearts', role: 'img', 'aria-label': `${s.health} of ${t.maxHealth}` }, ...Array.from({ length: t.maxHealth }, (_, i) => icon(i < s.health ? 'heart' : 'heart0', 26)));
    card.append(
      h('button', { type: 'button', class: 'round x', 'aria-label': 'Close', onclick: () => pick(null), style: { width: '52px', height: '52px' } }, icon('close', 34)),
      h('div', { class: 'toy-head' }, icon(T.icon, 64), h('div', { class: 'stack', style: { gap: '6px' } }, h('h2', { class: 'big-word' }, T.word), hearts)),
      h('div', { class: 'row', style: { gap: '8px' } },
        h('span', { class: 'state' }, icon(state[0], 26), state[1]),
        h('span', { class: 'state', style: { background: REALM_COLOR[realm], color: '#fff' } }, icon(LEVEL_ICON[realm], 26), REALM_NAME[realm]),
        h('span', { class: 'state' }, icon(isMat ? 'mat' : 'wagon', 26)),
        h('span', { class: 'state', title: 'Juice' }, icon('juice', 24), String(Math.round(t.passiveDraw / 1000)))));
    if (!isMat) {
      const reach = [...new Set([...reachOf(t.primaryWeaponAmbits), ...reachOf(t.secondaryWeaponAmbits)])];
      card.append(h('div', { class: 'facts' },
        h('span', { class: 'fact', title: 'Bonk' }, icon('bonk', 30), h('span', { class: 'lv' }, ...(s.typeId === 1 ? [icon(LEVEL_ICON[realm], 24)] : reach.map((r) => icon(LEVEL_ICON[r], 24))))),
        h('span', { class: 'fact', title: 'Trick' }, icon(TRICK_ICON[t.unitDefenses] || 'no', 30), WARD_CRAFT[t.unitDefenses] || '—')));
    }
    // what it is busy with: being made, digging the next rock, popping the next star (time left)
    const shake = shakeOf(s.id);
    if (shake) {
      const e = pow.eta(shake), [kic, kcol] = KIND[shake.kind];
      card.append(h('div', { class: 'progress', role: 'progressbar', 'aria-label': kic, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(e.frac * 100)) },
        icon(kic, 28), h('span', { class: 'bar' }, h('i', { style: { width: `${Math.round(e.frac * 100)}%`, background: kcol } })), icon('tick', 24), h('b', null, fmtWait(e.secs))));
    } else if (s.built && s.online && (t.planetaryMining !== 'noPlanetaryMining' || t.planetaryRefinery !== 'noPlanetaryRefinery')) {
      const empty = t.planetaryMining !== 'noPlanetaryMining' ? num(p.planet?.gridAttributes?.ore) <= 0 : p.ore <= 0;
      card.append(h('div', { class: 'progress' }, icon(t.planetaryMining !== 'noPlanetaryMining' ? 'dig' : 'pop', 28), icon(empty ? 'empty' : 'tick', 24), h('b', null, empty ? 'Empty' : '…')));
    }
    if (!me) { card.append(h('span', { class: 'state', style: { justifySelf: 'start' } }, icon('eye', 26), 'Peek')); return; }
    const acts = h('div', { class: 'acts' });
    const need = (n: number) => (n ? h('span', { class: 'cost', title: 'Wind' }, icon('wind', 18), '≥' + n) : null);
    const btn = (cls: string, ic: string, word: string, cost: number, run: () => void, wide = false) => h('button', { type: 'button', class: `pill ${cls}${wide ? ' wide' : ''}`, onclick: run }, icon(ic, 28), word, need(cost));
    const COLORS: Record<string, string> = { on: 'sun', off: 'blue', stealth: 'plum', unstealth: 'plum', undefend: 'sky', cancel: '' };
    // a napping toy can only be woken (the chain refuses everything else until it is awake)
    const napping = s.built && !s.online;
    for (const v of verbsFor(p, s)) {
      if (napping && v.id !== 'on') continue;
      if (v.id === 'cancel') { acts.append(holdButton('wide', 'no', 'Stop', () => rite(p, v.run, false, s.id))); continue; }
      acts.append(btn(COLORS[v.id] ?? '', v.icon, v.label, v.cost, () => rite(p, v.run, v.id !== 'off', s.id), napping));
    }
    if (!napping) {
      if (s.built && t.generatingRate > 0) acts.append(btn('peach', 'feed', 'Feed', 0, () => feedBox(p, s)));
      if (s.built && !isMat && s.typeId !== 1 && !s.protectedStructIndex) acts.append(btn('sky', 'hug', 'Hug', t.defendChangeCharge, () => hugBox(p, s)));
      if (!isMat && s.built) acts.append(h('a', { class: 'pill red', href: '#/bonk' }, icon('bonk', 28), 'Bonk'));
      if (s.built && s.typeId !== 1) acts.append(holdButton('', 'toss', 'Toss', () => rite(p, () => act.trash(p, s), true, s.id)));
    }
    card.append(acts);
    if (napping) card.append(h('p', { class: 'note' }, icon('nap', 30), icon('go', 22), icon('wake', 30)));
    if (s.typeId === 1 && s.built && !napping) {
      card.append(h('div', { class: 'stack', style: { gap: '6px' } },
        h('span', { class: 'state', style: { justifySelf: 'start' } }, icon('hop', 26), 'Hop', h('span', { class: 'cost' }, icon('wind', 18), '≥' + t.moveCharge)),
        h('div', { class: 'levels', role: 'group', 'aria-label': 'Hop' }, ...REALMS.map((r) => {
          const here = realm === r;
          return h('button', { type: 'button', class: 'pill ' + (here ? 'here sun' : ''), 'aria-pressed': String(here), 'aria-label': REALM_NAME[r], onclick: () => { if (!here) rite(p, () => act.move(p, s, 'fleet', AMBIT_OF_REALM[r], 0), true, s.id); } }, icon(LEVEL_ICON[r], 28), REALM_NAME[r]);
        }))));
    }
    if (note && note.sid === s.id) card.append(h('p', { class: 'note', role: 'alert' }, icon(note.i, 32), note.w));
  }

  function veil(title: string, ic: string, ...kids: Node[]) {
    const v = h('div', { class: 'veil', onclick: (e: Event) => { if (e.target === v) v.remove(); } },
      h('section', { class: 'card stack', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, style: { position: 'relative' } },
        h('button', { type: 'button', class: 'round x', 'aria-label': 'Close', 'data-dismiss': '', onclick: () => v.remove() }, icon('close', 40)),
        h('div', { class: 'row' }, icon(ic, 64), h('h2', { class: 'big-word' }, title)), ...kids));
    document.body.append(v);
    return v;
  }
  function hugBox(p: PlayerState, s: OwnedStruct) {
    const pals = [...p.structs.values()].filter((x) => x.id !== s.id && !x.destroyed && x.built);
    const v = veil('Hug', 'hug', h('div', { class: 'toy-row', style: { flexWrap: 'wrap' } }, ...pals.map((x) => h('button', { type: 'button', 'aria-label': toy(x.typeId).word, onclick: () => { v.remove(); rite(p, () => act.defend(p, s, x.id), true, s.id); audio.chime('hug'); } }, icon(toy(x.typeId).icon, 40), x.typeId === 1 ? h('span', { class: 'mini' }, icon('star', 22)) : null))));
  }
  function feedBox(p: PlayerState, s: OwnedStruct) {
    let n = 1;
    const max = Math.floor(Number(p.alpha) / 1e6 * 1000) / 1000;
    const val = h('span', { class: 'big-word', style: { minWidth: '120px', textAlign: 'center' } }, '1');
    // what feeding it does: each star becomes juice at this toy's own rate
    const gain = h('b', null, '');
    const rate = s.type?.generatingRate || 0;
    const set = (x: number) => { n = Math.max(0.001, Math.min(max, Math.round(x * 1000) / 1000)); val.textContent = String(n); gain.textContent = '+' + short(Math.round(n * 1000 * rate)); };
    const v = veil('Feed', 'feed',
      h('div', { class: 'row center' }, h('span', { class: 'state' }, icon('star', 26), fmtStars(p.alpha)), h('span', { class: 'state', role: 'img', 'aria-label': 'Juice' }, icon('juice', 26), gain)),
      h('div', { class: 'row center nowrap' },
        h('button', { type: 'button', class: 'round', 'aria-label': 'Less', onclick: () => set(n >= 2 ? n - 1 : n / 2) }, icon('minus', 44)),
        h('span', { class: 'row nowrap', style: { gap: '4px' } }, icon('star', 44), val),
        h('button', { type: 'button', class: 'round', 'aria-label': 'More', onclick: () => set(n >= 1 ? n + 1 : n * 2) }, icon('plus', 44))),
      h('div', { class: 'row center' }, h('button', { type: 'button', class: 'pill big peach', disabled: max <= 0, onclick: () => {
        const u = BigInt(Math.round(n * 1e6)); if (u <= 0n || u > p.alpha) { bubble('Stars', 'star', 'uh'); return; }
        v.remove(); rite(p, () => act.infuseGenerator(p, s, u), false, s.id);
      } }, icon('feed', 34), 'Feed')));
    set(max <= 0 ? 0 : 1);
  }

  /* ── the peek banner (someone else's mat) ── */
  function paintPeek(p: PlayerState | null) {
    clear(peek);
    if (!watching) return;
    peek.append(h('div', { class: 'panel center row peekbar', style: { gap: '8px', bottom: 'calc(max(14px, env(safe-area-inset-bottom)) + 112px)' } },
      h('span', { class: 'sign' }, icon('eye', 32), h('span', { class: 'w' }, p ? kidName(p) : '...'), p ? h('span', { class: 'flag', style: { minHeight: '40px' } }, h('span', { class: 'sw', style: { background: clubColor(p.guildId) } })) : null),
      h('a', { class: 'pill red', href: `#/bonk/${watching}` }, icon('bonk', 28), 'Bonk'),
      h('a', { class: 'pill', href: '#/' }, icon('home', 28), 'Me')));
    fab.hidden = true;
  }

  function buildStrip(strip: HTMLElement, p: PlayerState | null) {
    strip.hidden = !p || (!cardBox.hidden && matchMedia('(max-width: 760px)').matches);
    if (!p) return;
    const shield = num(p.planet?.planetAttributes?.planetaryShield);
    const toys = [...p.structs.values()].filter((s) => !s.destroyed && s.type).sort((a, b) => (a.typeId === 1 ? -1 : b.typeId === 1 ? 1 : 0) || (a.type!.category === 'planet' ? 1 : 0) - (b.type!.category === 'planet' ? 1 : 0) || a.typeId - b.typeId);
    strip.append(h('div', { class: 'row nowrap', style: { gap: '8px' } },
      h('span', { class: 'state', role: 'img', 'aria-label': `Fort ${shield}`, title: 'Fort' }, icon('fort', 26), String(shield)),
      h('span', { class: 'state', role: 'img', 'aria-label': `Toys ${toys.length}` }, icon('make', 26), String(toys.length))),
      h('div', { class: 'toy-row', role: 'list' }, ...toys.map((s) => {
        const shake = shakeOf(s.id);
        const mini = !s.built ? 'gift' : !s.online ? 'nap' : s.hidden ? 'hide' : shake ? KIND[shake.kind][0] : null;
        return h('button', { type: 'button', role: 'listitem', class: sel === s.id ? 'on' : '', 'data-key': s.id, 'aria-label': toy(s.typeId).word + (mini ? ' ' + mini : ''), onclick: () => pick(sel === s.id ? null : s.id) },
          icon(toy(s.typeId).icon, 40), mini ? h('span', { class: 'mini' }, icon(mini, 22)) : null);
      })));
  }
  /** Each block, the open card's progress moves on in place: the bar slides and the time ticks, and
   * nothing else on the card is rebuilt (so nothing blinks under a finger). */
  function tickCard() {
    const bar = card.querySelector<HTMLElement>('.progress[role=progressbar]');
    if (!sel || !bar) return;
    const shake = shakeOf(sel);
    if (!shake) { keepFocus(card, () => paintCard(player())); return; }
    const e = pow.eta(shake), pct = String(Math.round(e.frac * 100));
    const fill = bar.querySelector<HTMLElement>('.bar i'), time = bar.querySelector('b');
    if (fill && fill.style.width !== pct + '%') fill.style.width = pct + '%';
    if (time && time.textContent !== fmtWait(e.secs)) time.textContent = fmtWait(e.secs);
    if (bar.getAttribute('aria-valuenow') !== pct) bar.setAttribute('aria-valuenow', pct);
  }
  function paintProgress(p: PlayerState | null) {
    if (!p) return;
    for (const s of p.structs.values()) {
      if (s.destroyed) continue;
      const shake = shakeOf(s.id);
      if (!shake) { stage.progress(s.id, null); continue; }
      const e = pow.eta(shake);
      stage.progress(s.id, e.frac, KIND[shake.kind][1], fmtWait(e.secs));
    }
  }

  let shownFor: string | null = null, hatchDone = false;
  function paint() {
    const p = player();
    if (!watching && !p && !wallet.active?.playerId && wallet.state !== 'locked') { ctx.go('#/hi'); return; }
    if ((p?.playerId ?? null) !== shownFor) { shownFor = p?.playerId ?? null; sel = null; raiders = []; raidAt = 0; }
    if (p?.planet && Date.now() - raidAt > 5000) { raidAt = Date.now(); void raidersAt(p.planet).then((r) => { if (JSON.stringify(r) !== JSON.stringify(raiders)) { raiders = r; paint(); } }); }
    keepFocus(el, () => { paintSigns(p); paintCard(p); paintStrip(p); paintPeek(p); });
    fab.hidden = !!watching || !mine() || !card.hidden;
    if (p) {
      const units = unitsOf(p);
      const shield = num(p.planet?.planetAttributes?.planetaryShield);
      paintProgress(p);
      stage.sync(units, { ground: num(p.planet?.gridAttributes?.ore), rocks: p.ore, fort: Math.min(1, shield / 120), wagonHome: p.fleet?.status !== 'away', name: kidName(p), club: clubColor(p.guildId), empty: !p.planetId });
      if (!hatchDone && !watching) {
        hatchDone = true;
        let hatch = false; try { hatch = sessionStorage.getItem('pippop.hatch') === '1'; sessionStorage.removeItem('pippop.hatch'); } catch { /* none */ }
        if (hatch) setTimeout(() => shout('Bear!', 'bear'), 900);
      }
    }
  }

  // when a rite of this mat lands, the mat answers
  offs.push(txq.onSettled((j) => {
    const p = player();
    if (j.status !== 'success' || !p || j.playerId !== p.playerId) return;
    const urls = j.msgs.map((m) => m.typeUrl).join();
    const v = (j.msgs[0]?.value || {}) as Record<string, unknown>;
    const sid = String(v.structId || v.defenderStructId || '');
    if (/OreMinerComplete/.test(urls)) { stage.rite('dig', sid); audio.chime('dig'); bubble('Dig', 'dig', 'yay', { toy: 'rock' }); }
    if (/OreRefineryComplete/.test(urls)) { stage.rite('pop', sid); audio.chime('pop'); setTimeout(() => audio.chime('pop'), 140); setTimeout(() => audio.chime('pop'), 300); shout('Pop!', 'star'); }
    if (/GeneratorInfuse/.test(urls)) { stage.rite('feed', sid); audio.chime('yay'); }
    if (/PlanetExplore/.test(urls)) { stage.rite('find'); audio.chime('whoosh'); shout('New mat!', 'mat'); }
    if (/DefenseSet/.test(urls)) { stage.rite('hug', sid); audio.chime('hug'); }
    if (/StructBuildComplete/.test(urls)) { stage.rite('make', sid); audio.chime('make'); const s = p.structs.get(sid); if (s) shout(toy(s.typeId).word + '!', toy(s.typeId).icon); }
    if (/StructActivate$/.test(urls)) audio.chime('wake');
    if (/StructDeactivate$/.test(urls)) audio.chime('nap');
  }));
  offs.push(live.onTx((tx) => {
    const p = player(); if (!p) return;
    const raid = tx.events.find((e) => e.type === 'EventRaid');
    if (raid && JSON.stringify(raid.data).includes(p.planetId)) stage.rite('grab');
  }));
  offs.push(empire.onChange(paint), wallet.onChange(paint), live.onBlock(() => { const p = player(); paintProgress(p); tickCard(); }));
  window.addEventListener('resize', paint);
  paint();

  return {
    el, title: watching ? 'Peek' : 'Mat',
    leave: () => { window.removeEventListener('resize', paint); offs.forEach((f) => f()); claims.forEach(releaseClaim); world.frame0(0); if (watching) empire.unwatch(watching); document.querySelectorAll('.veil').forEach((v) => v.remove()); },
  };
}
