import { describe, expect, it } from 'vitest';
import {
  chordAt,
  chordPcs,
  classifyStroke,
  linePath,
  mod12,
  parseProgression,
  pitchToY,
  scalePcs,
  shapePath,
  strokeToNotes,
  timePoints,
  type Stroke,
  type StrokeContext,
} from '../src/index.ts';

const key = { tonic: 'F', mode: 'major' } as const;
const progression = parseProgression('ii9 V13 Imaj9 vi9', key);
const ctx = (instrument: StrokeContext['layer']['instrument'] = 'piano', over: Partial<StrokeContext['layer']> = {}): StrokeContext => ({
  key,
  progression,
  bars: 4,
  seed: 7,
  layer: { id: 'l1', instrument, harmony: 'smart', octave: 0, kit: 'sticks', ...over },
});

let n = 0;
const stroke = (points: Stroke['points'], over: Partial<Stroke> = {}): Stroke => ({ id: `k${n++}`, brush: 'pencil', size: 0.3, points, ...over });
const line = (x0: number, y0: number, x1: number, y1: number, ms = 2000, p?: number) => timePoints(linePath({ x: x0, y: y0 }, { x: x1, y: y1 }), ms, p);

describe('gestures', () => {
  it('recognizes dots, strums, trills, flicks, and lines', () => {
    expect(classifyStroke(stroke([{ x: 0.3, y: 0.3, t: 0 }]))).toBe('dot');
    expect(classifyStroke(stroke(line(0.3, 0.7, 0.302, 0.4)))).toBe('strum');
    expect(classifyStroke(stroke(timePoints(shapePath('zigzag', { x: 0.4, y: 0.5, width: 0.08, height: 0.04, cycles: 3 }), 500)))).toBe('trill');
    expect(classifyStroke(stroke(line(0.3, 0.5, 0.36, 0.45, 90)))).toBe('flick');
    expect(classifyStroke(stroke(line(0.1, 0.5, 0.6, 0.3)))).toBe('line');
    // Stamps are always literal.
    expect(classifyStroke(stroke(line(0.3, 0.7, 0.302, 0.4), { brush: 'stamp' }))).toBe('line');
  });
});

describe('strokeToNotes', () => {
  it('holds a flat line as long notes instead of repeating them', () => {
    // Bar 1 only, over Gm9. A flat line still changes pitch where the beat strength changes,
    // but it should be far fewer notes than eighth-note columns.
    const notes = strokeToNotes(stroke(line(0.0, 0.5, 0.249, 0.5)), ctx());
    expect(notes.length).toBeLessThan(8);
    expect(notes.reduce((s, e) => s + e.duration, 0)).toBeCloseTo(4, 5);
  });

  it('keeps every note in the key and puts strong beats on chord tones', () => {
    const notes = strokeToNotes(stroke(line(0.0, 0.9, 0.999, 0.1, 4000)), ctx());
    const scale = scalePcs(key);
    expect(notes.length).toBeGreaterThan(10);
    for (const e of notes) {
      const chord = chordAt(progression, e.time).chord;
      const pcs = chordPcs(mod12(5 + chord.root), chord.quality);
      expect([...scale, ...pcs]).toContain(mod12(e.midi));
      if (e.time % 2 === 0) expect(pcs).toContain(mod12(e.midi));
    }
    // Drawn upward, so it should mostly rise.
    expect(notes[notes.length - 1]!.midi).toBeGreaterThan(notes[0]!.midi + 12);
  });

  it('plays a dot as one note at its grid position', () => {
    const notes = strokeToNotes(stroke([{ x: 0.5, y: 0.4, t: 0 }]), ctx());
    expect(notes).toHaveLength(1);
    expect(notes[0]!.time).toBe(8);
  });

  it('strums the chord tones a vertical line covers', () => {
    const notes = strokeToNotes(stroke(line(0.26, 0.9, 0.262, 0.2, 300)), ctx());
    const c13 = chordPcs(0, '13');
    expect(notes.length).toBeGreaterThanOrEqual(3);
    for (const e of notes) expect(c13).toContain(mod12(e.midi));
    // Drawn upward: low to high, slightly staggered.
    expect(notes[1]!.midi).toBeGreaterThan(notes[0]!.midi);
    expect(notes[1]!.time).toBeGreaterThan(notes[0]!.time);
  });

  it('lets exact strokes keep their pitch', () => {
    const range = [55, 84] as const;
    const y = pitchToY(66, range);
    const notes = strokeToNotes(stroke(line(0, y, 0.06, y), { exact: true }), ctx());
    expect(notes.map((e) => e.midi)).toEqual([66]);
  });

  it('plays harder with more pressure and with faster strokes', () => {
    const soft = strokeToNotes(stroke(line(0, 0.5, 0.1, 0.5, 2000, 0.1)), ctx())[0]!;
    const hard = strokeToNotes(stroke(line(0, 0.5, 0.1, 0.5, 2000, 0.9)), ctx())[0]!;
    expect(hard.velocity).toBeGreaterThan(soft.velocity);
    const slow = strokeToNotes(stroke(line(0, 0.5, 0.2, 0.2, 4000)), ctx())[1]!;
    const fast = strokeToNotes(stroke(line(0, 0.5, 0.2, 0.2, 150)), ctx())[1]!;
    expect(fast.velocity).toBeGreaterThan(slow.velocity);
  });

  it('adds a harmony note under chalk strokes', () => {
    const notes = strokeToNotes(stroke(line(0, 0.4, 0.06, 0.4), { brush: 'chalk' }), ctx());
    const times = new Set(notes.map((e) => e.time));
    expect(notes.length).toBeGreaterThan(times.size);
  });

  it('reads drum layers as rows, kick at the bottom', () => {
    const kick = strokeToNotes(stroke([{ x: 0.1, y: 0.95, t: 0 }]), ctx('drums'));
    const ride = strokeToNotes(stroke([{ x: 0.1, y: 0.05, t: 0 }]), ctx('drums'));
    expect(kick[0]!.drum).toBe('kick');
    expect(ride[0]!.drum).toBe('ride');
    const hats = strokeToNotes(stroke(line(0, 0.4, 0.249, 0.4), { brush: 'stamp' }), ctx('drums'));
    expect(hats.every((h) => h.drum === 'hat')).toBe(true);
    expect(hats).toHaveLength(16);
    const brushes = strokeToNotes(stroke([{ x: 0.1, y: 0.6, t: 0 }]), ctx('drums', { kit: 'brushes' }));
    expect(brushes[0]!.drum).toBe('brush');
  });

  it('is deterministic for spray', () => {
    const s = stroke(line(0, 0.5, 0.5, 0.3), { brush: 'spray' });
    expect(strokeToNotes(s, ctx())).toEqual(strokeToNotes(s, ctx()));
  });
});
