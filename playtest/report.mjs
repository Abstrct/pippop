#!/usr/bin/env node
/* A run's logs as a playtest report: ratings, each tester's session (what they did, what they saw,
 * where they got stuck), every note with its screenshot, errors, frame rates and the end state.
 *   node playtest/report.mjs [run]      (newest run when omitted) → runs/<run>/report.md + report.json */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNS = join(dirname(fileURLToPath(import.meta.url)), 'runs');
const run = process.argv[2] || readdirSync(RUNS).filter((d) => statSync(join(RUNS, d)).isDirectory()).sort().pop();
const DIR = join(RUNS, run);
const rel = (p) => (p ? relative(DIR, p) : '');
const median = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

const testers = readdirSync(DIR).filter((d) => existsSync(join(DIR, d, 'log.jsonl'))).map((name) => {
  const rows = readFileSync(join(DIR, name, 'log.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const start = rows.find((r) => r.kind === 'start') || {};
  const acts = rows.filter((r) => r.kind === 'act');
  const misses = acts.filter((r) => r.tapped === undefined && r.why && /nothing named|no "/.test(r.why));
  const errors = [...new Set(acts.flatMap((r) => r.errors || []))];
  const end = rows.find((r) => r.kind === 'end');
  const verdict = rows.filter((r) => r.kind === 'verdict').pop();
  return {
    name, device: start.device, persona: start.persona, minutes: Math.round((rows[rows.length - 1]?.s || 0) / 6) / 10, steps: acts.length,
    routes: [...new Set(acts.map((r) => r.route).filter(Boolean))], fps: { median: median(acts.map((r) => r.fps)), min: Math.min(...acts.map((r) => r.fps ?? 999)) },
    misses: misses.map((r) => `${r.cmd} ${r.args.join(' ')}`), failedSteps: acts.filter((r) => !r.ok).map((r) => `${r.cmd} ${r.args.join(' ')}`),
    errors, notes: rows.filter((r) => r.kind === 'note').map((r) => ({ text: r.text, shot: rel(r.screenshot), s: r.s })),
    cheats: rows.filter((r) => r.kind === 'cheat'), verdict: verdict ? { scores: verdict.scores, text: verdict.text } : null,
    end: end ? { kid: end.state?.kid, jobs: end.state?.jobs, exceptions: end.exceptions, consoleErrors: end.consoleErrors, shot: rel(end.screenshot) } : null,
  };
});

const dims = [...new Set(testers.flatMap((t) => Object.keys(t.verdict?.scores || {})))];
const avg = (d) => { const v = testers.map((t) => t.verdict?.scores?.[d]).filter((x) => x != null); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–'; };
const md = [];
md.push(`# Pip Pop playtest · ${run}`, '');
md.push(`${testers.length} playtesters on the private devnet. Every step was recorded with a screenshot (in each tester's folder).`, '');
md.push('## Ratings (1–5)', '', `| Tester | Device | Minutes | Steps | ${dims.join(' | ')} |`, `|---|---|---|---|${dims.map(() => '---').join('|')}|`);
for (const t of testers) md.push(`| ${t.name} | ${t.device} | ${t.minutes} | ${t.steps} | ${dims.map((d) => t.verdict?.scores?.[d] ?? '–').join(' | ')} |`);
md.push(`| **Average** | | | | ${dims.map(avg).join(' | ')} |`, '');
const allErrors = new Map();
for (const t of testers) for (const e of t.errors) allErrors.set(e, [...(allErrors.get(e) || []), t.name]);
md.push('## Errors seen', '');
if (!allErrors.size) md.push('None.', '');
else for (const [e, who] of allErrors) md.push(`- ${e} — *${who.join(', ')}*`);
md.push('');
const missed = new Map();
for (const t of testers) for (const m of t.misses) missed.set(m, [...(missed.get(m) || []), t.name]);
if (missed.size) { md.push('## Things testers looked for and could not find', ''); for (const [m, who] of missed) md.push(`- \`${m}\` — *${who.join(', ')}*`); md.push(''); }
md.push('## Sessions', '');
for (const t of testers) {
  md.push(`### ${t.name} — ${t.persona || ''}`, '', `${t.device} · ${t.minutes} min · ${t.steps} steps · fps median ${t.fps.median ?? '–'}, low ${Number.isFinite(t.fps.min) && t.fps.min !== 999 ? t.fps.min : '–'} · screens ${t.routes.join(' ')}`, '');
  if (t.verdict) md.push(`**Verdict** ${Object.entries(t.verdict.scores).map(([k, v]) => `${k} ${v}`).join(' · ')}`, '', `> ${t.verdict.text}`, '');
  if (t.notes.length) { md.push('Notes:', ''); for (const n of t.notes) md.push(`- (${n.s}s) ${n.text} — [shot](${n.shot})`); md.push(''); }
  const k = t.end?.kid;
  if (k) md.push(`End state: kid ${k.name} (${k.id}) · stars ${k.stars} · rocks ${k.rocks} · toys ${k.toys.map((x) => `${x.toy}${x.made ? '' : ' (making)'}`).join(', ')} · wagon ${k.wagon}`, '');
  const failed = (t.end?.jobs || []).filter((j) => j.status === 'failed');
  if (failed.length) md.push(`Refused rites: ${failed.map((j) => `${j.msg} → ${j.word} (${j.error})`).join('; ')}`, '');
  if (t.cheats.length) md.push(`Test cheats: ${t.cheats.map((c) => `${c.what} ${c.stars}`).join(', ')}`, '');
  if (t.failedSteps.length) md.push(`Harness errors: ${t.failedSteps.join('; ')}`, '');
}
writeFileSync(join(DIR, 'report.md'), md.join('\n'));
writeFileSync(join(DIR, 'report.json'), JSON.stringify({ run, testers }, null, 2));
console.log(join(DIR, 'report.md'));
