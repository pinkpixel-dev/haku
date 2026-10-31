// Turns a drawn stroke into notes.
//
// X is time: the canvas spans the scene's bars, read on the brush's grid (eighths for pencil, quarters
// for brush, sixteenths for stamp and spray). Y is pitch: the top of the canvas is the top of the
// instrument's range. Each grid column the stroke passes through becomes a note, snapped to the harmony
// at that moment. Drawing speed (or pen pressure) sets velocity, and brush size sets brightness.

import { BRUSHES, INSTRUMENTS, drumRows, DRUM_PIECES } from '../model/constants.ts';
import type { Layer, Stroke, StrokePoint } from '../model/schema.ts';
import { chordPcs, type ChordRef } from '../theory/chords.ts';
import { mod12 } from '../theory/notes.ts';
import { chordAt } from '../theory/progressions.ts';
import { tonicPc, type Key } from '../theory/scales.ts';
import { createRng, hashSeed, jitter, type Rng } from '../rng.ts';
import { classifyStroke, measureStroke } from './gestures.ts';
import { beatStrength, scaleStep, snapPitch } from './snap.ts';
import type { NoteEvent } from './types.ts';

export interface StrokeContext {
  key: Key;
  progression: readonly ChordRef[];
  bars: number;
  layer: Pick<Layer, 'id' | 'instrument' | 'harmony' | 'octave' | 'kit'>;
  seed: number;
}

interface Sample {
  col: number;
  y: number;
  /** Drawing speed around this point, in canvas widths per second. Null when timing is unknown. */
  speed: number | null;
  pressure?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function speedBetween(a: StrokePoint, b: StrokePoint): number | null {
  const dt = (b.t - a.t) / 1000;
  return dt > 0 ? Math.hypot(b.x - a.x, b.y - a.y) / dt : null;
}

/** Walks the stroke and records the y value at the center of every grid column it crosses. */
export function sampleColumns(points: readonly StrokePoint[], columns: number): Sample[] {
  const colOf = (x: number) => clamp(Math.floor(x * columns), 0, columns - 1);
  const samples: Sample[] = [];
  const push = (s: Sample) => {
    if (samples.length === 0 || samples[samples.length - 1]!.col !== s.col) samples.push(s);
  };
  const first = points[0]!;
  push({ col: colOf(first.x), y: first.y, speed: points[1] ? speedBetween(first, points[1]) : null, pressure: first.p });

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const dx = b.x - a.x;
    if (Math.abs(dx) < 1e-9) continue;
    const speed = speedBetween(a, b);
    const from = colOf(a.x);
    const to = colOf(b.x);
    const step = to >= from ? 1 : -1;
    for (let c = from; c !== to + step; c += step) {
      const center = (c + 0.5) / columns;
      const f = (center - a.x) / dx;
      if (f < 0 || f > 1) continue;
      const pressure = a.p === undefined || b.p === undefined ? undefined : a.p + (b.p - a.p) * f;
      push({ col: c, y: a.y + (b.y - a.y) * f, speed, pressure });
    }
  }
  const last = points[points.length - 1]!;
  if (points.length > 1) push({ col: colOf(last.x), y: last.y, speed: null, pressure: last.p });
  return samples;
}

function velocityFor(sample: Pick<Sample, 'speed' | 'pressure'>, base: number, size: number): number {
  let v: number;
  if (sample.pressure !== undefined) v = 0.25 + 0.7 * sample.pressure;
  else if (sample.speed === null) v = base;
  // Slow, careful strokes play softly. Quick ones dig in a bit.
  else v = base * (0.75 + 0.5 * clamp(sample.speed / 1.2, 0, 1));
  return clamp(v * (1 - 0.25 * size), 0.15, 1);
}

export function layerRange(layer: StrokeContext['layer']): [number, number] {
  const [lo, hi] = INSTRUMENTS[layer.instrument].range;
  return [lo + layer.octave * 12, hi + layer.octave * 12];
}

