import { describe, expect, it } from 'vitest';
import { createProject } from '@haku/core';
import { execute, type Command } from '@haku/protocol';
import { HISTORY_LIMIT, initHistory, mergeKey, record, redo, undo, type History } from '../src/state/history.ts';

const apply = (h: History, cmd: Command, at: number) => record(h, cmd, execute(h.present, cmd).project, at);

describe('history', () => {
  const base = () => initHistory(createProject({ seed: 1 }));

  it('undoes and redoes a stroke', () => {
    let h = apply(base(), { type: 'draw_line', from: { x: 0, y: 0.5 }, to: { x: 1, y: 0.5 } }, 0);
    expect(h.present.scenes[0]!.layers[0]!.strokes).toHaveLength(1);
    h = undo(h);
    expect(h.present.scenes[0]!.layers[0]!.strokes).toHaveLength(0);
    h = redo(h);
    expect(h.present.scenes[0]!.layers[0]!.strokes).toHaveLength(1);
  });

  it('merges a slider drag into one step', () => {
    let h = base();
    for (let i = 0; i < 10; i++) h = apply(h, { type: 'mix', warmth: i / 10 }, i * 50);
    expect(h.past).toHaveLength(1);
    expect(undo(h).present.mix.warmth).toBe(base().present.mix.warmth);
  });

  it('starts a new step after a pause or a different control', () => {
    let h = apply(base(), { type: 'mix', warmth: 0.2 }, 0);
    h = apply(h, { type: 'mix', warmth: 0.3 }, 2000);
    h = apply(h, { type: 'mix', reverb: 0.3 }, 2100);
    expect(h.past).toHaveLength(3);
  });

  it('never merges two strokes, even back to back', () => {
    const line: Command = { type: 'draw_line', from: { x: 0, y: 0.5 }, to: { x: 1, y: 0.5 } };
    let h = apply(base(), line, 0);
    h = apply(h, line, 10);
    expect(h.past).toHaveLength(2);
    expect(mergeKey(line)).toBeNull();
  });

  it("doesn't record scene selection, but keeps the viewed scene across undo", () => {
    let h = apply(base(), { type: 'add_scene', name: 'B', select: false }, 0);
    const b = h.present.scenes[1]!.id;
    h = apply(h, { type: 'select_scene', scene: b }, 100);
    expect(h.past).toHaveLength(1);
    h = apply(h, { type: 'set_project', bpm: 90 }, 200);
    h = undo(h);
    expect(h.present.bpm).not.toBe(90);
    expect(h.present.activeSceneId).toBe(b);
  });

  it('drops the redo stack on a new edit and caps the past', () => {
    let h = base();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = apply(h, { type: 'draw_line', from: { x: 0, y: 0.5 }, to: { x: 1, y: i / 200 } }, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    h = apply(undo(h), { type: 'set_project', bpm: 80 }, 1e6);
    expect(h.future).toHaveLength(0);
  });
});
