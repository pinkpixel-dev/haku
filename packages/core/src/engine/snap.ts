// Harmony-aware pitch snapping. This is the part that makes any line you draw sound like it belongs.
//
// In "smart" mode, notes on strong beats (and long notes anywhere) land on chord tones, notes on
// the other beats can use any scale tone except the clashing "avoid notes", and offbeat passing notes
// can use the whole scale (bent to fit chords that borrow notes from outside the key). Ties go to whichever candidate is closer to the previous note, which keeps
// melodies stepping smoothly instead of jumping around.

import { chordPcs, type ChordRef } from '../theory/chords.ts';
import { mod12 } from '../theory/notes.ts';
import { pentatonicPcs, scalePcs, tonicPc, type Key } from '../theory/scales.ts';
import type { HarmonyMode } from '../model/constants.ts';

export type BeatStrength = 'strong' | 'medium' | 'weak';

/** Beats 1 and 3 are strong, 2 and 4 medium, everything between weak. Assumes 4/4. */
export function beatStrength(beat: number): BeatStrength {
  const inBar = ((beat % 4) + 4) % 4;
  const eps = 1e-6;
  if (Math.abs(inBar - Math.round(inBar)) > eps) return 'weak';
  return Math.round(inBar) % 2 === 0 ? 'strong' : 'medium';
}

export interface SnapContext {
  key: Key;
  chord: Pick<ChordRef, 'root' | 'quality'>;
  mode: HarmonyMode;
  strength: BeatStrength;
  /** Notes a beat or longer get treated like strong-beat notes. */
  long?: boolean;
  range: readonly [number, number];
  prev?: number;
}

/**
 * The key's scale bent to fit the chord. When a chord brings in a note from outside the key (G# in
 * E7 over A minor), scale tones a half step from it drop out, so G and G# never both show up.
 * Chord tones always stay.
 */
function fittedScale(scale: number[], chord: number[]): number[] {
  const outside = chord.filter((pc) => !scale.includes(pc));
  return scale.filter((pc) => chord.includes(pc) || !outside.some((o) => mod12(pc - o) === 1 || mod12(o - pc) === 1));
}

/** The pitch classes a note is allowed to land on in this context. */
export function allowedPcs(ctx: SnapContext): number[] {
  const tonic = tonicPc(ctx.key);
  const chord = chordPcs(mod12(tonic + ctx.chord.root), ctx.chord.quality);
  const scale = ctx.mode === 'smart' ? fittedScale(scalePcs(ctx.key), chord) : scalePcs(ctx.key);
  switch (ctx.mode) {
    case 'chromatic':
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    case 'scale':
      return scale;
    case 'pentatonic':
      return pentatonicPcs(ctx.key);
    case 'chord':
      return chord;
    case 'smart': {
      if (ctx.strength === 'strong' || ctx.long) return chord;
      if (ctx.strength === 'weak') return [...new Set([...scale, ...chord])];
      // Avoid notes: scale tones a half step above a chord tone, like F over a C major chord.
      const safe = scale.filter((pc) => chord.includes(pc) || !chord.includes(mod12(pc - 1)));
      return [...new Set([...safe, ...chord])];
    }
  }
}

/** Snaps a continuous MIDI pitch (like 63.4) to the best allowed note inside the range. */
export function snapPitch(raw: number, ctx: SnapContext): number {
  const allowed = new Set(allowedPcs(ctx));
  const [lo, hi] = ctx.range;
  let best = Math.round(Math.min(hi, Math.max(lo, raw)));
  let bestCost = Infinity;
  for (let n = lo - 2; n <= hi + 2; n++) {
    if (!allowed.has(mod12(n))) continue;
    // A little pull toward the previous note, and a stronger push back inside the range.
    const outside = n < lo ? lo - n : n > hi ? n - hi : 0;
    const cost = Math.abs(n - raw) + (ctx.prev === undefined ? 0 : 0.08 * Math.abs(n - ctx.prev)) + outside * 2;
    if (cost < bestCost) {
      bestCost = cost;
      best = n;
    }
  }
  return best;
}

/** Moves a pitch by scale steps (positive is up), staying in the key. */
export function scaleStep(midi: number, steps: number, key: Key): number {
  const scale = new Set(scalePcs(key));
  let n = midi;
  let remaining = Math.abs(steps);
  const dir = Math.sign(steps);
  while (remaining > 0) {
    n += dir;
    if (scale.has(mod12(n))) remaining--;
  }
  return n;
}
