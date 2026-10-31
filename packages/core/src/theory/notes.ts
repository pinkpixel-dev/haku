// Pitch classes, note names, and MIDI conversion.

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Parses a pitch class like "C", "f#", "Bb", "Ebb". Returns null if it isn't one. */
export function parsePitchClass(name: string): number | null {
  const m = /^([A-Ga-g])([#b]*)$/.exec(name.trim());
  if (!m) return null;
  const base = LETTERS[m[1]!.toUpperCase()]!;
  let shift = 0;
  for (const ch of m[2]!) shift += ch === '#' ? 1 : -1;
  return mod12(base + shift);
}

/** Parses a note like "C4", "f#3", "Bb5" (C4 = 60) or a MIDI number string. */
export function parseNote(name: string): number | null {
  const trimmed = name.trim();
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return n >= 0 && n <= 127 ? n : null;
  }
  const m = /^([A-Ga-g][#b]*)(-?\d)$/.exec(trimmed);
  if (!m) return null;
  const pc = parsePitchClass(m[1]!);
  if (pc === null) return null;
  // Use the written letter's octave, so "Cb4" is B3 and "B#3" is C4.
  const letter = LETTERS[m[1]![0]!.toUpperCase()]!;
  const accidental = pc - letter > 6 ? pc - letter - 12 : pc - letter < -6 ? pc - letter + 12 : pc - letter;
  const midi = (Number(m[2]) + 1) * 12 + letter + accidental;
  return midi >= 0 && midi <= 127 ? midi : null;
}

export function pcName(pc: number, flats = false): string {
  return (flats ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)]!;
}

export function noteName(midi: number, flats = false): string {
  return `${pcName(midi, flats)}${Math.floor(midi / 12) - 1}`;
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