/** The continuous pitch a y position points at, before snapping. */
export function yToPitch(y: number, range: readonly [number, number]): number {
  return range[1] - clamp(y, 0, 1) * (range[1] - range[0]);
}

/** The y position that reads back as this exact pitch. */
export function pitchToY(midi: number, range: readonly [number, number]): number {
  return clamp((range[1] - midi) / (range[1] - range[0]), 0, 1);
}

export function strokeToNotes(stroke: Stroke, ctx: StrokeContext): NoteEvent[] {
  if (INSTRUMENTS[ctx.layer.instrument].kind === 'drums') return drumStrokeToNotes(stroke, ctx);

  const brush = BRUSHES[stroke.brush];
  const spb = stroke.exact ? 4 : brush.stepsPerBeat;
  const totalBeats = ctx.bars * 4;
  const columns = totalBeats * spb;
  const stepLen = 1 / spb;
  const range = layerRange(ctx.layer);
  const brightness = clamp(1 - stroke.size * 0.7, 0, 1);
  const rng = createRng(hashSeed(ctx.seed, stroke.id));
  const base = { track: ctx.layer.id, instrument: ctx.layer.instrument, source: 'stroke' as const, brightness, strokeId: stroke.id };
  const note = (time: number, duration: number, midi: number, velocity: number): NoteEvent => ({ ...base, time, duration, midi, velocity });

  const snapAt = (beat: number, raw: number, prev?: number, long = false) => {
    if (stroke.exact) return clamp(Math.round(raw), 0, 127);
    return snapPitch(raw, {
      key: ctx.key,
      chord: chordAt(ctx.progression, beat).chord,
      mode: ctx.layer.harmony,
      strength: beatStrength(beat),
      long,
      range,
      prev,
    });
  };

  const gesture = classifyStroke(stroke);
  const shape = measureStroke(stroke);
  const firstVel = velocityFor({ speed: null, pressure: stroke.points[0]!.p }, brush.velocity, stroke.size);

  if (gesture === 'dot') {
    const p = stroke.points[0]!;
    const beat = Math.floor(clamp(p.x, 0, 0.9999) * columns) / spb;
    const len = stroke.brush === 'brush' ? 1 : stepLen;
    return [note(beat, len, snapAt(beat, yToPitch(p.y, range), undefined, len >= 1), firstVel)];
  }

  if (gesture === 'strum') {
    const beat = Math.floor(clamp((shape.minX + shape.maxX) / 2, 0, 0.9999) * columns) / spb;
    const { chord, start } = chordAt(ctx.progression, beat);
    const pcs = new Set(chordPcs(mod12(tonicPc(ctx.key) + chord.root), chord.quality));
    const top = Math.round(yToPitch(shape.minY, range));
    const bottom = Math.round(yToPitch(shape.maxY, range));
    const pitches: number[] = [];
    for (let n = bottom; n <= top; n++) if (pcs.has(mod12(n))) pitches.push(n);
    // Drawn upward (y shrinking) strums low to high, like a guitar downstroke.
    const upward = stroke.points[stroke.points.length - 1]!.y < stroke.points[0]!.y;
    if (!upward) pitches.reverse();
    const hold = Math.max(stepLen, Math.min(2, start + chord.beats - beat));
    return pitches.slice(0, 6).map((m, i) => note(beat + i * 0.04, hold - i * 0.04, m, firstVel * (1 - i * 0.04)));
  }

  if (gesture === 'trill') {
    const startCol = Math.floor(clamp(shape.minX, 0, 0.9999) * totalBeats * 4);
    const endCol = Math.max(startCol + 1, Math.ceil(clamp(shape.maxX, 0, 1) * totalBeats * 4));
    const startBeat = startCol / 4;
    const low = snapAt(startBeat, yToPitch((shape.minY + shape.maxY) / 2, range));
    const high = scaleStep(low, 1, ctx.key);
    const out: NoteEvent[] = [];
    for (let c = startCol; c < endCol; c++) out.push(note(c / 4, 0.25, (c - startCol) % 2 === 0 ? low : high, firstVel * 0.85));
    return out;
  }

  if (gesture === 'flick') {
    const end = stroke.points[stroke.points.length - 1]!;
    const beat = Math.floor(clamp(end.x, 0, 0.9999) * columns) / spb;
    const main = snapAt(beat, yToPitch(end.y, range), undefined, true);
    const rising = end.y < stroke.points[0]!.y;
    const grace = scaleStep(main, rising ? -1 : 1, ctx.key);
    const v = clamp(firstVel * 1.15, 0, 1);
    const graceTime = Math.max(0, beat - 0.125);
    return [note(graceTime, beat - graceTime || 0.125, grace, v * 0.7), note(beat, stepLen * 2, main, v)];
  }

  // A plain line: one sample per grid column.
  const samples = sampleColumns(stroke.points, columns);
  const out: NoteEvent[] = [];
  let prev: number | undefined;
  let lastCol = -2;
  let melody: NoteEvent | undefined;
  let harmony: NoteEvent | undefined;
  for (const s of samples) {
    const beat = s.col / spb;
    const v = velocityFor(s, brush.velocity, stroke.size);

    if (stroke.brush === 'spray') {
      if (rng() > 0.6) continue;
      const raw = yToPitch(s.y, range) + jitter(rng) * 4;
      out.push(note(beat, stepLen, snapAt(beat, raw), v * (0.7 + rng() * 0.4)));
      continue;
    }

    const midi = snapAt(beat, yToPitch(s.y, range), prev, stroke.brush === 'brush');
    if (melody && stroke.brush !== 'stamp' && s.col === lastCol + 1 && melody.midi === midi) {
      // Same pitch in the next column: hold the note instead of repeating it.
      melody.duration += stepLen;
      if (harmony) harmony.duration = melody.duration;
    } else {
      melody = note(beat, stepLen, midi, v);
      out.push(melody);
      harmony = undefined;
      if (stroke.brush === 'chalk') {
        const below = chordToneBelow(midi, beat, ctx);
        if (below !== null) out.push((harmony = note(beat, stepLen, below, v * 0.8)));
      }
    }
    prev = midi;
    lastCol = s.col;
  }
  return out;
}

