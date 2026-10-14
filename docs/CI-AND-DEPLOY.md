# CI and deploy: GitHub Actions → GitHub Pages

How pippop.pet is checked and shipped. Two workflows in `.github/workflows/`, no secrets, no server of our own: the site is static files on GitHub Pages, and the page talks to the chain and the guilds directly.

| Workflow | File | Runs on | Does |
|---|---|---|---|
| **CI** | `ci.yml` | every PR, push to `main`, by hand | Typecheck, two builds, then the smoke test |
| **Deploy to GitHub Pages** | `pages.yml` | push to `main`, by hand | Build with repository variables, publish `dist/` to Pages |

They run independently: **the deploy doesn't wait for CI**. A failing smoke job doesn't block a release, because the smoke test depends on the public testnet being up. A build that doesn't typecheck can't deploy, because `pnpm build` typechecks first.

```
push to main ──┬─► CI ── check (typecheck, root build, project-path build) ──► smoke (every room, headless Chrome vs. live testnet)
               │
               └─► Pages ── build (typecheck + vite build) ──► deploy-pages
```

---

## 1. Toolchain (the same in every job)

```yaml
- uses: actions/checkout@v7
- uses: pnpm/action-setup@v6        # version from package.json "packageManager" (pnpm@9.15.9)
- uses: actions/setup-node@v7
  with: { node-version: 24, cache: pnpm }
- run: pnpm install --frozen-lockfile
```

Runtime dependencies are `three` and the noble/scure crypto libraries. Everything runs on `ubuntu-latest`, with no Docker in CI.

## 2. What `pnpm build` is

```
tsc --noEmit  &&  vite build
```

1. **Typecheck** the app.
2. **Vite build** into `dist/`. three.js goes into its own long-cached chunk; assets are hashed under `dist/assets/`. `public/` is copied in: the share card (`og.png`), icons, `manifest.webmanifest`, `robots.txt`, `sitemap.xml` and `llms.txt`.
3. The `pippop-site` plugin in `vite.config.ts`:
   - points every absolute address at this build's site: canonical, Open Graph, Twitter, JSON-LD, robots, sitemap, `llms.txt`;
   - dates the sitemap;
   - writes **`404.html`**, a copy of the app shell. Pages has no rewrites, so any unknown path gets `404.html`, and the game routes itself (its rooms live in the hash, `#/sky`).

### Site address and base path

| Variable | Default | Purpose |
|---|---|---|
| `VITE_SITE_URL` | `https://pippop.pet` locally; the Pages address on Pages | Canonical URL, Open Graph, sitemap, and the **base path** (its URL path) |
| `VITE_BASE` | from `VITE_SITE_URL` | Overrides the base path on its own |

`https://pippop.pet` builds for `/`; `https://owner.github.io/pippop` builds for `/pippop/`. CI builds both.

### Other build-time settings (`VITE_*`)

These are baked into the bundle; changing one means rebuilding. Empty counts as unset.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_LCD_URL` | `https://public.testnet.structs.network` | Chain REST |
| `VITE_RPC_WS_URL` | `wss://public.testnet.structs.network:26657/websocket` | Live blocks |
| `VITE_DEFAULT_GUILD` | `0-5` | The club suggested first at sign-up |
| `VITE_RELAY_URL` | unset: direct in a build, the dev server's relay under `vite` | `off`, `/`, or a standalone relay's URL (see `src/guild/relay.ts`) |

---

## 3. CI workflow (`ci.yml`)

```yaml
on: { push: { branches: [main] }, pull_request: {}, workflow_dispatch: {} }
permissions: { contents: read }
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
```

### `check` (20 min)

| Step | What |
|---|---|
| `pnpm typecheck` | `tsc` over `src/` |
| `pnpm build` | Root build (pippop.pet) |
| Build under a project path | `VITE_SITE_URL=https://example.github.io/pippop pnpm build`, then asserts `dist/404.html`, a base-prefixed manifest link and the sitemap address in `robots.txt` |

### `smoke` (40 min, after `check`)

