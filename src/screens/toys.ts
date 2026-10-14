/* The Shelf: every toy you can make, in its cubby. Tap one: it hops out and spins, and its card
 * shows what it is in symbols. Make draws its spot on your mat (MsgStructBuildInitiate); the shake
 * engine then finishes it by itself. */
import { h, clear, bubble, keepFocus } from '../core/dom';
import { icon } from '../ui/icons';
import { world } from '../world/world';
import { shelfStage } from '../world/rooms';
import { empire, type PlayerState } from '../game/empire';
import { act, buildBlock } from '../game/actions';
import { wallet } from '../wallet/wallet';
import { typeOf, type StructType } from '../data/catalogue';
import { audio } from '../core/audio';
import { REALM_NAME, TRICK_ICON, WARD_CRAFT, fmtJuice, oops, reachOf, short, toy, type Realm } from '../lore';
import { freeSpot, owned } from '../realm';
import { arm } from '../game/war';
import type { Ctx, Screen } from './types';

const ORDER = [14, 15, 20, 21, 22, 18, 16, 17, 19, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const LEVEL_ICON: Record<Realm, string> = { moon: 'moon', sky: 'cloud', grass: 'grass', tub: 'tub' };
const levelsOf = (mask: number): Realm[] => { const o: Realm[] = []; if (mask & 16) o.push('moon'); if (mask & 8) o.push('sky'); if (mask & 4) o.push('grass'); if (mask & 2) o.push('tub'); return o; };

export function toys(ctx: Ctx): Screen {
  let sel: number | null = ctx.param ? Number(ctx.param) || null : null;
  const stage = shelfStage({ pick: (t) => choose(t) });
  world.use(stage);
  const card = h('section', { class: 'card panel right toy-card', 'aria-label': 'Toy', hidden: true });
  const row = h('div', { class: 'toy-row', role: 'listbox', 'aria-label': 'Toys' });
  const strip = h('div', { class: 'panel center card', style: { padding: '10px 12px 4px', width: 'min(820px, calc(100vw - 24px))' } }, row);
  const el = h('div', null, strip, card);

  function choose(t: number | null) {
    sel = t; stage.select(t);
    if (t) audio.chime('squeak'); else audio.chime('boop');
    paint();
    world.frame0(t && matchMedia('(min-width: 761px)').matches ? 170 : 0);
    // a toy picked from the strip: its card is where the hands go next
    if (t && row.contains(document.activeElement)) (['.pill.huge', '.note a', '.x'].map((q) => card.querySelector(q) as HTMLElement | null).find(Boolean))?.focus({ preventScroll: true });
  }

  /** Why this kid can't make this toy now, as one word, or null. */
  function why(p: PlayerState | null, t: StructType): { w: string; i: string } | null {
    if (!p) return { w: 'Play', i: 'gift' };
    if (!empire.commands(p.playerId)) return { w: 'No', i: 'no' };
    if (t.buildLimit && owned(p, t.id) >= t.buildLimit) return { w: 'Got', i: 'check' };
    if (t.id === 1 && owned(p, 1)) return { w: 'Got', i: 'check' };
    const b = buildBlock(p, t);
    if (b && !(t.id === 1 && b === 'bear')) return oops(b);
    if (t.id !== 1 && !freeSpot(p, t)) return { w: 'Full', i: 'full' };
    return null;
  }

  function paintCard(p: PlayerState | null) {
    clear(card);
    const t = sel ? typeOf(sel) : undefined;
    card.hidden = !t;
    if (!t) return;
    const T = toy(t.id), isMat = t.category === 'planet';
    const no = why(p, t);
    const w1 = arm(t, 'primaryWeapon'), w2 = arm(t, 'secondaryWeapon');
    const reach = [...new Set([...reachOf(t.primaryWeaponAmbits), ...reachOf(t.secondaryWeaponAmbits)])];
    const dmg = Math.max(w1 ? w1.damage * w1.shots : 0, w2 ? w2.damage * w2.shots : 0);
    const shakes = t.buildDifficulty <= 250 ? 1 : t.buildDifficulty <= 460 ? 2 : 3;
    const have = p ? owned(p, t.id) : 0;
    card.append(
      h('button', { type: 'button', class: 'round x', 'aria-label': 'Close', onclick: () => choose(null), style: { width: '52px', height: '52px' } }, icon('close', 34)),
      h('div', { class: 'toy-head' }, icon(T.icon, 64), h('div', { class: 'stack', style: { gap: '6px' } }, h('h2', { class: 'big-word' }, T.word),
        h('span', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'state' }, icon(isMat ? 'mat' : 'wagon', 26), isMat ? 'Mat' : 'Go'), have ? h('span', { class: 'state' }, icon('check', 24), '×' + have) : null))),
      h('div', { class: 'facts' },
        h('span', { class: 'fact', title: 'Hearts' }, icon('heart', 30), String(t.maxHealth)),
        h('span', { class: 'fact', title: 'Juice' }, icon('juice', 30), short(Math.round(t.buildDraw / 1000))),
        h('span', { class: 'fact', title: 'Wind' }, icon('wind', 30), '≥' + t.buildCharge),
        h('span', { class: 'fact', title: 'Shake' }, ...Array.from({ length: shakes }, () => icon('shake', 26))),
        h('span', { class: 'fact', title: 'Where' }, h('span', { class: 'lv' }, ...levelsOf(t.possibleAmbit).map((r) => icon(LEVEL_ICON[r], 24))), levelsOf(t.possibleAmbit).length === 1 ? REALM_NAME[levelsOf(t.possibleAmbit)[0]] : ''),
        !isMat ? h('span', { class: 'fact', title: 'Bonk' }, icon('bonk', 28), dmg ? '×' + dmg : '—', h('span', { class: 'lv' }, ...(t.id === 1 ? [icon('eye', 22)] : reach.map((r) => icon(LEVEL_ICON[r], 22))))) : null,
        !isMat ? h('span', { class: 'fact', title: 'Trick' }, icon(TRICK_ICON[t.unitDefenses] || 'no', 28), WARD_CRAFT[t.unitDefenses] || '—') : null,
        t.planetaryMining !== 'noPlanetaryMining' ? h('span', { class: 'fact' }, icon('dig', 28), icon('rock', 26)) : null,
        t.planetaryRefinery !== 'noPlanetaryRefinery' ? h('span', { class: 'fact' }, icon('rock', 26), icon('pop', 26), icon('star', 26)) : null,
        t.generatingRate > 0 ? h('span', { class: 'fact' }, icon('star', 26), icon('go', 22), icon('juice', 26)) : null,
        t.planetaryShieldContribution > 0 ? h('span', { class: 'fact' }, icon('fort', 28), '+' + t.planetaryShieldContribution) : null,
        t.id === 18 ? h('span', { class: 'fact' }, icon('rock', 26), icon('lock', 26)) : null),
      no ? h('p', { class: 'note' }, icon(no.i, 32), no.w,
        no.w === 'Juice' && p ? h('span', { class: 'state', style: { marginLeft: 'auto' } }, fmtJuice(p.capacity + p.connectionCapacity - p.load - p.structsLoad > 0n ? p.capacity + p.connectionCapacity - p.load - p.structsLoad : 0n), ' / ', short(Math.round(t.buildDraw / 1000))) : null,
        no.w === 'Nap' ? h('a', { class: 'pill small sun', href: '#/', style: { marginLeft: 'auto' } }, icon('bear', 22), icon('wake', 22)) : null,
        no.w === 'Play' ? h('a', { class: 'pill small red', href: '#/hi', style: { marginLeft: 'auto' } }, 'Play') : null)
        : h('button', { type: 'button', class: 'pill huge red wiggle', onclick: () => make(p!, t) }, icon('make', 44), 'Make', h('span', { class: 'cost', title: 'Wind' }, icon('wind', 18), '≥' + t.buildCharge)));
  }

  function make(p: PlayerState, t: StructType) {
    if (!wallet.unlocked) { bubble('Key', 'key', 'uh'); return; }
    const spot = t.id === 1 ? { ambit: 'land' as const, slot: 0 } : freeSpot(p, t);
    if (!spot) { bubble('Full', 'full', 'uh'); return; }
    try {
      act.build(p, t, spot.ambit, spot.slot);
      audio.chime('make');
      bubble('Make', 'make', 'yay', { toy: toy(t.id).icon });
      setTimeout(() => ctx.go('#/'), 700);
    } catch (e) { const w = oops((e as Error).message); bubble(w.w, w.i, 'uh'); }
  }

  let lastSig = '', lastRow = '';
  function paint() {
    const p = empire.commander;
    const items = ORDER.map((id) => ({ type: id, can: !!typeOf(id) && !why(p, typeOf(id)!) }));
    const sig = JSON.stringify(items);
    if (sig !== lastSig) { lastSig = sig; stage.set(items); }
    // the strip is rebuilt only when it would look different, and keyboard focus stays where it was
    const rowSig = sig + '|' + sel;
    if (rowSig !== lastRow) {
      lastRow = rowSig;
      keepFocus(row, () => {
        clear(row);
        for (const it of items) {
          const T = toy(it.type);
          row.append(h('button', { type: 'button', role: 'option', 'data-key': 'toy:' + it.type, 'aria-selected': String(sel === it.type), 'aria-label': T.word + (it.can ? '' : ' (locked)'), class: (sel === it.type ? 'on' : '') + (it.can ? '' : ' off'), onclick: () => choose(it.type) }, icon(T.icon, 40), it.can ? null : h('span', { class: 'mini' }, icon('lock', 22))));
        }
      });
    }
    strip.hidden = sel != null && matchMedia('(max-width: 760px)').matches;
    keepFocus(card, () => paintCard(p));
    requestAnimationFrame(frameShelf);
  }
  /** The shelf sits in the space the top bar, the toy strip, the dock (and a phone's card) leave open. */
  function frameShelf() {
    const top = (document.querySelector('.top') as HTMLElement | null)?.getBoundingClientRect().bottom ?? 0;
    const phone = matchMedia('(max-width: 760px)').matches;
    const covers = [strip, phone ? card : null, document.querySelector('.dock') as HTMLElement | null]
      .filter((e): e is HTMLElement => !!e && !e.hidden && e.getClientRects().length > 0)
      .map((e) => e.getBoundingClientRect().top);
    const bottom = covers.length ? innerHeight - Math.min(...covers) : 0;
    world.frameInset(top + 8, bottom + 8);
  }
  window.addEventListener('resize', frameShelf);
  const offs = [empire.onChange(paint), wallet.onChange(paint), () => window.removeEventListener('resize', frameShelf), () => world.frameInset(0, 0)];
  paint();
  if (sel) setTimeout(() => choose(sel), 300);
  return { el, title: 'Toys', leave: () => { offs.forEach((f) => f()); world.frame0(0); } };
}
