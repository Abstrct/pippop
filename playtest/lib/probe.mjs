/* What the lab reads inside a tester's page. Each export is page-side JavaScript, evaluated over the
 * DevTools protocol. Modules are imported by their dev-server path, which is the same module instance
 * the game itself runs. Nothing here changes the game. */

/** Runs before every document: quiet hashing (2 threads, CPU), and the lab's frame, long-task and
 * error counters. */
export const INSTRUMENT = String.raw`
try { if (location.origin !== 'null') localStorage.setItem('pippop.chant', JSON.stringify({ enabled: true, threads: 2, startAt: 9, autoSubmit: true, engine: 'cpu' })); } catch {}
window.__lab = { frames: 0, longTasks: 0, longMs: 0, errors: [], t0: performance.now(), mark: { frames: 0, at: performance.now() } };
(function tick() { window.__lab.frames++; requestAnimationFrame(tick); })();
try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lab.longTasks++; window.__lab.longMs += e.duration; } }).observe({ type: 'longtask', buffered: true }); } catch {}
addEventListener('error', (e) => window.__lab.errors.push(String(e.message || e)));
addEventListener('unhandledrejection', (e) => window.__lab.errors.push('rejection: ' + String((e.reason && e.reason.message) || e.reason)));
`;

/** Frames per second since the last call. */
export const FPS = String.raw`(() => { const L = window.__lab; if (!L) return null; const now = performance.now(); const f = L.frames - L.mark.frames, s = (now - L.mark.at) / 1000; L.mark = { frames: L.frames, at: now }; return s > 0.2 ? Math.round(f / s) : null; })()`;

/** Everything a player can see and touch, by name. */
export const LOOK = String.raw`(async () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false; return r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const name = (el) => clean(el.getAttribute('aria-label') || el.innerText || el.value || el.title || el.getAttribute('placeholder'));
  const region = (el) => { const r = el.closest('.top,.dock,.signs,#bubbles,.veil,.hello,.war,.busy,.fab,.panel,.card,.book'); if (!r) return 'page'; return r.classList.contains('top') ? 'top' : r.classList.contains('dock') ? 'dock' : r.classList.contains('signs') ? 'signs' : r.id === 'bubbles' ? 'bubbles' : r.classList.contains('veil') ? 'dialog' : r.classList.contains('hello') ? 'hello' : r.classList.contains('war') ? 'steps' : r.classList.contains('busy') ? 'busy' : r.classList.contains('fab') ? 'make-button' : r.classList.contains('book') ? 'book' : clean(r.getAttribute('aria-label')) || 'card'; };
  const controls = [...document.querySelectorAll('button, a[href], input, textarea, select, [role=button], [role=checkbox], [role=radio], [role=option]')].filter(vis).map((el) => {
    const r = el.getBoundingClientRect();
    return { name: name(el) || '(no name: ' + el.tagName.toLowerCase() + ')', kind: el.getAttribute('role') || el.tagName.toLowerCase(), region: region(el), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height), disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true' || undefined, on: el.getAttribute('aria-pressed') || el.getAttribute('aria-checked') || el.getAttribute('aria-current') || undefined, value: el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el.value : undefined };
  });
  const read = (sel) => [...document.querySelectorAll(sel)].filter(vis).map((el) => {
    const imgs = [...el.querySelectorAll('[role=img]')].map((x) => clean(x.getAttribute('aria-label'))).filter(Boolean);
    return clean(el.innerText) + (imgs.length ? '  [' + imgs.join(' | ') + ']' : '');
  }).filter(Boolean);
  const out = {
    route: location.hash || '#/', title: document.title,
    counters: [...document.querySelectorAll('.top .meter')].filter((m) => vis(m) && m.getAttribute('aria-label') !== 'Sound').map((m) => clean(m.getAttribute('aria-label') || m.innerText)),
    signs: read('.signs .sign'), bubbles: read('#bubbles .bub'), steps: read('.war'), dialogs: read('.veil section'), cards: read('section.card:not(.veil section)'),
    shout: read('.shout'), busy: [...document.querySelectorAll('.busy .chip')].filter(vis).map((c) => clean(c.getAttribute('aria-label'))),
    controls, things: [],
  };
  try {
    const W = (await import('/src/world/world.ts')).world;
    const E = (await import('/src/game/empire.ts')).empire;
    const L = await import('/src/lore.ts');
    const st = W.current;
    if (st) {
      st.group.updateMatrixWorld(true);
      const seen = new Set();
      st.group.traverse((o) => {
        const id = o.userData && o.userData.pick;
        if (id == null || id === '' || seen.has(String(id))) return;
        seen.add(String(id));
        const v = o.getWorldPosition(o.position.clone()); v.y += 0.5;
        const p = W.toScreen(v);
        if (p.behind || p.x < 0 || p.y < 0 || p.x > innerWidth || p.y > innerHeight) return;
        let label = String(id), owner;
        for (const pl of E.players.values()) { const s = pl.structs.get(String(id)); if (s) { label = L.toy(s.typeId).word; owner = E.commands(pl.playerId) ? 'mine' : 'theirs'; break; } }
        if (/^\d+$/.test(String(id)) && L.TOYS[Number(id)]) label = L.TOYS[Number(id)].word;
        out.things.push({ id: String(id), label, owner, x: Math.round(p.x), y: Math.round(p.y) });
      });
    }
  } catch (e) { out.thingsError = String(e.message || e); }
  return out;
})()`;

