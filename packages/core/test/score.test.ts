import { describe, expect, it } from 'vitest';
import {
  buildArrangementScore,
  buildSceneScore,
  createProject,
  createScene,
  describeProject,
  linePath,
  makeId,
  Midi,
  parseProject,
  scoreToMidi,
  swingTime,
  timePoints,
  type Project,
} from '../src/index.ts';

function demo(seed = 1): Project {
  const p = createProject({ seed, name: 'Test loop' });
  p.scenes[0]!.layers[0]!.strokes.push({
    id: 'k_fixed',
    brush: 'pencil',
    size: 0.2,
    points: timePoints(linePath({ x: 0, y: 0.7 }, { x: 0.99, y: 0.3 }), 3000),
  });
  return p;
}

describe('project model', () => {
  it('creates valid projects from every mood', () => {
    for (const mood of ['rainy-study', 'late-night-train', 'sunny-cafe', 'dusk-walk', 'snowy-window'] as const) {
      expect(() => parseProject(createProject({ mood }))).not.toThrow();
    }
  });

  it('rejects broken files with a readable message', () => {
    const p = demo();
    expect(() => parseProject({ ...p, bpm: 400 })).toThrow(/bpm/);
    expect(() => parseProject({ hello: 'world' })).toThrow(/Not a valid Haku project/);
  });
});

describe('scores', () => {
  it('is deterministic for a given seed and changes with another seed', () => {
    const p = demo(1);
    expect(buildSceneScore(structuredClone(p)).events).toEqual(buildSceneScore(p).events);
    expect(buildSceneScore({ ...p, seed: 2 }).events).not.toEqual(buildSceneScore(p).events);
  });

  it('includes drawn notes plus the backing band', () => {
    const sources = new Set(buildSceneScore(demo()).events.map((e) => e.source));
    expect(sources).toEqual(new Set(['stroke', 'chords', 'bass', 'drums']));
  });

  it('keeps everything inside the scene', () => {
    const s = buildSceneScore(demo());
    for (const e of s.events) {
      expect(e.time).toBeGreaterThanOrEqual(0);
      expect(e.time + e.duration).toBeLessThanOrEqual(s.beats + 0.05);
    }
  });

  it('solo silences everything else, including the backing', () => {
    const p = demo();
    const extra = { ...p.scenes[0]!.layers[0]!, id: 'l_two', name: 'Two', solo: true, strokes: [] };
    p.scenes[0]!.layers.push(extra);
    expect(buildSceneScore(p).events).toHaveLength(0);
  });

  it('swings offbeat sixteenths only', () => {
    expect(swingTime(0.25, 1)).toBeCloseTo(1 / 3);
    expect(swingTime(0.5, 1)).toBe(0.5);
    expect(swingTime(2.75, 0.5)).toBeCloseTo(2.75 + (1 / 3 - 0.25) / 2);
  });

  it('lays out the arrangement with repeats and varies each pass', () => {
    const p = demo();
    const b = createScene(p, 'B', 2);
    p.scenes.push(b);
    p.arrangement = [
      { sceneId: p.scenes[0]!.id, repeat: 2 },
      { sceneId: b.id, repeat: 1 },
    ];
    const s = buildArrangementScore(p);
    expect(s.beats).toBe(16 * 2 + 8);
    expect(s.sections.map((x) => x.start)).toEqual([0, 16, 32]);
    const pass1 = s.events.filter((e) => e.time < 16 && e.source === 'drums').map((e) => e.velocity);
    const pass2 = s.events.filter((e) => e.time >= 16 && e.time < 32 && e.source === 'drums').map((e) => e.velocity);
    expect(pass1).not.toEqual(pass2);
  });
});

describe('describe', () => {
  it('summarizes chords, layers, and a piano roll', () => {
    const text = describeProject(demo());
    expect(text).toContain('F major');
    expect(text).toContain('Gm9 C13 Fmaj9 Dm9');
    expect(text).toMatch(/Layer "Melody" \[l_\w+\]/);
    expect(text).toMatch(/\|[o.-]{8}\|/);
  });
});

describe('midi export', () => {
  it('writes a file with a track per part and drums on channel 10', () => {
    const p = demo();
    const score = buildSceneScore(p);
    const midi = new Midi(scoreToMidi(p, score));
    expect(midi.header.tempos[0]!.bpm).toBeCloseTo(p.bpm);
    expect(midi.tracks.map((t) => t.name).sort()).toEqual(['Bass', 'Chords', 'Drums', 'Melody']);
    expect(midi.tracks.find((t) => t.name === 'Drums')!.channel).toBe(9);
    expect(midi.tracks.reduce((s, t) => s + t.notes.length, 0)).toBe(score.events.length);
  });
});

describe('ids', () => {
  it('makes short prefixed ids', () => {
    expect(makeId('l')).toMatch(/^l_[0-9a-z]{6}$/);
  });
});
