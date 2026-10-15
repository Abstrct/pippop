import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
// @ts-expect-error — plain ESM module, no types
import { relayPlugin } from './relay/relay.mjs';

/* In dev the relay (borrowed from the ledger client) proxies guild signup and the guild directory,
 * which send no CORS headers. A build talks to the guild servers directly unless it was built with
 * VITE_RELAY_URL (src/guild/relay.ts). Nothing else here talks to anything but the chain. */
const headers = { 'x-frame-options': 'DENY', 'content-security-policy': "frame-ancestors 'none'" };

/* Where the site lives. VITE_SITE_URL sets the whole address (canonical, Open Graph, sitemap) and,
 * through its path, the base the build is served under: https://pippop.pet → "/",
 * https://owner.github.io/pippop → "/pippop/". VITE_BASE overrides the base on its own. Empty
 * counts as unset (CI passes unset repository variables as empty strings). */
const SITE = (process.env.VITE_SITE_URL || 'https://pippop.pet').replace(/\/+$/, '');
const BASE = process.env.VITE_BASE || (new URL(SITE + '/').pathname.replace(/\/?$/, '/'));
const HOME = 'https://pippop.pet';

/* Google Analytics: only in a build, only for pippop.pet itself (a fork's Pages site or a dev server
 * sends nothing) unless VITE_GA_ID names a measurement id; VITE_GA_ID=off turns it off. Each room is
 * counted as a page by the router (src/main.ts), since the rooms live in the address's hash. */
const GA_ID = process.env.VITE_GA_ID === 'off' ? '' : process.env.VITE_GA_ID || (new URL(SITE).hostname === new URL(HOME).hostname ? 'G-4F21XWVQV0' : '');
function analytics(): Plugin {
  return {
    name: 'pippop-analytics',
    apply: 'build',
    transformIndexHtml: () => (GA_ID ? [
      { tag: 'script', attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${GA_ID}` }, injectTo: 'head' },
      { tag: 'script', children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});`, injectTo: 'head' },
    ] : []),
  };
}

/** Points every absolute address at this build's site, dates the sitemap, and writes 404.html
 * (GitHub Pages serves it for any unknown path: it is the app shell, and the game routes itself). */
function site(): Plugin {
  let outDir = 'dist';
  const swap = (s: string) => s.split(HOME + '/').join(SITE + '/').split(HOME).join(SITE);
  return {
    name: 'pippop-site',
    configResolved(c) { outDir = c.build.outDir; },
    transformIndexHtml: { order: 'post', handler: (html) => swap(html) },
    closeBundle() {
      const dist = resolve(process.cwd(), outDir);   // outDir may be absolute (the smoke test builds into .smoke/)
      for (const f of ['robots.txt', 'sitemap.xml', 'llms.txt']) {
        const p = join(dist, f);
        if (!existsSync(p)) continue;
        let s = swap(readFileSync(p, 'utf8'));
        if (f === 'sitemap.xml') s = s.replace(/<lastmod>[^<]*<\/lastmod>/g, `<lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>`);
        writeFileSync(p, s);
      }
      if (existsSync(join(dist, 'index.html'))) copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [relayPlugin(), site(), analytics()],
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: { output: { codeSplitting: { groups: [{ name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ }] } } },
  },
  worker: { format: 'es' },
  server: { port: 5197, host: true, cors: false, headers },
  preview: { port: 5197, cors: false, headers },
});
