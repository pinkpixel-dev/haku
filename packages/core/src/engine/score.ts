// Builds the full score for a scene or the whole arrangement. Both the browser and the CLI
// play from this, so a project sounds the same wherever it's rendered.

import type { Project, Scene } from '../model/schema.ts';
import { findScene } from '../model/project.ts';
import { chordPcs, chordSymbol } from '../theory/chords.ts';
import { prefersFlats } from '../theory/scales.ts';
import { hashSeed } from '../rng.ts';
import { bassLine, compChords, drumPart, placeChords } from './backing.ts';
import { applyGrooveLag } from './grooves.ts';
import { applyHumanize, applySwing } from './humanize.ts';
import { strokeToNotes } from './strokes.ts';
import type { ChordEvent, NoteEvent, Score } from './types.ts';

export interface Carry {
  voicing: number[] | null;
  bassLast: number;
}

export const newCarry = (): Carry => ({ voicing: null, bassLast: 40 });

/** Which layers are audible: if anything is soloed, only soloed layers play (and the backing sits out). */
export function audibleLayers(scene: Scene) {
  const anySolo = scene.layers.some((l) => l.solo);
  return { layers: scene.layers.filter((l) => (anySolo ? l.solo : !l.muted)), backing: !anySolo };
}

export function sceneEvents(
  project: Project,
  scene: Scene,
  { offset = 0, pass = 0, carry = newCarry() }: { offset?: number; pass?: number; carry?: Carry } = {},
): { events: NoteEvent[]; chords: ChordEvent[] } {
  const totalBeats = scene.bars * 4;
  const events: NoteEvent[] = [];
  const { layers, backing } = audibleLayers(scene);

  for (const layer of layers) {
    for (const stroke of layer.strokes) {
      events.push(...strokeToNotes(stroke, { key: project.key, progression: scene.progression, bars: scene.bars, layer, seed: project.seed }));
    }
  }

  const placed = placeChords(scene.progression, project.key, totalBeats);
  if (backing) {
    const b = scene.backing;
    if (b.chords.enabled) {
      const v = { voicing: carry.voicing };
      events.push(...compChords(placed, b.chords, v));
      carry.voicing = v.voicing;
    }
    if (b.bass.enabled) {
      const c = { last: carry.bassLast };
      events.push(...bassLine(placed, b.bass.style, c));
      carry.bassLast = c.last;
    }
    if (b.drums.enabled) events.push(...drumPart(b.drums.groove, totalBeats));
  }

  // Nothing rings past the end of the scene.
  const kept = events.filter((e) => e.time < totalBeats);
  for (const e of kept) e.duration = Math.min(e.duration, totalBeats - e.time);

  applySwing(kept, project.swing);
  if (backing && scene.backing.drums.enabled) applyGrooveLag(kept, scene.backing.drums.groove);
  applyHumanize(kept, project.humanize, hashSeed(project.seed, scene.id), pass);
  for (const e of kept) e.time += offset;

  const flats = prefersFlats(project.key);
  const chords: ChordEvent[] = placed.map((p) => ({
    time: p.start + offset,
    duration: p.beats,
    symbol: chordSymbol(p.chord, project.key, flats),
    rootPc: p.rootPc,
    pcs: chordPcs(p.rootPc, p.chord.quality),
  }));
  return { events: kept.sort((a, b) => a.time - b.time || a.midi - b.midi), chords };
}

/** One scene on its own, the way the canvas loops it. */
export function buildSceneScore(project: Project, sceneId?: string): Score {
  const scene = findScene(project, sceneId);
  const { events, chords } = sceneEvents(project, scene);
  return {
    bpm: project.bpm,
    beats: scene.bars * 4,
    events,
    chords,
    sections: [{ sceneId: scene.id, name: scene.name, start: 0, beats: scene.bars * 4 }],
  };
}

/** The whole song: every arrangement entry, repeats included. */
export function buildArrangementScore(project: Project): Score {
  const carry = newCarry();
  const score: Score = { bpm: project.bpm, beats: 0, events: [], chords: [], sections: [] };
  for (const item of project.arrangement) {
    const scene = findScene(project, item.sceneId);
    for (let pass = 0; pass < item.repeat; pass++) {
      const { events, chords } = sceneEvents(project, scene, { offset: score.beats, pass, carry });
      score.events.push(...events);
      score.chords.push(...chords);
      score.sections.push({ sceneId: scene.id, name: scene.name, start: score.beats, beats: scene.bars * 4 });
      score.beats += scene.bars * 4;
    }
  }
  return score;
}
