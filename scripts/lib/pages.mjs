/* Build the site and serve it the way GitHub Pages does: files under the base path, 404.html for
 * unknown paths, and nothing outside the base (every request that tries is remembered). Shared by
 * the smoke test and the browser bench. */
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function siteOf(site = 'https://pippop.pet') {
  const SITE = site.replace(/\/+$/, '');
  const BASE = new URL(SITE + '/').pathname.replace(/\/?$/, '/');
  const OUT = join(ROOT, '.smoke', BASE === '/' ? 'root' : BASE.replace(/\W+/g, '_'));
  return { SITE, BASE, OUT };
}

/** Build into OUT unless reuse is asked for and a build is there. */
export function build({ SITE, BASE, OUT }, { reuse = false } = {}) {
  if (reuse && existsSync(join(OUT, 'index.html'))) return;
  console.log(`building for ${SITE} (base ${BASE}) into ${OUT}`);
  const r = spawnSync('npx', ['vite', 'build', '--outDir', OUT, '--emptyOutDir'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, VITE_SITE_URL: SITE } });
  if (r.status !== 0) process.exit(r.status || 1);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml', '.wasm': 'application/wasm' };

/** Serve OUT under BASE on a free local port; resolves to { origin, outside, close }. */
export async function serve({ BASE, OUT }) {
  const outside = [];
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!path.startsWith(BASE)) {
      if (path !== '/favicon.ico') outside.push(path);
      res.writeHead(404); res.end('outside the base path'); return;
    }
    let rel = path.slice(BASE.length) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const abs = resolve(OUT, rel);
    let file = abs.startsWith(OUT + sep) && existsSync(abs) && (await stat(abs)).isFile() ? abs : null;
    const code = file ? 200 : 404;
    if (!file) file = join(OUT, '404.html');
    res.writeHead(code, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { origin: `http://127.0.0.1:${server.address().port}`, outside, close: () => server.close() };
}