/** The closest chord tone at least a minor third below, for chalk harmonies. */
function chordToneBelow(midi: number, beat: number, ctx: StrokeContext): number | null {
  const { chord } = chordAt(ctx.progression, beat);
  const pcs = new Set(chordPcs(mod12(tonicPc(ctx.key) + chord.root), chord.quality));
  for (let n = midi - 3; n >= midi - 9; n--) if (pcs.has(mod12(n))) return n;
  return null;
}

/** Drum layers split the canvas into rows, one per drum, bottom to top. */
function drumStrokeToNotes(stroke: Stroke, ctx: StrokeContext): NoteEvent[] {
  const brush = BRUSHES[stroke.brush];
  const columns = ctx.bars * 4 * brush.stepsPerBeat;
  const rows = drumRows(ctx.layer.kit);
  const rng = createRng(hashSeed(ctx.seed, stroke.id));
  const brightness = clamp(1 - stroke.size * 0.7, 0, 1);
  const samples = classifyStroke(stroke) === 'dot' ? sampleColumns(stroke.points.slice(0, 1), columns) : sampleColumns(stroke.points, columns);
  const out: NoteEvent[] = [];
  for (const s of samples) {
    // Spray on drums makes ghost notes: some steps skipped, the rest quiet.
    if (stroke.brush === 'spray' && rng() > 0.55) continue;
    const piece = rows[clamp(Math.floor((1 - s.y) * rows.length), 0, rows.length - 1)]!;
    const v = velocityFor(s, brush.velocity, stroke.size) * (stroke.brush === 'spray' ? 0.55 : 1);
    out.push({
      time: s.col / brush.stepsPerBeat,
      duration: 0.25,
      midi: DRUM_PIECES[piece].gm,
      velocity: v,
      track: ctx.layer.id,
      instrument: 'drums',
      source: 'stroke',
      drum: piece,
      brightness,
      strokeId: stroke.id,
    });
  }
  return out;
}
