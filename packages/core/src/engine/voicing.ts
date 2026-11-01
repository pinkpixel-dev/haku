// Voice leading for the backing chords. Every chord gets a handful of candidate voicings
// (close position in each inversion, plus drop-2 spreads), and we keep the one that moves the
// least from the previous chord. That's most of what makes a progression sound smooth and jazzy
// instead of blocky.

import { QUALITIES, type ChordQuality } from '../theory/chords.ts';
import { mod12 } from '../theory/notes.ts';

export const VOICING_RANGE: readonly [number, number] = [50, 76];

function closeVoicing(order: readonly number[], bottom: number): number[] {
  const notes = [bottom];
  for (let i = 1; i < order.length; i++) {
    let n = notes[i - 1]! + 1;
    while (mod12(n) !== order[i]) n++;
    notes.push(n);
  }
  return notes;
}

/**
 * The intervals a comping voicing uses. Rootless leaves the root to the bass, the way jazz pianists
 * comp, as long as at least three notes are left (plain triads keep their root).
 */
export function voicingIntervals(quality: ChordQuality, rootless = false): readonly number[] {
  const all = QUALITIES[quality].voicing;
  const without = all.filter((i) => mod12(i) !== 0);
  return rootless && without.length >= 3 ? without : all;
}

export function candidateVoicings(rootPc: number, quality: ChordQuality, range = VOICING_RANGE, rootless = false): number[][] {
  const pcs = [...new Set(voicingIntervals(quality, rootless).map((i) => mod12(rootPc + i)))];
  const out: number[][] = [];
  for (let r = 0; r < pcs.length; r++) {
    const order = [...pcs.slice(r), ...pcs.slice(0, r)];
    let bottom = range[0];
    while (mod12(bottom) !== order[0]) bottom++;
    for (let b = bottom; b <= range[1]; b += 12) {
      const close = closeVoicing(order, b);
      out.push(close);
      if (close.length >= 4) {
        // Drop-2: take the second note from the top down an octave.
        const drop = [...close];
        drop[drop.length - 2]! -= 12;
        out.push(drop.sort((x, y) => x - y));
      }
    }
  }
  return out.filter((v) => v[0]! >= range[0] - 2 && v[v.length - 1]! <= range[1]);
}

/** How far the voices move, matching each note to its nearest neighbor in the other chord. */
export function movement(a: readonly number[], b: readonly number[]): number {
  const nearest = (n: number, set: readonly number[]) => Math.min(...set.map((m) => Math.abs(m - n)));
  return (a.reduce((s, n) => s + nearest(n, b), 0) + b.reduce((s, n) => s + nearest(n, a), 0)) / 2;
}

function roughness(v: readonly number[]): number {
  // Close intervals low down get muddy, so penalize seconds and thirds below about E3.
  let penalty = 0;
  for (let i = 1; i < v.length; i++) if (v[i - 1]! < 53 && v[i]! - v[i - 1]! < 5) penalty += 3;
  if (v[v.length - 1]! > 74) penalty += 1.5;
  return penalty;
}

export function voiceChord(rootPc: number, quality: ChordQuality, prev: readonly number[] | null, range = VOICING_RANGE, rootless = false): number[] {
  const candidates = candidateVoicings(rootPc, quality, range, rootless);
  let best = candidates[0] ?? [];
  let bestCost = Infinity;
  for (const v of candidates) {
    const center = v.reduce((s, n) => s + n, 0) / v.length;
    const cost = (prev ? movement(v, prev) : Math.abs(center - 62)) + roughness(v);
    if (cost < bestCost) {
      bestCost = cost;
      best = v;
    }
  }
  return best;
}