```yaml
- run: sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0   # Chrome's sandbox on Ubuntu 24.04
- run: pnpm smoke                                                      # SMOKE_SHOTS=smoke-shots/root
- run: pnpm smoke                                                      # SMOKE_QUICK=1, SMOKE_SITE=https://example.github.io/pippop
- uses: actions/upload-artifact@v7                                     # if: failure() → smoke-shots, 7 days
```

`scripts/smoke.mjs` builds into `.smoke/`, serves it the way Pages does (files under the base path, `404.html` for unknown paths), and opens every room in headless Chrome at desktop and phone sizes: Hi, Mat, Toys, a toy's card, Sky, Bonk, Fridge, Book, and two bad links. A room fails on:

- an uncaught exception or `console.error` (third parties refusing a visitor's browser are allowed: guild servers without CORS, the testnet's mempool lookups);
- a room that never mounts;
- sideways scroll;
- a blank 3D view;
- under a project path, **any request outside the base path** (a hard-coded root path).

It depends on the public testnet, so it can go red when the testnet is down. Without Chrome it skips, and with `CI` set a skip counts as a failure. Screenshots of a failed run are under **Artifacts → smoke-shots**.

---

## 4. Deploy workflow (`pages.yml`)

```yaml
on: { push: { branches: [main] }, workflow_dispatch: {} }
permissions: { contents: read, pages: write, id-token: write }   # id-token: OIDC for deploy-pages
concurrency: { group: pages, cancel-in-progress: false }         # queue, never cancel a publish mid-way
```

**`build`:** install, `actions/configure-pages@v6` (reads the Pages address: the custom domain, or `https://<owner>.github.io/<repo>`), `pnpm build` with `VITE_SITE_URL: ${{ vars.VITE_SITE_URL || steps.pages.outputs.base_url }}` and the other `VITE_*` variables, then `actions/upload-pages-artifact@v5` with `path: dist`.

**`deploy`:** `actions/deploy-pages@v5` into the `github-pages` environment. The run page links to the live URL.

### One-time repository setup

1. **Settings → Pages → Build and deployment → Source: GitHub Actions** (not "Deploy from a branch").
2. **Custom domain: `pippop.pet`.** Settings → Pages → Custom domain. Add the DNS records GitHub shows for an apex domain (A and AAAA records to GitHub Pages; optionally a `www` CNAME to `abstrct.github.io`), then tick **Enforce HTTPS** once the certificate is issued. With Actions deploys the domain lives in the Pages settings; no `CNAME` file is used.
3. Optional variables: **Settings → Secrets and variables → Actions → Variables**, for any `VITE_*` above. Set `VITE_SITE_URL=https://pippop.pet` to pin the address even before the custom domain is live.
4. No secrets are needed. The deploy authenticates with the workflow's OIDC token.

A fork without a custom domain deploys to `https://<owner>.github.io/<repo>/`. The base path follows on its own, and CI has already proven that layout works.

---

## 5. The other way to ship: the container

```bash
docker build -t pippop --build-arg VITE_SITE_URL=https://pippop.pet .
docker run --rm -p 8080:8080 pippop
```

A two-stage `Dockerfile`: `node:24-slim` runs `pnpm build`, then `node:24-alpine` runs `serve.mjs` as user `node`. It serves `dist/` with brotli/gzip and cache headers, answers `GET /healthz` (the image's `HEALTHCHECK`), and only serves files. Locally: `pnpm build && pnpm start` on `http://localhost:8080`. CI doesn't build or push the image.

---

## 6. What isn't in CI

| Thing | Where it runs | Why |
|---|---|---|
| Share card and icons (`public/og.png`, `public/icon-*.png`) | Locally: `LAB_GPU=1 pnpm brand` (needs `pnpm dev` running); results are committed | A real GPU makes the good-looking shot |
| Playtests (`playtest/`) | Locally: the lab and its playtesters | Needs the private devnet, and judgment |
| Devnet end-to-end (`devnet/`) | Locally | Needs a `structsd` binary and a private chain |

## 7. Reproducing CI on your machine

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm build
VITE_SITE_URL=https://example.github.io/pippop pnpm build     # project-path build
pnpm smoke                                                   # needs Chrome and the testnet
SMOKE_QUICK=1 SMOKE_SITE=https://example.github.io/pippop pnpm smoke
```
