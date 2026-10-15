/* The two proof-of-work kernels must agree hash for hash: the WebAssembly one the workers use, and
 * the plain JavaScript one (the fallback, checked against @noble/hashes). Prefixes of every shape a
 * job can have (one block, two blocks, a whole block of prefix, none), thousands of nonces across a
 * carry, and the stop-on-a-find path.   node scripts/hashcheck.mts   (Node 23.6+ runs TypeScript) */
import { makeJob, setNonce, tryNonce, bumpNonce, digestHex, nonceString, NONCE_WIDTH } from '../src/pow/sha.ts';
import { makeWasmHasher } from '../src/pow/wasm.ts';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const w = await makeWasmHasher();
if (!w) { console.error('hashcheck: WebAssembly unavailable'); process.exit(1); }
let checked = 0;
const fail = (m: string) => { console.error('hashcheck: ' + m); process.exit(1); };
for (const prefix of ['5-12BUILD3007073NONCE', '9-4@2-7RAID3001000NONCE', 'x'.repeat(42), 'y'.repeat(43), 'z'.repeat(64), 'q'.repeat(70), '']) {
  const job = makeJob(prefix);
  setNonce(job, 9_999_700 + prefix.length);   // runs across a ten-thousands carry
  w.load(job);
  for (let i = 0; i < 400; i++) {
    const out = new Int32Array(8); tryNonce(job, out);
    w.run(1, 64);
    if (digestHex(w.digest) !== digestHex(out)) fail(`prefix ${prefix.length}B nonce ${nonceString(job)}: wasm ${digestHex(w.digest)} js ${digestHex(out)}`);
    if (i % 50 === 0 && bytesToHex(sha256(new TextEncoder().encode(prefix + nonceString(job)))) !== digestHex(out)) fail(`js kernel disagrees with @noble/hashes at ${prefix.length}B`);
    bumpNonce(job);
    if (String.fromCharCode(...w.tail.subarray(job.nonceAt, job.nonceAt + NONCE_WIDTH)) !== nonceString(job)) fail(`nonce drifted at ${prefix.length}B`);
    checked++;
  }
}
const job = makeJob('5-12BUILD3007073NONCE'); setNonce(job, 0); w.load(job);
const r = w.run(1_000_000, 1);
setNonce(job, r.done); const out = new Int32Array(8); const z = tryNonce(job, out);
if (r.zeros !== z || digestHex(out) !== digestHex(w.digest) || z <= 1) fail(`find path: wasm ${r.zeros} at ${r.done}, js ${z}`);
console.log(`hashcheck: ${checked} hashes agree (wasm = js = @noble/hashes), first find at nonce ${r.done} with ${z} zeros`);
