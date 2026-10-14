/* Every symbol in the toy box: chunky filled shapes with an ink outline, drawn on a 24 grid.
 * A symbol is a list of [fill, path] layers; 'none' fill is an ink line. */
import { C } from '../lore';

type Layer = [string, string];
const I: Record<string, Layer[]> = {
  /* stuff */
  star: [[C.sun, 'M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z']],
  rock: [['#C9B38F', 'M4 18c-2-4 1-9 5-9 2-3 7-3 9 0 3 1 5 6 2 9z'], ['none', 'M9 13l2 1M14 12l1 2']],
  juice: [[C.peach, 'M7 8h10v13H7z'], ['none', 'M12 8V3h4M9 13h6']],
  wind: [[C.sky, 'M12 11C9 3 4 5 4 8s4 3 8 3c4 0 8 0 8-3s-5-5-8 3z'], ['none', 'M12 11v10M9 18h6']],
  fort: [[C.red, 'M2 20L12 4l10 16z'], [C.cream, 'M9 20l3-6 3 6z']],
  tick: [[C.white, 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z'], ['none', 'M12 7v5l3 2']],
  heart: [[C.red, 'M12 21C5 16 2 12 2 8a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 4-3 8-10 13z']],
  heart0: [['#F4C7CE', 'M12 21C5 16 2 12 2 8a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 4-3 8-10 13z']],
  key: [[C.sun, 'M8 4a5 5 0 1 0 0 10 5 5 0 1 0 0-10z'], ['none', 'M12 11l9 9M17 16l2-2M19 18l2-2'], [C.cream, 'M8 7a2 2 0 1 0 0 4 2 2 0 1 0 0-4z']],
  /* things */
  kid: [[C.peach, 'M12 3a4 4 0 1 0 0 8 4 4 0 1 0 0-8z'], [C.blue, 'M5 21c0-5 3-8 7-8s7 3 7 8z']],
  club: [[C.red, 'M5 4h12l-3 4 3 4H5z'], ['none', 'M5 21V3']],
  mat: [[C.leaf, 'M2 13c0-3 4.5-5 10-5s10 2 10 5-4.5 5-10 5S2 16 2 13z'], [C.red, 'M2 13c0 3 4.5 5 10 5s10-2 10-5v2c0 3-4.5 5-10 5S2 18 2 15z']],
  wagon: [[C.red, 'M3 9h16l-2 7H5z'], ['none', 'M19 9l3-4'], [C.sun, 'M5 19a2 2 0 1 0 4 0 2 2 0 1 0-4 0M13 19a2 2 0 1 0 4 0 2 2 0 1 0-4 0']],
  fridge: [[C.white, 'M6 2h12v20H6z'], ['none', 'M6 9h12M9 5v2M9 12v3']],
  cup: [[C.sky, 'M6 8h12l-2 13H8z'], ['none', 'M12 8V3h4']],
  moon: [[C.sun, 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z']],
  cloud: [[C.white, 'M6 18a4 4 0 0 1 0-8 6 6 0 0 1 11-1 4.5 4.5 0 0 1 1 9z']],
  grass: [[C.leaf, 'M3 20c1-5 2-8 4-10 0 4 1 6 2 8 1-5 3-10 6-13-1 6 0 10 1 13 1-3 3-5 5-6-1 3-2 6-2 8z']],
  tub: [[C.blue, 'M2 11h20l-2 8H4z'], ['none', 'M5 21l1-2M19 21l-1-2'], [C.white, 'M7 9a1.5 1.5 0 1 0 0.1 0M12 7a2 2 0 1 0 0.1 0M17 9a1.5 1.5 0 1 0 0.1 0']],
  sky: [[C.sky, 'M12 2v5M6 7h12'], ['none', 'M6 7v4M18 7v4M12 7v9'], [C.red, 'M4 14a2 2 0 1 0 4 0 2 2 0 1 0-4 0'], [C.sun, 'M16 14a2 2 0 1 0 4 0 2 2 0 1 0-4 0'], [C.leaf, 'M10 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0']],
  book: [[C.plum, 'M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z'], ['none', 'M12 6v14']],
  shake: [[C.pink, 'M9 3a5 5 0 1 0 0 10 5 5 0 1 0 0-10z'], ['none', 'M12 12l8 8M4 2l-2 2M15 1l1 2M2 13l2-1']],
  words: [[C.sun, 'M3 5h18v14H3z'], ['none', 'M6 9h5M13 9h5M6 13h3M11 13h7M6 16h8']],
  dice: [[C.white, 'M4 4h16v16H4z'], [C.ink, 'M8 7a1 1 0 1 0 0.1 0M16 7a1 1 0 1 0 0.1 0M12 11a1 1 0 1 0 0.1 0M8 16a1 1 0 1 0 0.1 0M16 16a1 1 0 1 0 0.1 0']],
  gift: [[C.red, 'M3 10h18v11H3z'], [C.sun, 'M2 7h20v4H2zM11 7h2v14h-2z'], ['none', 'M12 7C10 2 5 3 7 6M12 7c2-5 7-4 5-1']],
  lock: [[C.sun, 'M5 11h14v10H5z'], ['none', 'M8 11V7a4 4 0 0 1 8 0v4M12 15v2']],
  eye: [[C.white, 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z'], [C.blue, 'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z']],
  sound: [[C.sun, 'M4 9h4l5-4v14l-5-4H4z'], ['none', 'M16 8c2 2 2 6 0 8M19 5c4 4 4 10 0 14']],
  mute: [[C.white, 'M4 9h4l5-4v14l-5-4H4z'], ['none', 'M16 9l5 6M21 9l-5 6']],
  close: [[C.white, 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z'], ['none', 'M8.5 8.5l7 7M15.5 8.5l-7 7']],
  back: [[C.white, 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z'], ['none', 'M14 7l-5 5 5 5']],
  go: [[C.leaf, 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z'], ['none', 'M10 7l5 5-5 5']],
  plus: [[C.leaf, 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z'], ['none', 'M12 7v10M7 12h10']],
  minus: [[C.peach, 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z'], ['none', 'M7 12h10']],
  check: [[C.leaf, 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z'], ['none', 'M7.5 12.5l3 3 6-7']],
  no: [[C.red, 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z'], ['none', 'M8.5 8.5l7 7M15.5 8.5l-7 7']],
  oops: [[C.sun, 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z'], ['none', 'M8 15c2-2 6-2 8 0M9 9.5v.5M15 9.5v.5']],
  slow: [[C.leaf, 'M3 17c0-5 4-8 8-8s8 3 8 6v2z'], ['none', 'M19 15c1 0 2-1 2-3M7 17v2M15 17v2'], [C.sun, 'M8 12a3 3 0 0 1 6 0z']],
  far: [[C.sky, 'M3 12h12'], ['none', 'M3 12h4M10 12h3M16 8l5 4-5 4']],
  gone: [[C.white, 'M5 8a3 3 0 0 1 5-2 4 4 0 0 1 7 1 3 3 0 0 1 1 6H6a3 3 0 0 1-1-5z'], ['none', 'M8 17l-1 3M12 17v4M16 17l1 3']],
  empty: [[C.cream, 'M4 8h16l-2 12H6z'], ['none', 'M3 8h18']],
  full: [[C.peach, 'M4 8h16l-2 12H6z'], [C.red, 'M7 8a5 5 0 0 1 10 0z']],
  away: [[C.sky, 'M3 12h12'], ['none', 'M3 12h4M10 12h3M16 8l5 4-5 4']],
  sparkle: [[C.sun, 'M12 2l2 7 7 3-7 3-2 7-2-7-7-3 7-3z']],
  /* do */
  make: [[C.red, 'M4 14h7v7H4z'], [C.blue, 'M13 14h7v7h-7z'], [C.sun, 'M8.5 6h7v7h-7z']],
  dig: [[C.sun, 'M14 3l7 7-3 3-7-7z'], ['none', 'M12 9l-8 8 3 3 8-8']],
  pop: [[C.sun, 'M12 2l2 6 6-2-3 5 5 3-6 1 1 6-5-4-5 4 1-6-6-1 5-3-3-5 6 2z']],
  bonk: [[C.red, 'M11 5l8 8 2-2-8-8z'], ['none', 'M4 20l9-9M9 7l8 8']],
  roll: [[C.blue, 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z'], [C.sun, 'M12 3v18M3 12h18']],
  home: [[C.sun, 'M3 11l9-8 9 8v10H3z'], [C.red, 'M9 21v-6h6v6z']],
  grab: [[C.peach, 'M6 12V6a1.5 1.5 0 0 1 3 0v5V4a1.5 1.5 0 0 1 3 0v7V5a1.5 1.5 0 0 1 3 0v7V8a1.5 1.5 0 0 1 3 0v6c0 4-3 7-7 7s-6-2-8-5l-2-3a1.5 1.5 0 0 1 3-1z']],
  hide: [[C.plum, 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z'], ['none', 'M4 4l16 16']],
  peek: [[C.white, 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z'], [C.plum, 'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z']],
  nap: [[C.blue, 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z'], ['none', 'M15 3h4l-4 4h4']],
  wake: [[C.sun, 'M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10z'], ['none', 'M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2']],
  hug: [[C.pink, 'M12 21C5 16 2 12 2 8a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 4-3 8-10 13z'], ['none', 'M6 11c2 3 4 4 6 4s4-1 6-4']],
  free: [[C.white, 'M12 21C5 16 2 12 2 8a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 4-3 8-10 13z'], ['none', 'M12 6l-2 5 3 2-2 5']],
  hop: [[C.leaf, 'M12 3l6 7h-4v6h-4v-6H6z'], ['none', 'M5 21h14']],
  feed: [[C.peach, 'M4 12h16a8 8 0 0 1-16 0z'], [C.sun, 'M9 9l1.2-2.5L13 6l-2 2 .5 2.8L9 9.6 6.5 11 7 8.2 5 6l2.8.5z']],
  toss: [[C.leaf, 'M5 7h14l-1.5 14h-11z'], ['none', 'M3 7h18M9 4h6M10 11v6M14 11v6']],
  find: [[C.sky, 'M10 3a7 7 0 1 0 0 14 7 7 0 1 0 0-14z'], ['none', 'M15 15l6 6'], [C.leaf, 'M6 11c0-2 2-3 4-3s4 1 4 3-2 2-4 2-4 0-4-2z']],
  take: [[C.sun, 'M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z'], ['none', 'M12 22v-6M9 19l3 3 3-3']],
  fill: [[C.white, 'M6 2h12v20H6z'], [C.sun, 'M12 10l1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.4-2.5 1.4.5-2.8-2-2 2.8-.4z']],
  /* toys */
  bear: [[C.brown, 'M4.5 6.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0M14.5 6.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0M5 13a7 7 0 1 0 14 0 7 7 0 1 0-14 0'], [C.cream, 'M10 15a2 1.5 0 1 0 4 0 2 1.5 0 1 0-4 0'], [C.ink, 'M9 11.5a.8.8 0 1 0 0.1 0M15 11.5a.8.8 0 1 0 0.1 0']],
  rocket: [[C.white, 'M12 2c4 3 5 8 3 14H9C7 10 8 5 12 2z'], [C.red, 'M9 15l-4 5h5zM15 15l4 5h-5z'], [C.sky, 'M12 7a2 2 0 1 0 0 4 2 2 0 1 0 0-4z']],
  zoom: [[C.sun, 'M3 14c2-5 8-7 15-6l3 3-3 3c-7 1-13 2-15 0z'], [C.red, 'M3 14l-1 4 5-2z'], [C.sky, 'M13 10a2 2 0 1 0 0.1 0']],
  saucer: [[C.plum, 'M2 14c0-2 4.5-4 10-4s10 2 10 4-4.5 3-10 3-10-1-10-3z'], [C.sky, 'M8 10a4 4 0 0 1 8 0z'], [C.sun, 'M6 14a1 1 0 1 0 0.1 0M12 15a1 1 0 1 0 0.1 0M18 14a1 1 0 1 0 0.1 0']],
  plane: [[C.red, 'M2 13l9-2 2-8h2l1 8 6 2v2l-6-1-1 5 2 2h-6l2-2-1-5-10 1z']],
  kite: [[C.peach, 'M12 2l7 8-7 10-7-10z'], [C.sun, 'M12 2l7 8h-7zM12 20l-7-10h7z'], ['none', 'M12 20c0 2 2 2 3 1']],
  copter: [[C.blue, 'M6 12a6 5 0 1 0 12 0 6 5 0 1 0-12 0'], ['none', 'M3 5h18M12 5v2M18 12h4M8 20h8M9 17v3M15 17v3'], [C.sky, 'M9 11a3 2 0 0 1 6 0z']],
  choo: [[C.red, 'M3 8h9v9H3z'], [C.blue, 'M12 11h8v6h-8z'], [C.ink, 'M6 4h3v4H6z'], [C.sun, 'M4 19a2 2 0 1 0 4 0 2 2 0 1 0-4 0M14 19a2 2 0 1 0 4 0 2 2 0 1 0-4 0']],
  truck: [[C.sun, 'M2 7h12v9H2z'], [C.red, 'M14 10h5l3 3v3h-8z'], [C.ink, 'M4 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0']],
  squirt: [[C.leaf, 'M5 13h9v8H5z'], [C.peach, 'M14 15l5-6 1 1-4 7z'], [C.sky, 'M17 5a1 1 0 1 0 0.1 0M21 3a1 1 0 1 0 0.1 0']],
  duck: [[C.sun, 'M3 14c0 4 4 6 9 6s8-2 8-6c0-2-3-2-5-1 2-2 2-7-3-7-4 0-4 4-3 6-2-1-6-1-6 2z'], [C.peach, 'M9 8h-4l3 2z'], [C.ink, 'M11 8a.8.8 0 1 0 0.1 0']],
  boat: [[C.red, 'M2 15h20l-3 5H5z'], [C.sun, 'M12 4l6 9h-6z'], ['none', 'M12 3v12']],
  fish: [[C.peach, 'M3 12c3-5 10-6 14 0-4 6-11 5-14 0z'], [C.sun, 'M17 12l4-4v8z'], [C.ink, 'M8 11a.8.8 0 1 0 0.1 0']],
  digger: [[C.sun, 'M2 13h11v5H2z'], [C.ink, 'M2 18h11v2H2z'], [C.peach, 'M11 12l5-7 5 4-3 1z']],
  popper: [[C.sky, 'M5 11a7 6 0 0 1 14 0v2a7 6 0 0 1-14 0z'], [C.red, 'M9 11a1.5 1.5 0 1 0 0.1 0'], [C.sun, 'M13 9a1.5 1.5 0 1 0 0.1 0'], [C.leaf, 'M14 13a1.5 1.5 0 1 0 0.1 0'], ['none', 'M12 4V1M3 21l3-4M21 21l-3-4']],
  bubble: [[C.sky, 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z'], [C.white, 'M8 8a3 3 0 0 1 3-3v1.5A1.5 1.5 0 0 0 9.5 8z']],
  rattle: [[C.pink, 'M9 3a5 5 0 1 0 0 10 5 5 0 1 0 0-10z'], [C.sun, 'M12 12l2-2 8 8-2 2z']],
  piggy: [[C.pink, 'M4 12c0-4 4-6 8-6s8 2 8 6-3 6-8 6-8-2-8-6z'], ['none', 'M20 11h2M10 6l1-3M7 18v3M16 18v3M10 9h4'], [C.ink, 'M8 11a.8.8 0 1 0 0.1 0']],
  popgun: [[C.blue, 'M3 12h12v5H3z'], [C.red, 'M15 13h5v3h-5z'], [C.sun, 'M5 19a2 2 0 1 0 4 0 2 2 0 1 0-4 0']],
  pinwheel: [[C.red, 'M12 12V3a5 5 0 0 1 5 5z'], [C.blue, 'M12 12h9a5 5 0 0 1-5 5z'], [C.sun, 'M12 12v9a5 5 0 0 1-5-5z'], [C.leaf, 'M12 12H3a5 5 0 0 1 5-5z']],
  windmill: [[C.plum, 'M9 22l1.5-10h3L15 22z'], ['none', 'M12 10L6 4M12 10l6-6M12 10l-6 6M12 10l6 6']],
  sun: [[C.sun, 'M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10z'], ['none', 'M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2']],
};

const NS = 'http://www.w3.org/2000/svg';
export function icon(name: string, size = 24, label?: string): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.classList.add('ic');
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); } else svg.setAttribute('aria-hidden', 'true');
  for (const [fill, d] of I[name] || I.oops) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', fill === 'none' ? 'none' : fill);
    p.setAttribute('stroke', C.ink); p.setAttribute('stroke-width', '1.5');
    p.setAttribute('stroke-linejoin', 'round'); p.setAttribute('stroke-linecap', 'round');
    svg.append(p);
  }
  return svg;
}
export const hasIcon = (n: string) => n in I;
/** An icon as an SVG string (for canvas textures in the 3D world). */
export function iconSvg(name: string, size = 128): string {
  const paths = (I[name] || I.oops).map(([fill, d]) => `<path d="${d}" fill="${fill}" stroke="${C.ink}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  return `<svg xmlns="${NS}" width="${size}" height="${size}" viewBox="0 0 24 24">${paths}</svg>`;
}
