/* The lunchbox: you. Your kid, your club, your magic words, and the key. Keys never leave the tab. */
import { h, clear, bubble, holdButton } from '../core/dom';
import { icon } from './icons';
import { outLinks } from './links';
import { wallet } from '../wallet/wallet';
import { empire } from '../game/empire';
import { guilds, guildsNow } from '../guild/directory';
import { clubColor, clubName, kidName, fmtStars } from '../lore';

let open: HTMLElement | null = null;

export function openMe() {
  if (!wallet.active?.playerId && wallet.state !== 'locked') { location.hash = '#/hi'; return; }
  if (open) return;
  const body = h('div', { class: 'stack' });
  const veil = h('div', { class: 'veil', onclick: (e: Event) => { if (e.target === veil) close(); } },
    h('section', { class: 'card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Me', style: { position: 'relative' } },
      h('button', { type: 'button', class: 'round x', 'aria-label': 'Close', 'data-dismiss': '', onclick: () => close() }, icon('close', 40)), body));
  open = veil;
  document.body.append(veil);
  let words = '';
  let pass = '';
  function close() { off(); veil.remove(); open = null; }

  function paint() {
    clear(body);
    if (wallet.state === 'locked') {
      const inp = h('input', { id: 'me-key', type: 'password', autocomplete: 'current-password', 'aria-label': 'Key', value: pass, oninput: (e: Event) => { pass = (e.target as HTMLInputElement).value; } }) as HTMLInputElement;
      body.append(h('div', { class: 'row' }, icon('lock', 72), h('h2', { class: 'big-word' }, 'Key')),
        h('div', { class: 'field' }, inp),
        h('button', { type: 'button', class: 'pill big leaf', onclick: async () => { try { await wallet.unlock(inp.value); pass = ''; bubble('Open', 'key', 'yay'); close(); } catch { bubble('No', 'no', 'uh'); } } }, icon('key', 30), 'Open'));
      setTimeout(() => inp.focus(), 50);
      return;
    }
    const p = empire.commander;
    const gid = p?.guildId || '';
    const club = guildsNow() ? clubName(gid, guildsNow()?.find((g) => g.id === gid)?.meta?.name) : '…';
    body.append(
      h('div', { class: 'row nowrap' }, h('span', { style: { display: 'grid', placeItems: 'center', width: '88px', height: '88px', borderRadius: '50%', background: '#FFC72C', border: `6px solid ${clubColor(gid)}` } }, icon('kid', 60)),
        h('div', { class: 'stack', style: { gap: '4px' } }, h('h2', { class: 'big-word' }, p ? kidName(p) : 'Me'),
          h('span', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'flag', style: { minHeight: '40px' } }, h('span', { class: 'sw', style: { background: clubColor(gid) } }), club),
            p ? h('span', { class: 'state' }, icon('star', 26), fmtStars(p.alpha)) : null))),
    );
    if (words) {
      body.append(h('div', { class: 'row' }, icon('words', 44), h('h3', { class: 'mid-word' }, 'Words')),
        h('div', { class: 'tiles' }, ...words.split(' ').map((w, i) => h('span', { class: 'tile' }, h('i', null, String(i + 1)), w))),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'pill sun', onclick: () => { navigator.clipboard?.writeText(words).then(() => bubble('Copy', 'check', 'yay'), () => bubble('No', 'no', 'uh')); } }, icon('words', 26), 'Copy'),
          h('button', { type: 'button', class: 'pill', onclick: () => { words = ''; wallet.markBackedUp(); paint(); } }, icon('hide', 26), 'Hide')));
    } else {
      body.append(h('div', { class: 'row' },
        h('button', { type: 'button', class: 'pill big ' + (wallet.backedUp ? 'sun' : 'red wiggle'), 'aria-label': wallet.backedUp ? 'Words (kept)' : 'Words (keep them safe)', onclick: async () => { try { words = await wallet.revealPhrase(''); paint(); } catch { bubble('Key', 'key', 'uh'); } } }, icon('words', 32), 'Words', icon(wallet.backedUp ? 'check' : 'lock', 26)),
        // what the words are for, in pictures: lose this browser, and the words bring your kid back
        h('span', { class: 'state', role: 'img', 'aria-label': 'Words bring your kid back' }, icon('words', 24), icon('go', 18), icon('kid', 24))));
    }
    body.append(h('div', { class: 'row between', style: { marginTop: '8px' } },
      h('a', { class: 'pill blue', href: '#/', onclick: () => close() }, icon('mat', 28), 'Mat'),
      // a grown-up gate: hold to forget this key here (the words bring it back)
      holdButton('small', 'toss', 'Bye', () => { wallet.forget(); close(); location.hash = '#/hi'; }, wallet.backedUp ? 1400 : 2600)),
      outLinks());
  }
  // the club's own name arrives with the directory: read it, then say it
  if (!guildsNow()) void guilds().then(() => { if (open === veil) paint(); }).catch(() => {});
  const off = (() => { const a = wallet.onChange(paint), b = empire.onChange(() => { if (!words) paint(); }); return () => { a(); b(); }; })();
  paint();
}
