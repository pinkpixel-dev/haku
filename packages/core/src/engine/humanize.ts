// Swing and humanize. Both run on the finished score so drawn notes and the backing band
// share the same feel.

import { createRng, hashSeed, jitter } from '../rng.ts';
import type { NoteEvent } from './types.ts';

const SIXTEENTH = 0.25;

/**
 * Pushes offbeat sixteenths late. At 1.0 they land on the triplet (a third of the beat after the
 * eighth), which is about as swung as lofi gets. Notes that aren't on an offbeat sixteenth are untouched.
 */
export function swingTime(time: number, amount: number): number {
  const inPair = time % (SIXTEENTH * 2);
  if (Math.abs(inPair - SIXTEENTH) > 0.01) return time;
  return time + amount * (1 / 3 - SIXTEENTH);
}

export function applySwing(events: NoteEvent[], amount: number): void {
  if (amount <= 0) return;
  for (const e of events) {
    const swung = swingTime(e.time, amount);
    e.duration = Math.max(0.05, e.duration - (swung - e.time));
    e.time = swung;
  }
}

/** Backbeats drag a little behind the grid, kicks stay tight. That lazy push-pull is half the genre. */
const DRUM_LAG: Partial<Record<NonNullable<NoteEvent['drum']>, number>> = { snare: 0.012, brush: 0.016, rim: 0.01 };

/**
 * Nudges timing and velocity by small seeded amounts. The same seed and pass always give the same
 * result, so repeats of a scene vary from each other but a project plays the same everywhere.
 */
export function applyHumanize(events: NoteEvent[], amount: number, seed: number, pass = 0): void {
  if (amount <= 0) return;
  const rngs = new Map<string, () => number>();
  for (const e of events) {
    let rng = rngs.get(e.track);
    if (!rng) rngs.set(e.track, (rng = createRng(hashSeed(seed, e.track, pass))));
    const tight = e.drum === 'kick' ? 0.5 : 1;
    const lag = e.drum ? (DRUM_LAG[e.drum] ?? 0) * amount : 0;
    e.time = Math.max(0, e.time + jitter(rng) * 0.022 * amount * tight + lag);
    e.velocity = Math.min(1, Math.max(0.05, e.velocity * (1 + jitter(rng) * 0.14 * amount)));
  }
}
