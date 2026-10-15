/* The same proof-of-work search as sha.ts, as a tiny WebAssembly module written out byte by byte
 * here (no toolchain, no binary in the repo). Every browser runs it near native speed; it matters
 * most where plain JavaScript is slowest at 32-bit integer work (Firefox) and where there is no
 * WebGPU. One call hashes up to `count` nonces in a row, counting the decimal nonce up in place, and
 * stops early at the first proof better than `floor`.
 *
 * Memory (one 64 KiB page):  0 mid state · 32 working state / digest · 64 tail block(s) (≤128 B)
 *                           512 message schedule · 768 zeros of the last find
 * Words are held as numbers, not bytes, so JavaScript reads the digest through an Int32Array. */
import type { HashJob } from './sha';

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const MID = 0, ST = 32, TAIL = 64, WW = 512, FOUND = 768;

/* ── a very small assembler ── */
const uleb = (n: number) => { const o: number[] = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n); return o; };
const sleb = (n: number) => { const o: number[] = []; n |= 0; for (;;) { const b = n & 0x7f; n >>= 7; if ((n === 0 && !(b & 0x40)) || (n === -1 && (b & 0x40))) { o.push(b); return o; } o.push(b | 0x80); } };
const str = (s: string) => [...uleb(s.length), ...[...s].map((c) => c.charCodeAt(0))];
const vec = (items: number[][]) => [...uleb(items.length), ...items.flat()];
const section = (id: number, body: number[]) => [id, ...uleb(body.length), ...body];
const I32 = 0x7f;

const get = (l: number) => [0x20, ...uleb(l)], set = (l: number) => [0x21, ...uleb(l)], tee = (l: number) => [0x22, ...uleb(l)];
const c = (n: number) => [0x41, ...sleb(n)];
const load = (off = 0) => [0x28, 2, ...uleb(off)], store = (off = 0) => [0x36, 2, ...uleb(off)];
const load8 = (off = 0) => [0x2d, 0, ...uleb(off)], store8 = (off = 0) => [0x3a, 0, ...uleb(off)];
const add = [0x6a], sub = [0x6b], and = [0x71], or = [0x72], xor = [0x73], shl = [0x74], shru = [0x76], rotr = [0x78], clz = [0x67];
const ne = [0x47], ltu = [0x49], geu = [0x4f], ges = [0x4e], gtu = [0x4b], eqz = [0x45];
const block = (...body: number[][]) => [0x02, 0x40, ...body.flat(), 0x0b];
const loop = (...body: number[][]) => [0x03, 0x40, ...body.flat(), 0x0b];
const iff = (then: number[][], els?: number[][]) => [0x04, 0x40, ...then.flat(), ...(els ? [0x05, ...els.flat()] : []), 0x0b];
const br = (d: number) => [0x0c, ...uleb(d)], brIf = (d: number) => [0x0d, ...uleb(d)], ret = [0x0f], call = (f: number) => [0x10, ...uleb(f)];
const ror = (l: number, n: number) => [...get(l), ...c(n), ...rotr];

/* compress(off): one SHA-256 compression of the tail block at TAIL+off into the state at ST, fully
 * unrolled: every address and round constant is built in, and the eight working words are never
 * shuffled (each round renames them instead), so a round is just its arithmetic */
function compressFn(): number[] {
  // params: 0 off · locals: 1..8 the working words, 9 x, 10 y, 11 t1, 12 t2, 13 p
  const off = 0, x = 9, y = 10, t1 = 11, t2 = 12, p = 13;
  const code: number[][] = [];
  const W = (k: number) => WW + 4 * k;
  // W[0..15]: the block, big-endian
  code.push(c(TAIL), get(off), add, set(p));
  for (let k = 0; k < 16; k++) code.push(c(0),
    get(p), load8(4 * k), c(24), shl, get(p), load8(4 * k + 1), c(16), shl, or,
    get(p), load8(4 * k + 2), c(8), shl, or, get(p), load8(4 * k + 3), or, store(W(k)));
  // W[16..63]
  for (let k = 16; k < 64; k++) code.push(
    c(0), load(W(k - 15)), set(x), c(0), load(W(k - 2)), set(y),
    c(0), c(0), load(W(k - 16)),
    ror(x, 7), ror(x, 18), xor, get(x), c(3), shru, xor, add,
    c(0), load(W(k - 7)), add,
    ror(y, 17), ror(y, 19), xor, get(y), c(10), shru, xor, add,
    store(W(k)));
  // the working words start as the state
  let v = [1, 2, 3, 4, 5, 6, 7, 8];
  v.forEach((l, k) => code.push(c(0), load(ST + 4 * k), set(l)));
  for (let r = 0; r < 64; r++) {
    const [a, b, cc, d, e, f, g, h] = v;
    code.push(
      get(h), ror(e, 6), ror(e, 11), xor, ror(e, 25), xor, add,
      get(e), get(f), and, get(e), c(-1), xor, get(g), and, xor, add,
      c(K[r] | 0), add, c(0), load(W(r)), add, set(t1),
      ror(a, 2), ror(a, 13), xor, ror(a, 22), xor,
      get(a), get(b), and, get(a), get(cc), and, xor, get(b), get(cc), and, xor, add, set(t2),
      get(d), get(t1), add, set(d),          // d becomes the new e
      get(t1), get(t2), add, set(h));         // h becomes the new a
    v = [h, a, b, cc, d, e, f, g];
  }
  // after 64 renamings the words are back in place: add them into the state
  v.forEach((l, k) => code.push(c(0), c(0), load(ST + 4 * k), get(l), add, store(ST + 4 * k)));
  const locals = vec([[...uleb(13), I32]]);
  const body = [...locals, ...code.flat(), 0x0b];
  return [...uleb(body.length), ...body];
}

