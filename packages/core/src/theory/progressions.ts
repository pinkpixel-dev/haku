// Roman numeral progressions and presets.
// Numerals are measured against the major scale (I=0, ii=2, iii=4, IV=5, V=7, vi=9, vii=11),
// with b/# prefixes for borrowed chords, so "bVIImaj7" in any key means a major 7th a whole step below the tonic.

import { chordSymbol, normalizeQuality, parseChordSymbol, type ChordQuality, type ChordRef } from './chords.ts';
import { mod12 } from './notes.ts';
import { prefersFlats, tonicPc, type Key } from './scales.ts';

const NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'] as const;
const NUMERAL_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

/** Lowercase numerals turn bare "7"/"9"/"11"/"6" into their minor versions, the way people write them. */
function qualityFor(suffix: string, lower: boolean): ChordQuality | null {
  if (lower) {
    const minorMap: Record<string, string> = { '': 'm', '6': 'm6', '7': 'm7', '9': 'm9', '11': 'm11' };
    if (suffix in minorMap) return normalizeQuality(minorMap[suffix]!);
  }
  return normalizeQuality(suffix);
}

/** Parses one roman numeral chord like "ii9", "V13", "bVIImaj7", "viiø7". */
export function parseRoman(token: string): Omit<ChordRef, 'beats'> | null {
  const m = /^([b#]?)(vii|iii|iv|vi|ii|v|i|VII|III|IV|VI|II|V|I)(.*)$/.exec(token.trim());
  if (!m) return null;
  const idx = NUMERALS.indexOf(m[2]!.toLowerCase() as (typeof NUMERALS)[number]);
  const lower = m[2] === m[2]!.toLowerCase();
  const quality = qualityFor(m[3]!, lower);
  if (quality === null) return null;
  const shift = m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0;
  return { root: mod12(NUMERAL_SEMITONES[idx]! + shift), quality };
}

/**
 * Parses a progression string. Tokens are roman numerals or chord symbols, separated by spaces or "|".
 * A ":N" suffix sets the length in beats (default 4), so "ii9:2 V13:2 Imaj9" packs two chords into one bar.
 */
export function parseProgression(text: string, key: Key): ChordRef[] {
  const tokens = text.split(/[\s|,]+/).filter(Boolean);
  if (tokens.length === 0) throw new Error('Progression is empty');
  return tokens.map((token) => {
    const [body, beatsText] = token.split(':');
    const beats = beatsText === undefined ? 4 : Number(beatsText);
    if (!Number.isFinite(beats) || beats <= 0 || beats > 32) throw new Error(`Bad chord length in "${token}"`);
    const roman = parseRoman(body!);
    if (roman) return { ...roman, beats };
    const symbol = parseChordSymbol(body!);
    if (symbol) return { root: mod12(symbol.rootPc - tonicPc(key)), quality: symbol.quality, beats };
    throw new Error(`Can't read chord "${body}". Try a roman numeral like ii9 or a symbol like Em9.`);
  });
}

export function progressionBeats(progression: readonly ChordRef[]): number {
  return progression.reduce((sum, c) => sum + c.beats, 0);
}

/** Finds the chord sounding at a beat. Progressions shorter than the scene loop around. */
export function chordAt(progression: readonly ChordRef[], beat: number): { chord: ChordRef; start: number } {
  const total = progressionBeats(progression);
  const cycle = Math.floor(beat / total) * total;
  let pos = beat - cycle;
  let start = cycle;
  for (const chord of progression) {
    if (pos < chord.beats) return { chord, start };
    pos -= chord.beats;
    start += chord.beats;
  }
  return { chord: progression[progression.length - 1]!, start: cycle + total - progression[progression.length - 1]!.beats };
}

export function progressionText(progression: readonly ChordRef[], key: Key): string {
  const flats = prefersFlats(key);
  return progression.map((c) => chordSymbol(c, key, flats) + (c.beats === 4 ? '' : `:${c.beats}`)).join(' ');
}

export const PROGRESSIONS = {
  'jazzy-251': { label: 'Jazzy 2-5-1', text: 'ii9 V13 Imaj9 vi9' },
  'soft-turnaround': { label: 'Soft turnaround', text: 'Imaj9 vi9 ii9 V9sus4' },
  'rainy-minor': { label: 'Rainy minor', text: 'i9 iv9 bVIImaj7 bIIImaj7' },
  'neo-soul': { label: 'Neo soul', text: 'IVmaj9 iii7 vi9 Imaj9' },
  'late-night': { label: 'Late night', text: 'i9 bVImaj7 iv9 V7b9' },
  'dreamy-two': { label: 'Dreamy two-chord', text: 'Imaj9 IVmaj9' },
  'dorian-float': { label: 'Dorian float', text: 'i9 IV9 i9 IV9' },
  'sunday-walk': { label: 'Sunday walk', text: 'Imaj7 iii7 IVmaj7 iv6' },
  'city-lights': { label: 'City lights', text: 'vi9 ii9 V13 Imaj9' },
  'snowfall': { label: 'Snowfall', text: 'Imaj9 bVIImaj9 IVmaj9 iv6' },
} as const;

export type ProgressionPresetId = keyof typeof PROGRESSIONS;
export const PROGRESSION_PRESETS = Object.keys(PROGRESSIONS) as ProgressionPresetId[];

/** Accepts a preset id or a progression string. */
export function resolveProgression(textOrPreset: string, key: Key): ChordRef[] {
  const preset = PROGRESSIONS[textOrPreset as ProgressionPresetId];
  return parseProgression(preset ? preset.text : textOrPreset, key);
}
