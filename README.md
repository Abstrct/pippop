# Pip Pop

*Dig. Pop. Bonk!*

A toy box that plays the real [Structs](https://structs.ai) network. Every kid you meet is a real player, and most of them see a starship game, not a teddy bear. Everything is drawn live in three.js with chunky plastic, primary colours and a music box. The page never shows a sentence, only symbols and single words.

```bash
pnpm install
pnpm dev            # http://localhost:5197  (public testnet)
pnpm build && pnpm start   # dist/ on :8080 via serve.mjs
```

Env (read at build time): `VITE_LCD_URL`, `VITE_RPC_WS_URL` (default: the public Structs testnet), `VITE_DEFAULT_GUILD`, `VITE_RELAY_URL`.

**A build is a plain static site and talks to everything directly**: the chain (LCD and RPC answer any origin), each guild's `guild.json`, sign-up, and the Guild API. `dist/` can go on any static host; `serve.mjs` is only a convenience.

**`pnpm dev` uses the relay** built into the Vite server (`relay/relay.mjs`) for guild traffic. `VITE_RELAY_URL` changes either default: `off` goes direct even in dev, `/` uses a relay on the page's own origin, and a URL uses a standalone relay (`node relay/relay.mjs`).

The Sky reads the Guild API when it can. Your own key signs `LOGIN_GUILD…` to your club's API, then the map is a handful of small reads (players, rocks, last moves, rosters). Directly, that needs the guild to answer CORS with this page's origin plus `Allow-Credentials`, and its session cookie to survive a cross-site request (`SameSite=None; Secure`). Through the relay, the relay holds the cookie. A guild that can't keep a session either way is remembered for the visit, and the Sky reads the chain instead, so nothing breaks.

**Shipping:** every push to `main` deploys to GitHub Pages (pippop.pet), and CI typechecks, builds twice and smoke-tests every room in headless Chrome. See [docs/CI-AND-DEPLOY.md](docs/CI-AND-DEPLOY.md).

## Sharing and search

The site lives at **https://pippop.pet**. `index.html` carries everything a link preview or search engine reads: title and description, a canonical URL, Open Graph and Twitter `summary_large_image` tags with a 1200×630 share card, `theme-color` (the red stripe on Discord embeds), icons and a web app manifest, `VideoGame` structured data (JSON-LD, pointing at Structs as what it is based on), and a crawlable description for visitors without JavaScript. `public/` adds `robots.txt` (everything allowed, for every crawler), `sitemap.xml` and `llms.txt` (the game explained for AI crawlers).

The share card and icons are rendered from the game itself:

```bash
pnpm dev &                              # the game, for the 3D shelf shot
LAB_GPU=1 node scripts/brand.mjs        # → public/og.png and the icons
```

Links to [Structs](https://playstructs.com) and its [technical documentation](https://structs.ai) sit at the foot of the Book and the Me box.

## Rooms

| Symbol | Room | What it does on the chain |
|---|---|---|
| gift | **Hi** `#/hi` | makes a key in this browser, shows the magic words, joins a club (guild signup), finds a mat (`MsgPlanetExplore`) |
| mat | **Mat** `#/` · `#/mat/<kid>` | your planet: tap a toy for Wake / Nap / Hide / Peek / Hug / Free / Feed / Toss, the Bear's Hop, Find a new mat |
| blocks | **Toys** `#/toys/<type>` | the shelf: every struct type as symbols; Make (`MsgStructBuildInitiate`) |
| mobile | **Sky** `#/sky` | every kid hanging from a crib mobile in their club's colour; Peek, Roll (`MsgFleetMove`) |
| mallet | **Bonk** `#/bonk/<kid>` | Roll › bonk their Bear › Grab. Odds from the chain's own combat rules; `MsgStructAttack` |
| fridge | **Fridge** `#/fridge` | every club's juice jar (reactor); Fill / Take (`MsgReactorInfuse` / `Defuse`) |
| book | **Book** `#/book` | the picture dictionary, with all 22 toys on a carousel |

Shakes (proofs of work for Make, Dig, Pop and Grab) run on Web Workers and WebGPU in the tab and submit themselves; the tray at the bottom left shows each one filling up.

## The words (for builders only; never shown in the game)

| Pip Pop | Structs |
|---|---|
| Kid · Club · Mat · Wagon | Player · Guild · Planet · Fleet |
| Go toy / Mat toy | Fleet struct / Planet struct |
| Star · Rock · Juice · Wind · Fort · Tick | Alpha Matter · Ore · Energy · Charge · Planetary shield · Block |
| Fridge · Cup · Fill · Take | Reactor · Substation · Reactor infuse · Reactor defuse |
| Moon · Sky · Grass · Tub | Space · Air · Land · Water |
| Make · Wake · Nap · Hide · Peek · Hug · Free · Hop · Bonk · Feed · Toss | Build · Activate · Deactivate · Stealth on · Stealth off · Defend · Clear defense · Move · Attack · Generator infuse · Trash |
| Dig · Pop · Find · Roll · Home · Grab · Shake | Mine · Refine · Explore · Fleet move · Return · Raid · Proof of work |
| Key · Magic words | Wallet key · Recovery phrase |
| Bear, Rocket, Zoom, Saucer, Plane, Kite, Copter, Choo, Truck, Squirt, Duck, Boat, Fish | Command Ship, Battleship, Starfighter, Frigate, Pursuit Fighter, Stealth Bomber, High Altitude Interceptor, Mobile Artillery, Tank, SAM Launcher, Cruiser, Destroyer, Submersible |
| Digger, Popper, Bubble, Rattle, Piggy, Popgun, Pinwheel, Windmill, Sun | Ore Extractor, Ore Refinery, Orbital Shield Generator, Jamming Satellite, Ore Bunker, Planetary Defense Cannon, Field Generator, Continental Power Plant, World Engine |
| Wiggle · Duck · Hide · Tough · Lob | Signal jamming · Defensive maneuver · Stealth · Armour · Indirect combat |

## Where the engine came from

The network layer is borrowed whole from Wyrmhold (`structs-fantasy`), which took it from the Command Deck (`structs-xyz`): `src/chain`, `src/wallet` (vault, signing, the queue, the proto schema), `src/pow`, `src/cache`, `src/guild`, `src/game/{empire,onboard,enlist,war}`, `src/data` and `relay/`. Only the labels in `src/game/actions.ts` were changed.

Everything else is new: the three.js world (`src/world/*`: 22 procedural toys, the stacking-pole mat, the crib mobile, the bonk rug, the fridge, the shelf, the gift box, the carousel), the words (`src/lore.ts`, where every refusal becomes one word), the symbols (`src/ui/icons.ts`), the synthesized sounds (`src/core/audio.ts`) and every room.

## Proven end to end on a private chain

`devnet/` runs a single-node chain at v0.21.0 on localhost with a mock guild, on its own ports (RPC 46657, LCD 41317, guild 41318):

```bash
STRUCTSD=/path/to/structsd-v0.21.0 bash devnet/setup.sh all
```

Then start the `pippop-devnet` entry in `.claude/launch.json` (port 5198). From Pip Pop's own UI, all of these landed and were read back from the chain: a new key and club signup (`MsgGuildMembershipJoinProxy` through the guild), finding a mat, making a Digger (build initiate, then the in-browser shake finishing it), the Bear hopping Moon → Grass, rolling the wagon to another kid, three bonks (the third poofed their Bear; damage and counter-blows matched the shown odds), the grab landing by itself (`MsgPlanetRaidComplete`, height 460, code 0), and filling a star into the club's fridge (juice cap 24K → 25K).

Keys never leave the tab: the key is sealed with a non-extractable device key in IndexedDB, exactly as in Wyrmhold and the Command Deck.
