import { describe, expect, it } from 'vitest';
import { candidateVoicings, chordPcs, mod12, movement, VOICING_RANGE, voiceChord } from '../src/index.ts';

describe('voicing', () => {
  it('only uses chord tones and stays in range', () => {
    for (const v of candidateVoicings(7, 'm9')) {
      expect(v[0]).toBeGreaterThanOrEqual(VOICING_RANGE[0] - 2);
      expect(v[v.length - 1]).toBeLessThanOrEqual(VOICING_RANGE[1]);
      for (const n of v) expect(chordPcs(7, 'm9')).toContain(mod12(n));
    }
  });

  it('moves less than block root-position chords through a 2-5-1', () => {
    const chords = [[7, 'm9'], [0, '13'], [5, 'maj9'], [2, 'm9']] as const;
    let prev: number[] | null = null;
    let led = 0;
    for (const [root, q] of chords) {
      const v = voiceChord(root, q, prev);
      if (prev) led += movement(v, prev);
      prev = v;
    }
    const block = chords.map(([root, q]) => chordPcs(root, q).slice(0, 4).map((pc) => 48 + pc + (pc < mod12(root) ? 12 : 0)));
    let blocky = 0;
    for (let i = 1; i < block.length; i++) blocky += movement(block[i]!, block[i - 1]!);
    expect(led).toBeLessThan(blocky);
    expect(led / 3).toBeLessThanOrEqual(4);
  });
});