/* run(count, floor, nonceAt, nonceEnd, two) → hashes done; stops on a find (zeros at FOUND) */
function runFn(): number[] {
  const [count, floor, at, end, two, n, z, j, w] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const code: number[][] = [];
  code.push(c(0), set(n));
  code.push(loop(
    get(n), get(count), geu, iff([get(n), ret]),
    // the working state starts at the midstate
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => [...c(0), ...c(0), ...load(MID + 4 * k), ...store(ST + 4 * k)]),
    c(0), call(0),
    get(two), iff([c(64), call(0)]),
    // leading hex zeros
    c(0), set(z), c(0), set(j),
    block(loop(
      get(j), load(ST), tee(w), eqz,
      iff([get(z), c(8), add, set(z), get(j), c(4), add, tee(j), c(32), ltu, brIf(1), br(2)],
          [get(z), get(w), clz, c(2), shru, add, set(z), br(2)]))),
    get(z), get(floor), gtu, iff([c(0), get(z), store(FOUND), get(n), ret]),
    // count the nonce up by one: '9' rolls over to '0' and carries
    get(end), c(1), sub, set(j),
    block(loop(
      get(j), load8(TAIL), tee(w), c(57), ne,
      iff([get(j), get(w), c(1), add, store8(TAIL), br(2)]),
      get(j), c(48), store8(TAIL),
      get(j), c(1), sub, tee(j), get(at), ges, brIf(0))),
    get(n), c(1), add, set(n),
    br(0)));
  code.push(get(n));
  const locals = vec([[...uleb(4), I32]]);
  const body = [...locals, ...code.flat(), 0x0b];
  return [...uleb(body.length), ...body];
}

export function wasmBytes(): Uint8Array {
  const types = vec([[0x60, ...vec([[I32]]), ...vec([])], [0x60, ...vec([[I32], [I32], [I32], [I32], [I32]]), ...vec([[I32]])]]);
  const bytes = [
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...section(1, types),
    ...section(3, vec([uleb(0), uleb(1)])),
    ...section(5, vec([[0x00, ...uleb(1)]])),
    ...section(7, vec([[...str('mem'), 0x02, 0], [...str('run'), 0x00, 1]])),
    ...section(10, vec([compressFn(), runFn()])),
  ];
  return new Uint8Array(bytes);
}

export interface WasmHasher {
  /** Point it at a job (its midstate and tail are copied in). */
  load(job: HashJob): void;
  /** Hash up to `count` nonces from the job's current one; returns how many were done and, on a
   * find, its zeros (the tail then holds that nonce, and `digest` its hash). */
  run(count: number, floor: number): { done: number; zeros: number };
  /** The job's tail as the hasher has it (the nonce moves on in here, not in the job). */
  tail: Uint8Array;
  digest: Int32Array;
}

/** A ready hasher, or null where WebAssembly is not allowed. */
export async function makeWasmHasher(): Promise<WasmHasher | null> {
  try {
    const { instance } = await WebAssembly.instantiate(wasmBytes() as BufferSource);
    const mem = (instance.exports.mem as WebAssembly.Memory).buffer;
    const run = instance.exports.run as (count: number, floor: number, at: number, end: number, two: number) => number;
    const words = new Int32Array(mem), bytes = new Uint8Array(mem);
    let at = 0, end = 0, two = 0;
    const hasher: WasmHasher = {
      tail: bytes.subarray(TAIL, TAIL + 128),
      digest: words.subarray(ST / 4, ST / 4 + 8),
      load(job) {
        words.set(job.mid, MID / 4);
        bytes.fill(0, TAIL, TAIL + 128);
        bytes.set(job.tail, TAIL);
        at = job.nonceAt; end = job.nonceAt + 13; two = job.tail.length === 128 ? 1 : 0;
        hasher.tail = bytes.subarray(TAIL, TAIL + job.tail.length);
      },
      run(count, floor) {
        const done = run(count, floor, at, end, two);
        return done < count ? { done, zeros: words[FOUND / 4] } : { done, zeros: 0 };
      },
    };
    return hasher;
  } catch { return null; }
}
