// The project file format. Zod is the single source of truth: the TypeScript types are inferred from it,
// and every file loaded from disk or sent over the bridge is validated against it.

import { z } from 'zod';
import { CHORD_QUALITIES, type ChordQuality } from '../theory/chords.ts';
import { MODES } from '../theory/scales.ts';
import {
  BASS_STYLES,
  BRUSH_IDS,
  CHORD_INSTRUMENTS,
  COMP_STYLES,
  DRUM_KITS,
  GROOVE_IDS,
  HARMONY_MODES,
  INSTRUMENT_IDS,
  RAIN_KINDS,
  WINDOW_SCENES,
} from './constants.ts';

const unit = z.number().min(0).max(1);

export const KeySchema = z.object({
  tonic: z.string().regex(/^[A-Ga-g][#b]?$/, 'Tonic should look like C, F#, or Bb'),
  mode: z.enum(MODES),
});

export const ChordRefSchema = z.object({
  root: z.number().int().min(0).max(11),
  quality: z.enum(CHORD_QUALITIES as [ChordQuality, ...ChordQuality[]]),
  beats: z.number().positive().max(32),
});

export const StrokePointSchema = z.object({
  x: unit,
  y: unit,
  /** Milliseconds since the stroke started. Drawing speed sets velocity when there's no pressure. */
  t: z.number().min(0),
  /** Pen pressure, 0 to 1. Leave it out for mouse input. */
  p: unit.optional(),
});

export const StrokeSchema = z.object({
  id: z.string(),
  brush: z.enum(BRUSH_IDS),
  /** Brush thickness, 0 to 1. Thicker strokes play softer and darker. */
  size: unit,
  points: z.array(StrokePointSchema).min(1),
  /** Exact strokes skip harmony snapping and land on the nearest semitone. Used by draw_melody. */
  exact: z.boolean().optional(),
});

export const LayerSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(40),
  instrument: z.enum(INSTRUMENT_IDS),
  color: z.string(),
  volume: unit,
  pan: z.number().min(-1).max(1),
  muted: z.boolean(),
  solo: z.boolean(),
  harmony: z.enum(HARMONY_MODES),
  octave: z.number().int().min(-2).max(2),
  kit: z.enum(DRUM_KITS),
  strokes: z.array(StrokeSchema),
});

export const BackingSchema = z.object({
  chords: z.object({
    enabled: z.boolean(),
    instrument: z.enum(CHORD_INSTRUMENTS),
    style: z.enum(COMP_STYLES),
    volume: unit,
  }),
  bass: z.object({ enabled: z.boolean(), style: z.enum(BASS_STYLES), volume: unit }),
  drums: z.object({ enabled: z.boolean(), groove: z.enum(GROOVE_IDS), volume: unit }),
});

export const SceneSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(40),
  bars: z.number().int().min(1).max(16),
  progression: z.array(ChordRefSchema).min(1),
  layers: z.array(LayerSchema),
  backing: BackingSchema,
});

export const MixSchema = z.object({
  master: unit,
  /** Low-pass and tape saturation. */
  warmth: unit,
  crackle: unit,
  reverb: unit,
  /** Tape wow and flutter. */
  wobble: unit,
  rain: z.object({ enabled: z.boolean(), kind: z.enum(RAIN_KINDS), level: unit }),
});

export const ProjectSchema = z.object({
  format: z.literal('haku'),
  version: z.literal(1),
  id: z.string(),
  name: z.string().min(1).max(80),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Seeds humanize and spray so the same project always plays the same way. */
  seed: z.number().int(),
  mood: z.string().nullable(),
  window: z.enum(WINDOW_SCENES),
  key: KeySchema,
  bpm: z.number().min(50).max(140),
  swing: unit,
  humanize: unit,
  mix: MixSchema,
  scenes: z.array(SceneSchema).min(1),
  arrangement: z.array(z.object({ sceneId: z.string(), repeat: z.number().int().min(1).max(16) })).min(1),
  activeSceneId: z.string(),
});

export type StrokePoint = z.infer<typeof StrokePointSchema>;
export type Stroke = z.infer<typeof StrokeSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type Backing = z.infer<typeof BackingSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Mix = z.infer<typeof MixSchema>;
export type Project = z.infer<typeof ProjectSchema>;
