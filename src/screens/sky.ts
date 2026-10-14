/* The Sky: every kid on the ledger, hanging from the crib mobile in their club's colour. Tap a mat to
 * see whose it is; Peek at it, Roll your wagon there (MsgFleetMove), or go Bonk. */
import { h, clear, bubble, keepFocus } from '../core/dom';
import { icon } from '../ui/icons';
import { world } from '../world/world';
import { skyStage } from '../world/sky';
import { glanceFromGuild, kids as readKids, kidsFromGuild, sight, skyFull, type Glance, type Kid, type Sight } from '../realm';
import { guilds, type GuildEntry } from '../guild/directory';
import { empire } from '../game/empire';
import { act } from '../game/actions';
import { wallet } from '../wallet/wallet';
import { live } from '../chain/live';
import { audio } from '../core/audio';
import { clubColor, clubName, kidName, oops } from '../lore';
import { alive, wyrmOf } from '../game/war';
import type { Ctx, Screen } from './types';

export function sky(_ctx: Ctx): Screen {
  const stage = skyStage({ pick: (i) => choose(i) });
  world.use(stage);
  const filters = h('div', { class: 'chips' });
  const search = h('input', { id: 'kid-find', type: 'search', 'aria-label': 'Name', placeholder: '', autocomplete: 'off', oninput: () => { apply(); } }) as HTMLInputElement;
  const left = h('section', { class: 'card panel left hide-phone stack', 'aria-label': 'Clubs' },
    h('div', { class: 'row nowrap' }, icon('find', 40), h('div', { class: 'field', style: { flex: '1' } }, search)), filters);
  const card = h('section', { class: 'card panel right toy-card', 'aria-label': 'Kid', hidden: true });
  const el = h('div', null, left, card);

  let all: Kid[] = [], shown: Kid[] = [];
  let clubs = new Map<string, GuildEntry>();
  let seen = new Map<string, Sight>();
  let club: string | null = null, rich = false, sel: number | null = null;
  let scouted: string | null = null;
  /** Cards read from the Guild API (one small read per kid), when there is a guild session. */
  const glances = new Map<string, Glance | 'reading'>();
  let viaGuild = false;

  const myId = () => empire.commander?.playerId;
  /** A club's name once the directory has answered; until then '…', never a stand-in that changes. */
  const clubLabel = (gid: string) => (clubs.size ? clubName(gid, clubs.get(gid)?.meta?.name) : '…');
  function apply() {
    const q = search.value.trim().toLowerCase();
    const me = myId();
    shown = all.filter((k) => (!club || k.guildId === club) && (!rich || (seen.get(k.id)?.ore ?? 0) > 0 || k.id === me) && (!q || (k.name || '').toLowerCase().includes(q) || k.id.endsWith(q)));
    // me first (the middle hoop), then by club so the colours gather
    shown.sort((a, b) => (b.id === me ? 1 : 0) - (a.id === me ? 1 : 0) || a.guildId.localeCompare(b.guildId) || Number(a.id.split('-')[1]) - Number(b.id.split('-')[1]));
    stage.set(shown.map((k) => ({ id: k.id, color: clubColor(k.guildId), rich: (seen.get(k.id)?.ore ?? 0) > 0 && k.id !== me, me: k.id === me, sleepy: k.id !== me && !!seen.get(k.id)?.lastAction && live.height - (seen.get(k.id)?.lastAction ?? 0) > 600, name: kidName(k) })));
    const keep = chosenId ? shown.findIndex((k) => k.id === chosenId) : -1;
    sel = keep >= 0 ? keep : null; if (keep < 0) chosenId = null;
    stage.select(sel); paintCard();
    paintFilters();
  }
  let chosenId: string | null = null;
  function choose(i: number | null) {
    sel = i; stage.select(i);
    chosenId = i != null ? shown[i]?.id ?? null : null;
    audio.chime(i == null ? 'boop' : 'squeak');
    const k = i != null ? shown[i] : null;
    if (scouted && scouted !== k?.id) { empire.unwatch(scouted); scouted = null; }
    if (k && k.id !== myId() && !wallet.byPlayer(k.id)) {
      if (viaGuild) glance(k.id);
      else { scouted = k.id; empire.watch(k.id); }
    }
    paintCard();
    world.frame0(i != null && matchMedia('(min-width: 761px)').matches ? 170 : 0);
  }

  function glance(id: string) {
    const g = glances.get(id);
    if (g && g !== 'reading') return;
    if (g === 'reading') return;
    glances.set(id, 'reading');
    glanceFromGuild(id).then((x) => { if (x) glances.set(id, x); else glances.delete(id); }, () => glances.delete(id)).finally(() => { if (!left_) paintCard(); });
    // a card read a while ago is read again next time it is opened
    setTimeout(() => { if (glances.get(id) !== 'reading') glances.delete(id); }, 30_000);
  }

  function paintFilters() {
    clear(filters);
    const count = new Map<string, number>();
    for (const k of all) count.set(k.guildId, (count.get(k.guildId) || 0) + 1);
    const richN = all.filter((k) => (seen.get(k.id)?.ore ?? 0) > 0).length;
    filters.append(h('button', { type: 'button', class: 'flag', 'aria-pressed': String(rich), 'aria-label': `Rocks ${richN}`, title: 'Rocks', onclick: () => { rich = !rich; apply(); } }, icon('rock', 30), String(richN)));
    for (const [gid, n] of [...count].sort((a, b) => b[1] - a[1])) {
      filters.append(h('button', { type: 'button', class: 'flag', 'aria-pressed': String(club === gid), onclick: () => { club = club === gid ? null : gid; apply(); } },
        h('span', { class: 'sw', style: { background: clubColor(gid) } }), clubLabel(gid), h('span', { class: 'small-word' }, String(n))));
    }
  }

  function paintCard() {
    keepFocus(card, () => {
      clear(card);
      const k = sel != null ? shown[sel] : null;
      card.hidden = !k;
      if (!k) return;
      const me = empire.commander;
      const isMe = k.id === me?.playerId;
      const s = seen.get(k.id);
      const them = empire.players.get(k.id);
      const g = glances.get(k.id);
      const gl = g && g !== 'reading' ? g : null;
      const bear = wyrmOf(them ?? null);
      const bearNow: { health: number; max: number } | 'gone' | null = gl ? gl.bear : them ? (bear && alive(bear) ? { health: bear.health, max: bear.type!.maxHealth } : 'gone') : null;
      const awayNow = gl ? gl.away : them?.fleet?.status === 'away';
      const oreNow = gl ? gl.ore : s?.ore ?? 0;
      const away = me?.fleet?.status === 'away';
      const thereNow = away && me?.fleet?.locationId === k.planetId;
      const sleepy = s?.lastAction && live.height ? live.height - s.lastAction > 600 : false;
      card.append(
        h('button', { type: 'button', class: 'round x', 'aria-label': 'Close', onclick: () => choose(null), style: { width: '52px', height: '52px' } }, icon('close', 34)),
        h('div', { class: 'toy-head' }, h('span', { style: { display: 'grid', placeItems: 'center', width: '72px', height: '72px', borderRadius: '50%', background: '#FFC72C', border: `6px solid ${clubColor(k.guildId)}` } }, icon('kid', 48)),
          h('div', { class: 'stack', style: { gap: '6px' } }, h('h2', { class: 'big-word' }, isMe ? 'Me' : kidName(k)),
            h('span', { class: 'flag', style: { minHeight: '40px', justifySelf: 'start' } }, h('span', { class: 'sw', style: { background: clubColor(k.guildId) } }), clubLabel(k.guildId)))),
        h('div', { class: 'facts' },
          h('span', { class: 'fact', title: 'Rocks' }, icon('rock', 30), String(oreNow)),
          h('span', { class: 'fact', title: 'Bear' }, icon('bear', 30), bearNow === 'gone' ? icon('gone', 26) : bearNow ? h('span', { class: 'hearts' }, ...Array.from({ length: bearNow.max }, (_, i) => icon(i < bearNow.health ? 'heart' : 'heart0', 18))) : h('span', { class: 'spin' }, icon('tick', 22))),
          sleepy ? h('span', { class: 'fact' }, icon('nap', 30), 'Zzz') : null,
          awayNow ? h('span', { class: 'fact' }, icon('wagon', 30), 'Away') : null),
        h('div', { class: 'acts' },
          h('a', { class: 'pill sky', href: isMe ? '#/' : `#/mat/${k.id}` }, icon(isMe ? 'mat' : 'eye', 28), isMe ? 'Mat' : 'Peek'),
          !isMe && me ? (thereNow
            ? h('a', { class: 'pill red', href: `#/bonk/${k.id}` }, icon('bonk', 28), 'Bonk')
            : h('button', { type: 'button', class: 'pill blue', onclick: () => roll(k) }, icon('roll', 28), 'Roll')) : null,
          !isMe && me && !thereNow ? h('a', { class: 'pill red', href: `#/bonk/${k.id}` }, icon('bonk', 28), 'Bonk') : null,
          isMe && away ? h('button', { type: 'button', class: 'pill sun', onclick: () => { if (me) { try { act.fleetMove(me, me.planetId); audio.chime('whoosh'); } catch (e) { const w = oops((e as Error).message); bubble(w.w, w.i, 'uh'); } } } }, icon('home', 28), 'Home') : null,
          !me && !isMe ? h('a', { class: 'pill red', href: '#/hi' }, icon('gift', 28), 'Play') : null));
    });
  }

  function roll(k: Kid) {
    const me = empire.commander; if (!me) return;
    if (!wallet.unlocked) { bubble('Key', 'key', 'uh'); return; }
    const full = skyFull(empire.players.get(k.id)?.planet, me);
    if (full) { bubble('Full', 'full', 'uh'); return; }
    const bear = wyrmOf(me);
    if (!bear || !alive(bear)) { bubble('Bear', 'bear', 'uh'); return; }
    if (!bear.online) { bubble('Nap', 'nap', 'uh'); return; }
    try {
      act.fleetMove(me, k.planetId);
      const from = shown.findIndex((x) => x.id === me.playerId), to = shown.findIndex((x) => x.id === k.id);
      stage.roll(from, to);
      audio.chime('whoosh');
      bubble('Roll', 'roll', 'yay', { toy: 'wagon' });
    } catch (e) { const w = oops((e as Error).message); bubble(w.w, w.i, 'uh'); }
  }

  let left_ = false;
  async function load() {
    try {
      // the guild's index first (a handful of small reads); the ledger only when there is no guild session
      const fast = await kidsFromGuild().catch(() => null);
      viaGuild = !!fast;
      // the mats go up the moment the kids are known; club names arrive when the directory answers
      // (a club whose guild.json never answers this page used to hold the whole sky back for seconds)
      void guilds().then((g) => { if (left_) return; clubs = new Map(g.map((x) => [x.id, x])); paintFilters(); paintCard(); }).catch(() => {});
      const k = fast ? fast.list : await readKids();
      if (left_) return;
      all = k;
      if (fast) seen = fast.seen;
      const me = empire.commander;
      if (me && !all.some((x) => x.id === me.playerId)) all.unshift({ id: me.playerId, name: me.name, guildId: me.guildId, planetId: me.planetId, fleetId: me.fleetId, address: me.address });
      apply();
      if (!fast) sight().then((m) => { if (left_) return; seen = m; apply(); }).catch(() => {});
    } catch { if (!left_) { bubble('Slow', 'slow', 'uh', { action: { label: 'Again', icon: 'roll', run: () => void load() } }); } }
  }
  void load();
  const offs = [empire.onChange(() => { if (sel != null) paintCard(); })];
  return { el, title: 'Sky', leave: () => { left_ = true; offs.forEach((f) => f()); if (scouted) empire.unwatch(scouted); world.frame0(0); } };
}
