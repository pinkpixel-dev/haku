import { describe, expect, it } from 'vitest';
import {
  chordAt,
  chordPcs,
  keyLabel,
  noteName,
  parseChordSymbol,
  parseNote,
  parseProgression,
  parseRoman,
  prefersFlats,
  progressionText,
  resolveProgression,
} from '../src/index.ts';

describe('notes', () => {
  it('parses note names with octaves, C4 = 60', () => {
    expect(parseNote('C4')).toBe(60);
    expect(parseNote('A4')).toBe(69);
    expect(parseNote('f#3')).toBe(54);
    expect(parseNote('Bb5')).toBe(82);
    expect(parseNote('Cb4')).toBe(59);
    expect(parseNote('B#3')).toBe(60);
    expect(parseNote('64')).toBe(64);
    expect(parseNote('H2')).toBeNull();
  });

  it('names notes with sharps or flats', () => {
    expect(noteName(61)).toBe('C#4');
    expect(noteName(61, true)).toBe('Db4');
  });
});

describe('chords', () => {
  it('parses symbols and common aliases', () => {
    expect(parseChordSymbol('Em9')).toEqual({ rootPc: 4, quality: 'm9' });
    expect(parseChordSymbol('BbM7')).toEqual({ rootPc: 10, quality: 'maj7' });
    expect(parseChordSymbol('F#ø7')).toEqual({ rootPc: 6, quality: 'm7b5' });
    expect(parseChordSymbol('C-7')).toEqual({ rootPc: 0, quality: 'm7' });
    expect(parseChordSymbol('Cwat')).toBeNull();
  });

  it('collects chord pitch classes including extensions', () => {
    expect(chordPcs(2, 'm9').sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 9]);
  });
});

describe('progressions', () => {
  const F = { tonic: 'F', mode: 'major' } as const;

  it('reads roman numerals, with lowercase meaning minor', () => {
    expect(parseRoman('ii9')).toEqual({ root: 2, quality: 'm9' });
    expect(parseRoman('V13')).toEqual({ root: 7, quality: '13' });
    expect(parseRoman('bVIImaj7')).toEqual({ root: 10, quality: 'maj7' });
    expect(parseRoman('iv6')).toEqual({ root: 5, quality: 'm6' });
    expect(parseRoman('viiø7')).toEqual({ root: 11, quality: 'm7b5' });
  });

  it('mixes numerals, symbols, and lengths, relative to the key', () => {
    const prog = parseProgression('ii9:2 C13:2 | Imaj9', F);
    expect(prog).toEqual([
      { root: 2, quality: 'm9', beats: 2 },
      { root: 7, quality: '13', beats: 2 },
      { root: 0, quality: 'maj9', beats: 4 },
    ]);
    expect(progressionText(prog, F)).toBe('Gm9:2 C13:2 Fmaj9');
  });

  it('transposes with the key because roots are relative', () => {
    const prog = resolveProgression('jazzy-251', F);
    expect(progressionText(prog, { tonic: 'D', mode: 'major' })).toBe('Em9 A13 Dmaj9 Bm9');
  });

  it('explains what went wrong with a bad chord', () => {
    expect(() => parseProgression('ii9 Q7', F)).toThrow(/Q7/);
    expect(() => parseProgression('', F)).toThrow(/empty/);
  });

  it('finds the chord at any beat and loops short progressions', () => {
    const prog = parseProgression('ii9 V13', F);
    expect(chordAt(prog, 0).chord.quality).toBe('m9');
    expect(chordAt(prog, 5.5)).toMatchObject({ chord: { quality: '13' }, start: 4 });
    expect(chordAt(prog, 9)).toMatchObject({ chord: { quality: 'm9' }, start: 8 });
  });
});

describe('keys', () => {
  it('spells flat keys with flats', () => {
    expect(prefersFlats({ tonic: 'F', mode: 'major' })).toBe(true);
    expect(prefersFlats({ tonic: 'D', mode: 'minor' })).toBe(true);
    expect(prefersFlats({ tonic: 'A', mode: 'minor' })).toBe(false);
    expect(prefersFlats({ tonic: 'G', mode: 'major' })).toBe(false);
    expect(keyLabel({ tonic: 'eb', mode: 'major' })).toBe('Eb major');
  });
});
