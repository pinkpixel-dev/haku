import { describe, expect, it } from 'vitest';
import { createProject } from '@haku/core';
import { execute } from '@haku/protocol';
import { analyzeScenes } from '../src/analyze.ts';

/** Two layers, each holding one note per bar, so every bar is one interval to judge. */
function clashesFor(pairs: [string, string][]) {
  let p = createProject({ mood: 'sunny-cafe', seed: 1, bars: pairs.length });
  p = execute(p, { type: 'set_project', humanize: 0 }).project;
  p = execute(p, { type: 'add_layer', instrument: 'piano', name: 'Low' }).project;
  p = execute(p, { type: 'add_layer', instrument: 'glock', name: 'High' }).project;
  const notes = (i: 0 | 1) => pairs.map((pair, bar) => ({ pitch: pair[i], beat: bar * 4, beats: 2 }));
  p = execute(p, { type: 'draw_melody', layer: 'Low', notes: notes(0) }).project;
  p = execute(p, { type: 'draw_melody', layer: 'High', notes: notes(1) }).project;
  return analyzeScenes(p, [p.activeSceneId])[0]!.clashes.map((c) => c.beat);
}

describe('clash detection', () => {
  it('flags minor 2nds and minor 9ths only', () => {
    const beats = clashesFor([
      ['E5', 'F5'], // minor 2nd
      ['E4', 'F5'], // minor 9th
      ['C5', 'B5'], // major 7th, sounds fine
      ['E4', 'F6'], // two octaves and a half step, too far apart to rub
    ]);
    expect(beats).toEqual([0, 4]);
  });
});

describe('out of key', () => {
  it("doesn't count notes borrowed from the chord underneath", () => {
    let p = createProject({ mood: 'sunny-cafe', seed: 1, bars: 1 });
    p = execute(p, { type: 'set_key', tonic: 'A', mode: 'minor' }).project;
    p = execute(p, { type: 'set_progression', progression: 'E7' }).project;
    p = execute(p, { type: 'add_layer', instrument: 'piano', name: 'Lead' }).project;
    // G# belongs to E7, Bb belongs to neither A minor nor E7.
    p = execute(p, { type: 'draw_melody', layer: 'Lead', notes: [{ pitch: 'G#4', beat: 0 }, { pitch: 'Bb4', beat: 2 }] }).project;
    const lead = analyzeScenes(p, [p.activeSceneId])[0]!.layers.find((l) => l.name === 'Lead')!;
    expect(lead.outOfKey).toBe(1);
  });
});
