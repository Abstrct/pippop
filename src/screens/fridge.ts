/* The Fridge: where stars turn into juice. Every club keeps a jar (a reactor); put stars in (Fill,
 * MsgReactorInfuse) and your cup gets more juice; take them back out (Take, MsgReactorDefuse) slowly. */
import { h, clear, bubble, confirmBox } from '../core/dom';
import { icon } from '../ui/icons';
import { world } from '../world/world';
import { fridgeStage } from '../world/rooms';
import { lcd, big, type Grid, type RawInfusion, type RawReactor } from '../chain/lcd';
import { guilds, type GuildEntry } from '../guild/directory';
import { empire } from '../game/empire';
import { wallet } from '../wallet/wallet';
import { txq } from '../wallet/queue';
import { audio } from '../core/audio';
import { clubColor, clubName, fmtJuice, fmtStars, oops, short } from '../lore';
import type { Ctx, Screen } from './types';

interface Well { r: RawReactor; grid: Grid; cut: number }
const M = (name: string, value: Record<string, unknown>) => ({ typeUrl: `/structs.structs.${name}`, value });

export function fridge(_ctx: Ctx): Screen {
  const stage = fridgeStage({ pick: (id) => choose(id) });
  world.use(stage);
  const card = h('section', { class: 'card panel right toy-card', 'aria-label': 'Jar', hidden: true });
  const cupCard = h('section', { class: 'card panel left stack', 'aria-label': 'Cup' });
  const el = h('div', null, cupCard, card);

  let wells: Well[] = [], fills: RawInfusion[] = [], clubs = new Map<string, GuildEntry>(), sel: string | null = null, left = false;
  const name = (gid: string) => clubName(gid, clubs.get(gid)?.meta?.name);

  async function load() {
    const p = empire.commander;
    const [rs, inf, gs] = await Promise.all([
      lcd.list<RawReactor>('reactor', 'Reactor'),
      p ? lcd.list<RawInfusion>('infusion', 'Infusion').catch(() => [] as RawInfusion[]) : Promise.resolve([] as RawInfusion[]),
      guilds().catch(() => [] as GuildEntry[]),
    ]);
    const grids = await Promise.all(rs.map((r) => lcd.entity<{ gridAttributes?: Grid }>('reactor', r.id).then((x) => x.gridAttributes || {}).catch(() => ({} as Grid))));
    if (left) return;
    clubs = new Map(gs.map((c) => [c.id, c]));
    wells = rs.map((r, i) => ({ r, grid: grids[i], cut: Number(r.defaultCommission || 0) })).sort((a, b) => Number(big(b.grid.fuel) - big(a.grid.fuel)));
    fills = p ? inf.filter((i) => i.address === p.address && i.destinationType === 'reactor') : [];
    paint();
  }

  const wide = () => matchMedia('(min-width: 761px)').matches;
  // the cup card sits on the left: the fridge stands right of it, or between both cards
  function choose(id: string | null) { sel = id; stage.select(id); audio.chime(id ? 'squeak' : 'boop'); paint(); world.frame0(wide() ? (id ? 0 : -150) : 0); }
  world.frame0(wide() ? -150 : 0);

  function paint() {
    const p = empire.commander;
    const ourWell = p ? clubs.get(p.guildId)?.chain?.primaryReactorId : undefined;
    const maxFuel = wells.reduce((m, w) => (big(w.grid.fuel) > m ? big(w.grid.fuel) : m), 1n);
    const cap = p ? p.capacity + p.connectionCapacity : 0n, load = p ? p.load + p.structsLoad : 0n;
    stage.set(wells.map((w) => ({ id: w.r.id, color: clubColor(w.r.guildId), fill: Number((big(w.grid.fuel) * 1000n) / maxFuel) / 1000, ours: w.r.id === ourWell, mine: fills.some((f) => f.destinationId === w.r.id), label: name(w.r.guildId) })), cap > 0n ? Number(((cap - (load > cap ? cap : load)) * 100n) / cap) / 100 : 0);
    // my cup
    clear(cupCard);
    if (!p) cupCard.append(h('a', { class: 'pill big red', href: '#/hi' }, icon('gift', 30), 'Play'));
    else {
      const mineIn = fills.reduce((a, t) => a + big(t.fuel), 0n);
      cupCard.append(h('div', { class: 'row' }, icon('cup', 56), h('h2', { class: 'big-word' }, 'Me')),
        h('div', { class: 'facts' },
          h('span', { class: 'fact', title: 'Juice' }, icon('juice', 30), fmtJuice(cap - load > 0n ? cap - load : 0n)),
          h('span', { class: 'fact', title: 'All' }, icon('cup', 30), fmtJuice(cap)),
          h('span', { class: 'fact', title: 'Stars' }, icon('star', 30), fmtStars(p.alpha)),
          h('span', { class: 'fact', title: 'In' }, icon('fridge', 30), fmtStars(mineIn))),
        ourWell ? h('button', { type: 'button', class: 'pill big sun wiggle', 'aria-label': 'Fill', onclick: () => choose(ourWell) }, icon('star', 30), icon('go', 26), icon('fridge', 30)) : '');
    }
    // the chosen jar
    clear(card);
    const w = wells.find((x) => x.r.id === sel);
    card.hidden = !w;
    if (!w) return;
    const myFill = big(fills.find((t) => t.destinationId === w.r.id)?.fuel);
    card.append(
      h('button', { type: 'button', class: 'round x', 'aria-label': 'Close', onclick: () => choose(null), style: { width: '52px', height: '52px' } }, icon('close', 34)),
      h('div', { class: 'toy-head' }, h('span', { style: { display: 'grid', placeItems: 'center', width: '72px', height: '72px', borderRadius: '24px', background: clubColor(w.r.guildId) } }, icon('fridge', 52)),
        h('div', { class: 'stack', style: { gap: '6px' } }, h('h2', { class: 'big-word' }, name(w.r.guildId)), w.r.id === ourWell ? h('span', { class: 'state' }, icon('star', 24), icon('club', 24)) : null)),
      h('div', { class: 'facts' },
        h('span', { class: 'fact', title: 'Stars' }, icon('star', 30), fmtStars(big(w.grid.fuel))),
        h('span', { class: 'fact', title: 'Juice' }, icon('juice', 30), fmtJuice(big(w.grid.capacity) || big(w.grid.power))),
        h('span', { class: 'fact', title: 'Mine' }, icon('kid', 30), fmtStars(myFill)),
        h('span', { class: 'fact', title: 'Cut' }, icon('pop', 28), `${Math.round(w.cut * 100)}`)),
      p ? h('div', { class: 'acts' },
        h('button', { type: 'button', class: 'pill big sun', onclick: () => stepper(w, false) }, icon('star', 30), 'Fill'),
        myFill > 0n ? h('button', { type: 'button', class: 'pill big', onclick: () => stepper(w, true) }, icon('take', 30), 'Take') : null) : '');
  }

  function stepper(w: Well, out: boolean) {
    const p = empire.commander; if (!p) return;
    if (!wallet.unlocked) { bubble('Key', 'key', 'uh'); return; }
    const max = out ? big(fills.find((t) => t.destinationId === w.r.id)?.fuel) : p.alpha;
    if (max <= 0n) { bubble('Stars', 'star', 'uh', { action: { label: 'Mat', icon: 'mat', run: () => { location.hash = '#/'; } } }); return; }
    const maxN = Number(max) / 1e6;
    let n = Math.min(1, maxN);
    const val = h('span', { class: 'big-word', style: { minWidth: '120px', textAlign: 'center' } }, String(n));
    // what it does to your cup: each star is about a thousand juice, less the club's cut
    const gain = h('b', null, '');
    const set = (x: number) => { n = Math.max(0.000001, Math.min(maxN, Math.round(x * 1e6) / 1e6)); val.textContent = String(Math.round(n * 1000) / 1000); gain.textContent = (out ? '-' : '+') + short(Math.round(n * 1000 * (1 - w.cut))); };
    const v = h('div', { class: 'veil', onclick: (e: Event) => { if (e.target === v) v.remove(); } },
      h('section', { class: 'card stack', role: 'dialog', 'aria-modal': 'true', 'aria-label': out ? 'Take' : 'Fill', style: { position: 'relative', justifyItems: 'center' } },
        h('button', { type: 'button', class: 'round x', 'aria-label': 'Close', 'data-dismiss': '', onclick: () => v.remove() }, icon('close', 40)),
        h('div', { class: 'row' }, icon(out ? 'take' : 'fill', 64), h('h2', { class: 'big-word' }, out ? 'Take' : 'Fill')),
        h('div', { class: 'row center nowrap' },
          h('button', { type: 'button', class: 'round', 'aria-label': 'Less', onclick: () => set(n >= 2 ? n - 1 : n / 2) }, icon('minus', 44)),
          h('span', { class: 'row nowrap', style: { gap: '4px' } }, icon('star', 44), val),
          h('button', { type: 'button', class: 'round', 'aria-label': 'More', onclick: () => set(n >= 1 ? n + 1 : n * 2) }, icon('plus', 44))),
        h('span', { class: 'state', role: 'img', 'aria-label': 'Juice' }, icon('juice', 26), gain),
        h('button', { type: 'button', class: 'pill small', onclick: () => set(maxN) }, icon('star', 22), 'All'),
        h('button', { type: 'button', class: 'pill huge ' + (out ? 'peach' : 'sun'), onclick: async () => {
          const u = BigInt(Math.round(n * 1e6)); if (u <= 0n || u > max) return;
          if (out && !(await confirmBox('Take?', '', 'Take', 'enemy', { icon: 'juice', okIcon: 'take', stay: 'Keep' }))) return;
          v.remove();
          try {
            const job = txq.enqueue(M(out ? 'MsgReactorDefuse' : 'MsgReactorInfuse', { delegator_address: p.address, validator_address: w.r.validator, amount: { denom: 'ualpha', amount: u.toString() } }),
              { account: p.account, playerId: p.playerId, label: out ? 'Take' : 'Fill', source: 'you' });
            stage.pour(w.r.id, out); audio.chime(out ? 'boop' : 'pop');
            const off = txq.onSettled((j) => { if (j.id !== job.id || j.status === 'failed') return; off(); if (j.status === 'success' && !left) setTimeout(() => { if (!left) void load(); }, 1200); });
            offs.push(off);
          } catch (e) { const ww = oops((e as Error).message); bubble(ww.w, ww.i, 'uh'); }
        } }, icon(out ? 'take' : 'star', 44), out ? 'Take' : 'Fill')));
    set(n);
    document.body.append(v);
  }

  const offs: (() => unknown)[] = [empire.onChange(paint)];
  const read = () => { load().catch(() => { if (!left) { bubble('Slow', 'slow', 'uh'); setTimeout(read, 8000); } }); };
  read();
  paint();
  return { el, title: 'Fridge', leave: () => { left = true; offs.forEach((f) => f()); world.frame0(0); document.querySelectorAll('.veil').forEach((v) => v.remove()); } };
}
