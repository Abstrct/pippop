/* Hi! A present sits on a little mat. Tap it and a key is made for you (the wallet, sealed in this
 * browser); keep your magic words; pick a name and a club; the club writes you in, a mat is found,
 * and the box pops open: your Bear. Or bring back a kid you had, with your words. */
import { h, clear, bubble } from '../core/dom';
import { icon } from '../ui/icons';
import { world } from '../world/world';
import { helloStage } from '../world/rooms';
import { wallet } from '../wallet/wallet';
import { enlist, enlisting, retryEnlist } from '../game/enlist';
import { explore } from '../game/onboard';
import { guilds, DEFAULT_GUILD, type GuildEntry } from '../guild/directory';
import { empire } from '../game/empire';
import { txq } from '../wallet/queue';
import { audio } from '../core/audio';
import { clubColor, clubName, rollName } from '../lore';
import type { Ctx, Screen } from './types';

type Step = 'start' | 'words' | 'back' | 'name' | 'club' | 'wait' | 'done' | 'key';

export function hi(ctx: Ctx): Screen {
  const stage = helloStage({ pick: () => { if (step === 'start') void makeNew(); else stage.wiggle(); audio.chime('squeak'); } });
  world.use(stage);
  const top = h('div', { class: 'hello-top' });
  const bottom = h('div', { class: 'hello-bottom' });
  const el = h('div', { class: 'hello' }, top, h('div'), bottom);

  let step: Step = 'start';
  let words = '', kept = false, name = '', club = '', clubs: GuildEntry[] | null = null, spoken = '', pass = '', busy = false, err = '';
  let opened = false;

  function decide() {
    const a = wallet.active;
    if (wallet.state === 'locked') step = 'key';
    else if (wallet.state === 'empty') { if (step !== 'back') step = 'start'; }
    else if (empire.commander?.planetId) step = 'done';
    else if (a?.playerId || enlisting.running) step = 'wait';
    else if (enlisting.current?.status === 'failed') step = 'club';
    else if (step === 'start' || step === 'key' || step === 'back' || step === 'words') step = 'name';
  }

  async function makeNew() {
    if (busy) return;
    busy = true; paint();
    try {
      // the magic words wait in Me (the kid chip) for later: setup goes straight to a name
      await wallet.createInstant();
      stage.wiggle(); audio.chime('make');
      step = 'name';
    } catch { bubble('Oops', 'oops', 'uh'); }
    busy = false; paint();
  }

  function loadClubs() {
    if (clubs) return;
    guilds().then((g) => {
      clubs = [...g].filter((x) => !x.error || x.services?.guild_api).sort((a, b) => (b.id === DEFAULT_GUILD ? 1 : 0) - (a.id === DEFAULT_GUILD ? 1 : 0));
      if (!clubs.length) clubs = [...g];
      if (!club && clubs.length) club = clubs[0].id;
      paint();
    }).catch(() => { clubs = []; paint(); });
  }

  const steps = (at: number) => h('div', { class: 'steps', 'aria-label': 'Steps' }, ...['key', 'kid', 'club', 'mat'].map((ic, i) => h('span', { class: 'st ' + (i < at ? 'done' : i === at ? 'now' : '') }, icon(i < at ? 'check' : ic, 32))));

  function paint() {
    decide();
    clear(top); clear(bottom);
    const say = (w: string) => h('h1', { class: 'hello-word' }, w);
    switch (step) {
      case 'start': {
        top.append(say('Hi!'));
        bottom.append(
          h('p', { class: 'tap-hint', 'aria-hidden': 'true' }, busy ? '...' : 'Tap!'),
          h('div', { class: 'row center' },
            h('button', { type: 'button', class: 'pill huge red', disabled: busy, onclick: () => void makeNew() }, icon('gift', 52), 'New'),
            h('button', { type: 'button', class: 'pill big', 'aria-label': 'Words (I have a pet)', onclick: () => { step = 'back'; err = ''; paint(); } }, icon('words', 34), 'Words')),
          h('a', { class: 'pill small sky', href: '#/sky' }, icon('eye', 24), 'Look'));
        break;
      }
      case 'words': {
        top.append(steps(1));
        if (!words) { void wallet.revealPhrase('').then((w) => { words = w; paint(); }).catch(() => {}); }
        bottom.append(h('section', { class: 'card hello-card stack' },
          h('div', { class: 'row' }, icon('words', 56), h('h2', { class: 'big-word' }, 'Magic words'), icon('lock', 40)),
          h('div', { class: 'tiles' }, ...words.split(' ').filter(Boolean).map((w, i) => h('span', { class: 'tile' }, h('i', null, String(i + 1)), w))),
          h('div', { class: 'row between' },
            h('button', { type: 'button', class: 'pill sun', onclick: () => { navigator.clipboard?.writeText(words).then(() => bubble('Copy', 'check', 'yay'), () => bubble('No', 'no', 'uh')); } }, icon('words', 26), 'Copy'),
            h('button', { type: 'button', class: 'check', role: 'checkbox', 'aria-checked': String(kept), onclick: () => { kept = !kept; audio.chime('tap'); paint(); } }, h('span', { class: 'box' }, kept ? icon('check', 30) : null), 'Kept')),
          h('div', { class: 'row between' },
            h('button', { type: 'button', class: 'pill small', onclick: () => { step = 'name'; words = ''; paint(); } }, 'Later'),
            h('button', { type: 'button', class: 'pill big leaf', disabled: !kept, onclick: () => { wallet.markBackedUp(); words = ''; step = 'name'; paint(); } }, 'Next', icon('go', 32)))));
        break;
      }
      case 'back': {
        top.append(say('Back!'));
        const ta = h('textarea', { id: 'words-in', 'aria-label': 'Words', autocomplete: 'off', value: spoken, oninput: (e: Event) => { spoken = (e.target as HTMLTextAreaElement).value; } }) as HTMLTextAreaElement;
        ta.spellcheck = false; ta.setAttribute('autocapitalize', 'off'); ta.setAttribute('autocorrect', 'off');
        bottom.append(h('section', { class: 'card hello-card stack' },
          h('div', { class: 'row' }, icon('words', 56), h('h2', { class: 'big-word' }, 'Words')),
          h('div', { class: 'field' }, ta),
          err ? h('p', { class: 'note' }, icon('oops', 30), err) : null,
          h('div', { class: 'row between' },
            h('button', { type: 'button', class: 'pill', onclick: () => { step = 'start'; paint(); } }, icon('back', 30), 'Back'),
            h('button', { type: 'button', class: 'pill big leaf', disabled: busy, onclick: async () => {
              busy = true; err = ''; paint();
              try { await wallet.createInstant(ta.value.trim().toLowerCase().replace(/\s+/g, ' ')); spoken = ''; wallet.markBackedUp(); await wallet.resolvePlayers(); audio.chime('yay'); step = 'name'; }
              catch { err = 'No'; }
              busy = false; paint();
              if (wallet.active?.playerId) setTimeout(() => ctx.go('#/'), 400);
            } }, busy ? '...' : 'Go', icon('go', 32)))));
        setTimeout(() => ta.focus(), 60);
        break;
      }
      case 'name': {
        top.append(steps(1));
        // a name is letters and numbers; a space shows as _ right away, instead of vanishing later
        const inp = h('input', { id: 'kid-name', 'aria-label': 'Name', value: name, maxLength: 20, autocomplete: 'nickname', oninput: (e: Event) => { const t = e.target as HTMLInputElement; const at = t.selectionStart; t.value = t.value.replace(/\s/g, '_').replace(/[^A-Za-z0-9_-]/g, ''); try { t.setSelectionRange(at, at); } catch { /* fine */ } name = t.value; go.disabled = name.length < 3; },
          onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' && name.length >= 3) { step = 'club'; paint(); } } }) as HTMLInputElement;
        const go = h('button', { type: 'button', class: 'pill big leaf', disabled: name.length < 3, onclick: () => { step = 'club'; paint(); } }, 'Next', icon('go', 32)) as HTMLButtonElement;
        bottom.append(h('section', { class: 'card hello-card stack' },
          h('div', { class: 'row' }, icon('kid', 56), h('h2', { class: 'big-word' }, 'Name')),
          h('div', { class: 'row nowrap' }, h('div', { class: 'field', style: { flex: '1' } }, inp),
            h('button', { type: 'button', class: 'round', 'aria-label': 'Dice', onclick: () => { name = rollName(); inp.value = name; go.disabled = false; audio.chime('boing'); } }, icon('dice', 40))),
          h('div', { class: 'row end', style: { justifyContent: 'flex-end' } }, go)));
        if (!name) { name = rollName(); inp.value = name; go.disabled = false; }
        setTimeout(() => inp.focus(), 60);
        break;
      }
      case 'club': {
        top.append(steps(2));
        loadClubs();
        const list = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Club' });
        if (!clubs) list.append(h('span', { class: 'state' }, h('span', { class: 'spin' }, icon('tick', 26)), '...'));
        else if (!clubs.length) list.append(h('span', { class: 'note' }, icon('slow', 30), 'Slow'));
        else for (const g of clubs) list.append(h('button', { type: 'button', class: 'flag', role: 'radio', 'aria-checked': String(club === g.id), 'aria-pressed': String(club === g.id), onclick: () => { club = g.id; audio.chime('tap'); paint(); } },
          h('span', { class: 'sw', style: { background: clubColor(g.id) } }), clubName(g.id, g.meta?.name), g.id === DEFAULT_GUILD ? icon('star', 22) : null));
        const failed = enlisting.current?.status === 'failed';
        bottom.append(h('section', { class: 'card hello-card stack' },
          h('div', { class: 'row' }, icon('club', 56), h('h2', { class: 'big-word' }, 'Club')),
          list,
          failed || err ? h('p', { class: 'note' }, icon('oops', 30), err || 'Oops') : null,
          h('div', { class: 'row between' },
            h('button', { type: 'button', class: 'pill', 'aria-label': 'Back', onclick: () => { step = 'name'; paint(); } }, icon('back', 30)),
            h('button', { type: 'button', class: 'pill huge red', disabled: !club || busy, onclick: async () => {
              const g = clubs?.find((c) => c.id === club); if (!g) return;
              busy = true; err = ''; paint();
              try { if (failed) retryEnlist(); else await enlist(name || rollName(), g.id, clubName(g.id, g.meta?.name)); audio.chime('make'); }
              catch { err = 'Oops'; }
              busy = false; paint();
            } }, 'Go!', icon('go', 48)))));
        break;
      }
      case 'wait': {
        const pid = wallet.active?.playerId;
        const seek = pid ? txq.jobs.filter((j) => j.playerId === pid && j.msgs.some((m) => /MsgPlanetExplore$/.test(m.typeUrl))).pop() : undefined;
        top.append(steps(pid ? 3 : 2));
        bottom.append(h('section', { class: 'card hello-card stack', style: { justifyItems: 'center', textAlign: 'center' } },
          h('div', { class: 'row center' }, h('span', { class: 'spin' }, icon('wind', 64)), h('h2', { class: 'big-word' }, pid ? 'Mat...' : 'Club...')),
          enlisting.current?.status === 'failed' ? h('button', { type: 'button', class: 'pill big red', onclick: () => retryEnlist() }, icon('oops', 30), 'Again') : null,
          seek?.status === 'failed' && pid ? h('button', { type: 'button', class: 'pill big red', onclick: () => { const a = wallet.active; if (a?.playerId) explore(a.index, a.playerId); } }, icon('find', 30), 'Find') : null,
          h('a', { class: 'pill small sky', href: '#/sky' }, icon('eye', 24), 'Look')));
        stage.wiggle();
        break;
      }
      case 'done': {
        if (!opened) { opened = true; stage.open(); audio.chime('open'); }
        top.append(say('Yay!'));
        bottom.append(h('button', { type: 'button', class: 'pill huge leaf wiggle', onclick: () => { try { sessionStorage.setItem('pippop.hatch', '1'); } catch { /* fine */ } ctx.go('#/'); } }, icon('mat', 52), 'Play!'));
        break;
      }
      case 'key': {
        top.append(say('Key'));
        const inp = h('input', { id: 'hi-key', type: 'password', autocomplete: 'current-password', 'aria-label': 'Key', value: pass, oninput: (e: Event) => { pass = (e.target as HTMLInputElement).value; } }) as HTMLInputElement;
        bottom.append(h('section', { class: 'card hello-card stack' },
          h('div', { class: 'row' }, icon('lock', 56), h('div', { class: 'field', style: { flex: '1' } }, inp)),
          h('button', { type: 'button', class: 'pill big leaf', onclick: async () => { try { await wallet.unlock(inp.value); pass = ''; } catch { bubble('No', 'no', 'uh'); } } }, icon('key', 30), 'Open')));
        break;
      }
    }
  }
  const offs = [wallet.onChange(paint), enlisting.onChange(paint), empire.onChange(paint), txq.onChange(() => { if (step === 'wait') paint(); })];
  paint();
  return { el, title: 'Hi', leave: () => offs.forEach((f) => f()) };
}
