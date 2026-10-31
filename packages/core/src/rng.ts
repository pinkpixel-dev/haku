// Small seeded random numbers, so humanize and spray come out the same on every machine.

export type Rng = () => number;

/** mulberry32: fast, tiny, and plenty random for musical jitter. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mixes strings and numbers into one 32-bit seed (FNV-1a). */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    for (const ch of String(part)) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Symmetric jitter in [-1, 1], a bit more likely near zero (sum of two uniforms). */
export function jitter(rng: Rng): number {
  return rng() + rng() - 1;
}

const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Short readable ids like "l_k3x9q2", easy for agents to type back. */
export function makeId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let id = '';
  for (const b of bytes) id += ID_CHARS[b % ID_CHARS.length];
  return `${prefix}_${id}`;
}
