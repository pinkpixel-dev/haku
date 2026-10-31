// Modes and keys. Everything is expressed as semitones from the tonic.

import { FLAT_NAMES, mod12, parsePitchClass } from './notes.ts';

export const MODES = ['major', 'minor', 'dorian', 'mixolydian', 'lydian', 'phrygian'] as const;
export type Mode = (typeof MODES)[number];

export const MODE_INTERVALS: Record<Mode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

/** Modes with a minor third use the minor pentatonic, the rest use the major one. */
export function isMinorMode(mode: Mode): boolean {
  return MODE_INTERVALS[mode][2] === 3;
}

export interface Key {
  tonic: string;
  mode: Mode;
}

export function tonicPc(key: Key): number {
  const pc = parsePitchClass(key.tonic);
  if (pc === null) throw new Error(`Unknown tonic "${key.tonic}"`);
  return pc;
}

/** Absolute pitch classes of the key's scale. */
export function scalePcs(key: Key): number[] {
  const t = tonicPc(key);
  return MODE_INTERVALS[key.mode].map((i) => mod12(t + i));
}

export function pentatonicPcs(key: Key): number[] {
  const t = tonicPc(key);
  const steps = isMinorMode(key.mode) ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
  return steps.map((i) => mod12(t + i));
}

/** Whether to spell this key with flats. Based on the relative major's position on the circle of fifths. */
export function prefersFlats(key: Key): boolean {
  if (key.tonic.includes('b')) return true;
  if (key.tonic.includes('#')) return false;
  const t = tonicPc(key);
  // Shift to the relative major (Ionian) tonic, then check it against the flat-side majors.
  const ionianOffset: Record<Mode, number> = { major: 0, minor: 3, dorian: -2, mixolydian: 5, lydian: -5, phrygian: -4 };
  const major = mod12(t + ionianOffset[key.mode]);
  return [5, 10, 3, 8, 1, 6].includes(major);
}

export function keyLabel(key: Key): string {
  const pc = tonicPc(key);
  const name = key.tonic.length > 1 ? key.tonic[0]!.toUpperCase() + key.tonic.slice(1) : FLAT_NAMES[pc]!;
  return `${name} ${key.mode}`;
}