/** The kid as the game knows them, in game words with the ledger ids alongside (for the report). */
export const STATE = String.raw`(async () => {
  const E = (await import('/src/game/empire.ts')).empire;
  const Q = (await import('/src/wallet/queue.ts')).txq;
  const P = (await import('/src/pow/pow.ts')).pow;
  const Wl = (await import('/src/wallet/wallet.ts')).wallet;
  const live = (await import('/src/chain/live.ts')).live;
  const L = await import('/src/lore.ts');
  const p = E.commander;
  const lv = { space: 'Moon', air: 'Sky', land: 'Grass', water: 'Tub' };
  const kid = p ? {
    id: p.playerId, name: L.kidName(p), club: p.guildId, mat: p.planetId || null, stars: L.fmtStars(p.alpha), rocks: p.ore, groundRocks: Number(p.planet?.gridAttributes?.ore || 0),
    juiceSpare: L.fmtJuice(p.capacity + p.connectionCapacity - p.load - p.structsLoad), juiceAll: L.fmtJuice(p.capacity + p.connectionCapacity), wind: E.charge(p), online: p.online,
    wagon: p.fleet ? (p.fleet.status === 'away' ? 'away at ' + p.fleet.locationId : 'home') : 'none', fort: Number(p.planet?.planetAttributes?.planetaryShield || 0),
    toys: [...p.structs.values()].filter((s) => !s.destroyed).map((s) => ({ id: s.id, toy: L.toy(s.typeId).word, level: lv[s.ambit] || s.ambit, made: s.built, awake: s.online, hidden: s.hidden || undefined, hearts: s.health + '/' + (s.type?.maxHealth ?? '?') })),
  } : null;
  const jobs = Q.jobs.slice(-12).map((j) => ({ verb: L.verbOf(j.msgs[0]?.typeUrl || '').w, msg: (j.msgs[0]?.typeUrl || '').split('.').pop(), status: j.status, word: j.status === 'failed' ? L.oops(j.error).w : undefined, error: j.status === 'failed' ? String(j.error || '').slice(0, 160) : undefined, wait: j.waitReason, height: j.height, ago: Math.round((Date.now() - j.updatedAt) / 1000) + 's' }));
  const shakes = P.active.map((t) => ({ kind: t.kind, best: t.best?.zeros ?? 0, need: P.required(t), status: t.status, waits: t.waits }));
  return { height: live.height, link: live.state, key: Wl.state, wordsKept: Wl.backedUp, kid, jobs, shakes, labErrors: (window.__lab?.errors || []).slice(-10), longTasks: window.__lab?.longTasks, longMs: Math.round(window.__lab?.longMs || 0) };
})()`;

/** Find the control a tester named. Exact name first, then a name that starts with it, then one that
 * contains it; `nth` picks among several; `region` narrows (top, dock, signs, card, dialog…). */
export const FIND = (want, nth = 0, region = '') => String.raw`(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const name = (el) => clean(el.getAttribute('aria-label') || el.innerText || el.value || el.title || el.getAttribute('placeholder'));
  const want = ${JSON.stringify(String(want).toLowerCase().trim())}, reg = ${JSON.stringify(region.toLowerCase())};
  let all = [...document.querySelectorAll('button, a[href], input, textarea, select, [role=button], [role=checkbox], [role=radio], [role=option]')].filter(vis);
  if (reg) all = all.filter((el) => { const r = el.closest('.top,.dock,.signs,.veil,.hello,.war,.panel,.card,.fab,.book,#bubbles'); const tag = r ? (r.className + ' ' + (r.id || '') + ' ' + (r.getAttribute('aria-label') || '')).toLowerCase() : 'page'; return tag.includes(reg); });
  // a dialog on top takes the touch: prefer its controls
  const top = [...document.querySelectorAll('.veil')].pop();
  if (top) { const inTop = all.filter((el) => top.contains(el)); if (inTop.length) all = inTop; }
  const pick = (f) => all.filter((el) => f(name(el)));
  const list = [pick((n) => n === want), pick((n) => n.startsWith(want)), pick((n) => n.includes(want))].find((l) => l.length) || [];
  const el = list[${Number(nth) || 0}];
  if (!el) return { found: false, candidates: all.map(name).filter(Boolean).slice(0, 40) };
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  return { found: true, name: name(el), x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: !!el.disabled, matches: list.length };
})()`;
