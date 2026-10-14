/* The two ways out, kept small: the Structs game itself, and its technical documentation. */
import { h } from '../core/dom';
import { icon } from './icons';

export function outLinks(): HTMLElement {
  const a = (href: string, ic: string, word: string, label: string) =>
    h('a', { class: 'out-link', href, target: '_blank', rel: 'noopener', 'aria-label': label, title: label }, icon(ic, 20), word);
  return h('nav', { class: 'out-links', 'aria-label': 'Structs' },
    a('https://playstructs.com', 'star', 'Structs', 'Structs, the official game (playstructs.com)'),
    a('https://structs.ai', 'book', 'Docs', 'Structs technical documentation (structs.ai)'));
}
