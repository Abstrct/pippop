#!/usr/bin/env node
/* The playtester's hands and eyes. Talks to the lab (playtest/lab.mjs) and prints what changed on screen.
 *
 *   node playtest/pt.mjs <tester> start [desktop|wide|tablet|phone] [persona words…]
 *   node playtest/pt.mjs <tester> look                 everything on screen, by name, plus a screenshot
 *   node playtest/pt.mjs <tester> tap <name> [nth] [region]   tap a button/link/field by the name you see
 *   node playtest/pt.mjs <tester> tapthing <toy|id> [nth]     tap a toy in the 3D scene
 *   node playtest/pt.mjs <tester> tapxy <x> <y>        tap a point (read it off the screenshot)
 *   node playtest/pt.mjs <tester> spin [dx] | zoom in|out | key <Key> [times] | type <text> | fill <field> <text>
 *   node playtest/pt.mjs <tester> goto <#/route|reload> | wait <secs> | device <desktop|phone…>
 *   node playtest/pt.mjs <tester> state | chain        the game's view of your kid / the ledger's truth
 *   node playtest/pt.mjs <tester> note <text>          an observation, with a screenshot
 *   node playtest/pt.mjs <tester> verdict fun=4 clarity=3 magic=5 feel=4 "one-paragraph summary"
 *   node playtest/pt.mjs <tester> faucet [stars]       devnet test cheat (logged), up to 10 stars
 *   node playtest/pt.mjs <tester> end
 *   node playtest/pt.mjs - status
 *   --json prints the raw answer. */
const LAB = process.env.LAB_URL || 'http://127.0.0.1:7810';
const argv = process.argv.slice(2);
const json = argv.includes('--json');
const [tester, cmd, ...args] = argv.filter((a) => a !== '--json');
if (!tester || (!cmd && tester !== '-')) { console.log('usage: pt.mjs <tester> <command> [args]  (see the top of this file)'); process.exit(1); }

let out;
try {
  if (tester === '-' && (cmd || 'status') === 'status') out = await (await fetch(LAB + '/status')).json();
  else out = await (await fetch(LAB + '/cmd', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tester, cmd, args }) })).json();
} catch (e) { console.log(`The lab is not answering at ${LAB} (${e.message}). Start it: node playtest/lab.mjs`); process.exit(2); }
if (json) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

const lines = [];
const say = (k, v) => { if (v == null || (Array.isArray(v) && !v.length) || v === '') return; lines.push(`${k}: ${Array.isArray(v) ? v.join('  |  ') : v}`); };
if (out.error) say('ERROR', out.error);
if (out.tapped !== undefined) say('tapped', out.tapped === false ? `nothing (${out.why})` : out.tapped + (out.disabled ? ' (it was disabled)' : '') + (out.sameName ? ` (${out.sameName} with that name; use nth)` : ''));
if (out.filled !== undefined) say('filled', out.filled || out.why);
if (out.pressed) say('pressed', `${out.pressed} → focus on ${out.focus}`);
for (const k of ['noted', 'recorded', 'given', 'ended', 'why', 'note', 'already']) if (out[k] !== undefined && k !== 'why') say(k, typeof out[k] === 'object' ? JSON.stringify(out[k]) : out[k]);
if (out.screenshot) say('screenshot', out.screenshot);
if (out.route) say('screen', `${out.route}${out.fps != null ? `   (fps ${out.fps})` : ''}`);
say('counters', out.counters); say('steps', out.steps); say('signs', out.signs); say('bubbles', out.bubbles); say('BIG WORD', out.shout);
say('dialog', out.dialogs); say('cards', out.cards); say('busy', out.busy);
if (out.controls) {
  const by = new Map();
  for (const c of out.controls) { const k = c.region; if (!by.has(k)) by.set(k, []); by.get(k).push(`${c.name}${c.disabled ? ' (off)' : ''}${c.on && c.on !== 'false' ? ` (${c.on === 'true' ? 'on' : c.on})` : ''}${c.value ? ` ="${c.value}"` : ''} @${c.x},${c.y}${c.w < 44 || c.h < 44 ? ` [${c.w}x${c.h}]` : ''}`); }
  lines.push('controls:'); for (const [k, v] of by) lines.push(`  ${k}: ${v.join(' · ')}`);
}
if (out.things?.length) say('3D things', out.things.map((t) => `${t.label}${t.owner ? '(' + t.owner + ')' : ''}@${t.x},${t.y}`));
if (out.onScreen) say('on screen instead', out.onScreen);
say('ERRORS', out.errors);
if (!lines.length || ['state', 'chain'].includes(cmd) || tester === '-') console.log(JSON.stringify(out, null, 1));
else console.log(lines.join('\n'));
