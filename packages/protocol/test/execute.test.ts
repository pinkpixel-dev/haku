import { describe, expect, it } from 'vitest';
import { buildSceneScore, createProject, findLayer, noteName, parseProject } from '@haku/core';
import { execute, executeUnknown, type Command } from '../src/index.ts';

const fresh = () => createProject({ seed: 3, name: 'Exec test' });

/** Runs commands in order and returns the final result. */
function runAll(cmds: Command[], project = fresh()) {
  let result = { project, message: '' };
  for (const cmd of cmds) result = execute(result.project, cmd);
  return result;
}

describe('execute', () => {
  it('never mutates the input project', () => {
    const p = fresh();
    const before = structuredClone(p);
    execute(p, { type: 'set_project', bpm: 90 });
    execute(p, { type: 'draw_line', from: { x: 0, y: 0.5 }, to: { x: 1, y: 0.3 } });
    expect(p).toEqual(before);
  });

  it('keeps the project valid after a busy session', () => {
    const { project } = runAll([
      { type: 'set_mood', mood: 'late-night-train' },
      { type: 'set_key', tonic: 'eb', mode: 'dorian' },
      { type: 'add_layer', instrument: 'drums', name: 'Kit', kit: 'brushes' },
      { type: 'draw_shape', shape: 'wave', x: 0, y: 0.5, width: 1, height: 0.3, cycles: 3, layer: 'Kit' },
      { type: 'draw_curve', points: [{ x: 0, y: 0.6 }, { x: 0.5, y: 0.2 }, { x: 1, y: 0.5 }], brush: 'chalk' },
      { type: 'add_scene', name: 'B', copy_from: 'A', progression: 'i9 IV9' },
      { type: 'arrange', items: [{ scene: 'A', repeat: 2 }, { scene: 'B' }] },
      { type: 'mix', rain: { enabled: true, level: 0.6 }, crackle: 0.5 },
    ]);
    expect(() => parseProject(project)).not.toThrow();
    expect(project.key.tonic).toBe('Eb');
    expect(project.arrangement.map((a) => a.repeat)).toEqual([2, 1]);
  });

  it('reports what a drawn line plays', () => {
    const { message, data } = execute(fresh(), { type: 'draw_line', from: { x: 0, y: 0.7 }, to: { x: 0.25, y: 0.3 } });
    expect(message).toMatch(/Drew a pencil line on "Melody" \[k_\w+\]: \d+ notes \(pitch@beat\): [A-G]b?\d@0 /);
    expect((data as { notes: number }).notes).toBeGreaterThan(2);
  });

  it('writes exact melodies, including held notes', () => {
    const { project } = execute(fresh(), {
      type: 'draw_melody',
      notes: [
        { pitch: 'A4', beat: 0, beats: 2 },
        { pitch: 'C5', beat: 2, beats: 0.5 },
        { pitch: 74, beat: 3 },
      ],
    });
    const { layer } = findLayer(project);
    const notes = buildSceneScore({ ...project, swing: 0, humanize: 0 }).events.filter((e) => e.track === layer.id);
    expect(notes.map((n) => [noteName(n.midi), n.time, n.duration])).toEqual([
      ['A4', 0, 2],
      ['C5', 2, 0.5],
      ['D5', 3, 1],
    ]);
  });

  it('explains melody notes that do not fit', () => {
    expect(() => execute(fresh(), { type: 'draw_melody', notes: [{ pitch: 'C8', beat: 0 }] })).toThrow(/outside "Melody"/);
    expect(() => execute(fresh(), { type: 'draw_melody', notes: [{ pitch: 'A4', beat: 15, beats: 4 }] })).toThrow(/past the end/);
  });

  it('erases by id, region, or everything', () => {
    const a = execute(fresh(), { type: 'draw_line', from: { x: 0, y: 0.5 }, to: { x: 0.2, y: 0.5 } });
    const b = execute(a.project, { type: 'draw_line', from: { x: 0.6, y: 0.5 }, to: { x: 0.9, y: 0.5 } });
    const id = (a.data as { strokeId: string }).strokeId;
    expect(findLayer(execute(b.project, { type: 'erase', strokes: [id] }).project).layer.strokes).toHaveLength(1);
    expect(findLayer(execute(b.project, { type: 'erase', region: { x0: 0.5, x1: 1 } }).project).layer.strokes).toHaveLength(1);
    expect(findLayer(execute(b.project, { type: 'erase', all: true }).project).layer.strokes).toHaveLength(0);
  });

  it('copies scenes with fresh layer ids', () => {
    const { project } = runAll([{ type: 'add_scene', name: 'B', copy_from: 'A' }]);
    const [a, b] = project.scenes;
    expect(b!.layers[0]!.id).not.toBe(a!.layers[0]!.id);
    expect(project.activeSceneId).toBe(b!.id);
  });

  it('rejects malformed input with the path that failed', () => {
    expect(() => executeUnknown(fresh(), { type: 'set_project', bpm: 999 })).toThrow(/bpm/);
    expect(() => executeUnknown(fresh(), { type: 'dance' })).toThrow(/Bad command/);
    expect(() => execute(fresh(), { type: 'set_progression', progression: 'ii9 Zz' })).toThrow(/Zz/);
  });

  it('describes without changing the project', () => {
    const p = fresh();
    const { project, message } = execute(p, { type: 'describe' });
    expect(project.updatedAt).toBe(p.updatedAt);
    expect(message).toContain('Chords: Gm9 C13 Fmaj9 Dm9');
  });
});
