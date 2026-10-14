/* Renders Pip Pop's share card and app icons from the game itself, with headless Chrome.
 *   GAME_URL=http://localhost:5198/ LAB_GPU=1 node scripts/brand.mjs
 * Writes public/og.png (1200×630 link preview), favicon-32.png, apple-touch-icon.png, icon-192.png,
 * icon-512.png and icon-maskable-512.png. Needs a running game (pnpm dev) for the 3D carousel shot. */
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChrome, sleep } from '../playtest/lib/cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = join(HERE, '..', 'public');
const GAME = process.env.GAME_URL || 'http://localhost:5197/';

const b = await launchChrome({ width: 1200, height: 630 });
try {
  // 1. the hero: every toy on the shelf, unlocked, with the page's own UI hidden
  const g = await b.newPage({ width: 1150, height: 760 });
  await g.goto(GAME + '#/toys');
  await sleep(5000);
  await g.eval(`(async () => {
    const s = document.createElement('style'); s.textContent = '#app, #boot, #bubbles { display: none !important }'; document.head.append(s);
    const { world } = await import('/src/world/world.ts');
    world.current.set([14, 15, 20, 21, 22, 18, 16, 17, 19, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((type) => ({ type, can: true })));
    return true;
  })()`);
  await sleep(4000);
  await g.screenshot(join(HERE, 'brand', 'shot.png'));
  await g.close();

  // 2. the share card
  const c = await b.newPage({ width: 1200, height: 630 });
  await c.goto(pathToFileURL(join(HERE, 'brand', 'card.html')).href);
  await c.eval('document.fonts.ready.then(() => true)');
  await sleep(800);
  await c.screenshot(join(PUB, 'og.png'));
  await c.close();

  // 3. icons, transparent where the platform allows it, solid where it doesn't
  const icon = pathToFileURL(join(HERE, 'brand', 'icon.html')).href;
  for (const [file, size, mask] of [['favicon-32.png', 32], ['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180, true], ['icon-maskable-512.png', 512, true]]) {
    const p = await b.newPage({ width: size, height: size });
    await p.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    await p.goto(icon + (mask ? '#mask' : ''));
    await sleep(300);
    await p.screenshot(join(PUB, file));
    await p.close();
  }
  console.log('wrote public/og.png and the icons');
} finally { await b.close(); }
