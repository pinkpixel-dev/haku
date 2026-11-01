import { describe, expect, it } from 'vitest';
import {
  buildSceneScore,
  chordPcs,
  createProject,
  GROOVE_IDS,
  GROOVES,
  mod12,
  swingTime,
  voicingIntervals,
  type CompStyle,
  type GrooveId,
  type Project,
} from '../src/index.ts';

/** A one-scene project with only the band playing, and no humanize so timing is exact. */
function band(opts: { groove?: GrooveId; style?: CompStyle; swing?: number } = {}): Project {
  const p = createProject({ seed: 3, bars: 4 });
  p.humanize = 0;
  p.swing = opts.swing ?? 0;
  const s = p.scenes[0]!;
  s.layers = [];
  s.backing.chords.enabled = true;
  s.backing.drums.enabled = true;
  if (opts.groove) s.backing.drums.groove = opts.groove;
  if (opts.style) s.backing.chords.style = opts.style;
  return p;
}

const drums = (p: Project) => buildSceneScore(p).events.filter((e) => e.track === 'backing:drums');
const chords = (p: Project) => buildSceneScore(p).events.filter((e) => e.track === 'backing:chords');

describe('grooves', () => {
  it('gives every groove a turnaround bar', () => {
    for (const id of GROOVE_IDS) expect(GROOVES[id].turnaround, id).toBeDefined();
  });

  it('drags the lazy kick and snare behind the grid, and leaves the shaker on it', () => {
    const lag = GROOVES['lazy-kick'].lag!;
    const hits = drums(band({ groove: 'lazy-kick' }));
    const offGrid = (piece: string) => hits.filter((e) => e.drum === piece).map((e) => +((e.time * 4) % 1 / 4).toFixed(4));
    expect(new Set(offGrid('kick'))).toEqual(new Set([lag.kick]));
    expect(new Set(offGrid('snare'))).toEqual(new Set([lag.snare]));
    expect(new Set(offGrid('shaker'))).toEqual(new Set([0]));
  });

  it('swings a lagged kick first, then pushes it late', () => {
    const lag = GROOVES['lazy-kick'].lag!.kick!;
    const swung = drums(band({ groove: 'lazy-kick', swing: 1 })).filter((e) => e.drum === 'kick');
    // The kick on the "e" of beat 4 (step 13) is an offbeat sixteenth, so it swings.
    expect(swung.some((e) => Math.abs(e.time - (swingTime(3.25, 1) + lag)) < 1e-9)).toBe(true);
  });

  it('adds the cabasa to the bossa', () => {
    expect(drums(band({ groove: 'bossa' })).some((e) => e.drum === 'cabasa')).toBe(true);
  });
});

describe('comping styles', () => {
  it('voices shells without the root when three or more notes are left', () => {
    expect(voicingIntervals('m9', true)).toEqual([3, 10, 14, 7]);
    expect(voicingIntervals('maj7', true)).toEqual([4, 11, 7]);
    // A plain triad would be down to two notes, so it keeps its root.
    expect(voicingIntervals('maj', true)).toEqual([0, 4, 7]);
  });

  it('comps shells on the Charleston, leaving 7th-chord roots to the bass', () => {
    const p = band({ style: 'shells' });
    const s = p.scenes[0]!;
    const notes = chords(p);
    const onsets = [...new Set(notes.map((e) => +(e.time % 4).toFixed(1)))].sort();
    expect(onsets).toEqual([0, 1.5]);
    // The progression loops across the scene, so chord i is progression entry i mod length.
    for (const [i, c] of buildSceneScore(p).chords.entries()) {
      const quality = s.progression[i % s.progression.length]!.quality;
      if (voicingIntervals(quality, true).length === voicingIntervals(quality).length) continue;
      const atChord = notes.filter((e) => e.time >= c.time && e.time < c.time + c.duration);
      for (const e of atChord) expect(mod12(e.midi), `${c.symbol}`).not.toBe(c.rootPc);
      for (const e of atChord) expect(chordPcs(c.rootPc, quality)).toContain(mod12(e.midi));
    }
  });

  it('rolls chords slowly from the bottom up, twice a bar', () => {
    const notes = chords(band({ style: 'rolled' }));
    const first = notes.filter((e) => e.time < 1).sort((a, b) => a.time - b.time);
    expect(first.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < first.length; i++) {
      expect(first[i]!.time - first[i - 1]!.time).toBeCloseTo(0.08, 6);
      expect(first[i]!.midi).toBeGreaterThan(first[i - 1]!.midi);
    }
    expect(notes.some((e) => Math.abs(e.time - 2.5) < 1e-9)).toBe(true);
  });
});
