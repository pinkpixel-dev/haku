// Chord qualities, chord symbols, and how chords relate to a key.

import { mod12, parsePitchClass, pcName } from './notes.ts';
import { tonicPc, type Key } from './scales.ts';

interface QualityDef {
  /** Every tone in the chord, in semitones above the root (extensions above 12). */
  tones: readonly number[];
  /** The 3 or 4 tones a comping voicing should use, most important first. */
  voicing: readonly number[];
  /** Whether this counts as a minor-family chord for roman numeral spelling. */
  minor: boolean;
}

export const QUALITIES = {
  maj: { tones: [0, 4, 7], voicing: [0, 4, 7], minor: false },
  m: { tones: [0, 3, 7], voicing: [0, 3, 7], minor: true },
  dim: { tones: [0, 3, 6], voicing: [0, 3, 6], minor: true },
  aug: { tones: [0, 4, 8], voicing: [0, 4, 8], minor: false },
  sus2: { tones: [0, 2, 7], voicing: [0, 2, 7], minor: false },
  sus4: { tones: [0, 5, 7], voicing: [0, 5, 7], minor: false },
  add9: { tones: [0, 4, 7, 14], voicing: [4, 14, 7, 0], minor: false },
  '6': { tones: [0, 4, 7, 9], voicing: [4, 9, 7, 0], minor: false },
  m6: { tones: [0, 3, 7, 9], voicing: [3, 9, 7, 0], minor: true },
  '69': { tones: [0, 4, 7, 9, 14], voicing: [4, 9, 14, 7], minor: false },
  maj7: { tones: [0, 4, 7, 11], voicing: [4, 11, 7, 0], minor: false },
  maj9: { tones: [0, 4, 7, 11, 14], voicing: [4, 11, 14, 7], minor: false },
  m7: { tones: [0, 3, 7, 10], voicing: [3, 10, 7, 0], minor: true },
  m9: { tones: [0, 3, 7, 10, 14], voicing: [3, 10, 14, 7], minor: true },
  m11: { tones: [0, 3, 7, 10, 14, 17], voicing: [3, 10, 14, 17], minor: true },
  '7': { tones: [0, 4, 7, 10], voicing: [4, 10, 7, 0], minor: false },
  '9': { tones: [0, 4, 7, 10, 14], voicing: [4, 10, 14, 7], minor: false },
  '13': { tones: [0, 4, 7, 10, 14, 21], voicing: [4, 10, 14, 21], minor: false },
  '7b9': { tones: [0, 4, 7, 10, 13], voicing: [4, 10, 13, 7], minor: false },
  '7sus4': { tones: [0, 5, 7, 10], voicing: [5, 10, 7, 0], minor: false },
  '9sus4': { tones: [0, 5, 7, 10, 14], voicing: [5, 10, 14, 7], minor: false },
  m7b5: { tones: [0, 3, 6, 10], voicing: [3, 10, 6, 0], minor: true },
  dim7: { tones: [0, 3, 6, 9], voicing: [3, 9, 6, 0], minor: true },
} as const satisfies Record<string, QualityDef>;

export type ChordQuality = keyof typeof QUALITIES;
export const CHORD_QUALITIES = Object.keys(QUALITIES) as ChordQuality[];

/** Alternate spellings people (and agents) type, mapped to our canonical names. */
const ALIASES: Record<string, ChordQuality> = {
  '': 'maj', M: 'maj', major: 'maj', min: 'm', minor: 'm', '-': 'm', mi: 'm',
  M7: 'maj7', Δ: 'maj7', Δ7: 'maj7', ma7: 'maj7', M9: 'maj9', Δ9: 'maj9', ma9: 'maj9',
  min7: 'm7', '-7': 'm7', mi7: 'm7', min9: 'm9', '-9': 'm9', min11: 'm11', '-11': 'm11',
  dom7: '7', ø: 'm7b5', ø7: 'm7b5', 'm7-5': 'm7b5', '°': 'dim', '°7': 'dim7', o: 'dim', o7: 'dim7',
  sus: 'sus4', '7sus': '7sus4', '9sus': '9sus4', '6/9': '69', add2: 'add9', '+': 'aug',
};

export function normalizeQuality(q: string): ChordQuality | null {
  if (q in QUALITIES) return q as ChordQuality;
  return ALIASES[q] ?? null;
}

/** A chord placed in a progression. The root is relative to the key's tonic, so changing key transposes it. */
export interface ChordRef {
  root: number;
  quality: ChordQuality;
  beats: number;
}

export function chordPcs(root: number, quality: ChordQuality): number[] {
  return [...new Set(QUALITIES[quality].tones.map((t) => mod12(root + t)))];
}

/** Absolute root pitch class of a chord in a key. */
export function chordRootPc(chord: Pick<ChordRef, 'root'>, key: Key): number {
  return mod12(tonicPc(key) + chord.root);
}

export function chordSymbol(chord: Pick<ChordRef, 'root' | 'quality'>, key: Key, flats: boolean): string {
  const root = pcName(chordRootPc(chord, key), flats);
  return chord.quality === 'maj' ? root : `${root}${chord.quality}`;
}

/** Parses an absolute chord symbol like "Em9", "Bbmaj7", "F#m7b5" into a root pitch class and quality. */
export function parseChordSymbol(symbol: string): { rootPc: number; quality: ChordQuality } | null {
  const m = /^([A-Ga-g][#b]?)(.*)$/.exec(symbol.trim());
  if (!m) return null;
  const rootPc = parsePitchClass(m[1]!);
  const quality = normalizeQuality(m[2]!);
  if (rootPc === null || quality === null) return null;
  return { rootPc, quality };
}
