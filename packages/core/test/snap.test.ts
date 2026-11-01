import { describe, expect, it } from 'vitest';
import { allowedPcs, beatStrength, chordPcs, mod12, scaleStep, snapPitch, type SnapContext } from '../src/index.ts';

const C = { tonic: 'C', mode: 'major' } as const;
const ctx = (over: Partial<SnapContext> = {}): SnapContext => ({
  key: C,
  chord: { root: 0, quality: 'maj7' },
  mode: 'smart',
  strength: 'strong',
  range: [48, 84],
  ...over,
});

describe('beat strength', () => {
  it('treats 1 and 3 as strong, 2 and 4 as medium, offbeats as weak', () => {
    expect([0, 1, 2, 3, 0.5, 4, 6.25].map(beatStrength)).toEqual(['strong', 'medium', 'strong', 'medium', 'weak', 'strong', 'weak']);
  });
});

describe('smart snapping', () => {
  it('lands strong-beat notes on chord tones', () => {
    const cmaj7 = chordPcs(0, 'maj7');
    for (let raw = 55; raw < 80; raw += 0.37) expect(cmaj7).toContain(mod12(snapPitch(raw, ctx())));
  });

  it('avoids the clashing fourth over a major chord on medium beats', () => {
    expect(allowedPcs(ctx({ strength: 'medium' }))).not.toContain(5);
    expect(allowedPcs(ctx({ strength: 'weak' }))).toContain(5);
    expect(snapPitch(65, ctx({ strength: 'medium' }))).not.toBe(65);
  });

  it('bends the scale to chords that borrow notes from outside the key', () => {
    // E13 over A minor brings in G#, F#, and C#. Their natural neighbors (G, F, C, A) drop out.
    const aMinorE13 = ctx({ key: { tonic: 'A', mode: 'minor' }, chord: { root: 7, quality: '13' }, strength: 'weak' });
    const allowed = allowedPcs(aMinorE13).sort((a, b) => a - b);
    expect(allowed).toEqual([1, 2, 4, 6, 8, 11]);
    // A chord that fits the key leaves the scale alone.
    expect(allowedPcs(ctx({ strength: 'weak' })).sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
    // Plain scale mode keeps the key's scale as asked.
    expect(allowedPcs({ ...aMinorE13, mode: 'scale' })).toContain(7);
  });

  it('treats long notes like strong beats', () => {
    expect(chordPcs(0, 'maj7')).toContain(mod12(snapPitch(62.2, ctx({ strength: 'weak', long: true }))));
  });

  it('stays inside the range', () => {
    expect(snapPitch(20, ctx())).toBeGreaterThanOrEqual(48);
    expect(snapPitch(120, ctx())).toBeLessThanOrEqual(84);
  });

  it('breaks ties toward the previous note', () => {
    // 62 sits between chord tones C (60) and E (64).
    expect(snapPitch(62, ctx({ prev: 64 }))).toBe(64);
    expect(snapPitch(62, ctx({ prev: 59 }))).toBe(60);
  });
});

describe('other harmony modes', () => {
  it('pentatonic and chromatic do what they say', () => {
    expect(allowedPcs(ctx({ mode: 'pentatonic' })).sort((a, b) => a - b)).toEqual([0, 2, 4, 7, 9]);
    expect(allowedPcs(ctx({ mode: 'pentatonic', key: { tonic: 'A', mode: 'minor' } })).sort((a, b) => a - b)).toEqual([0, 2, 4, 7, 9]);
    expect(snapPitch(61, ctx({ mode: 'chromatic' }))).toBe(61);
  });

  it('steps through the scale', () => {
    expect(scaleStep(60, 1, C)).toBe(62);
    expect(scaleStep(64, 1, C)).toBe(65);
    expect(scaleStep(60, -2, C)).toBe(57);
  });
});
