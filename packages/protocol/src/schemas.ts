// Every change to a project is one of these commands. The web app, the CLI, and the MCP server all
// send the same shapes, and execute() is the only thing that applies them. Descriptions here double
// as the help text agents see.

import { z } from 'zod';
import {
  BASS_STYLES,
  BRUSH_IDS,
  CHORD_INSTRUMENTS,
  COMP_STYLES,
  DRUM_KITS,
  GROOVE_IDS,
  HARMONY_MODES,
  INSTRUMENT_IDS,
  MODES,
  MOOD_IDS,
  RAIN_KINDS,
  SHAPES,
  WINDOW_SCENES,
} from '@haku/core';

const unit = z.number().min(0).max(1);
const point = z.object({ x: unit.describe('0 is the start of the scene, 1 the end'), y: unit.describe('0 is the top (high notes), 1 the bottom') });

const target = {
  scene: z.string().optional().describe('Scene id or name. Defaults to the active scene.'),
  layer: z.string().optional().describe('Layer id or name. Defaults to the first melodic layer.'),
};

const pen = {
  ...target,
  brush: z.enum(BRUSH_IDS).optional().describe('pencil: eighth-note melody. brush: long soft notes. chalk: two-note harmonies. spray: scattered sparkles. stamp: one hit per sixteenth.'),
  size: unit.optional().describe('Brush thickness. Thicker plays softer and darker. Default 0.3.'),
  velocity: unit.optional().describe('How hard to play, like pen pressure. Leave out to use drawing speed.'),
  duration_ms: z.number().min(20).max(20000).optional().describe('How long the stroke takes to draw. Faster strokes play louder. Default 1500.'),
};

export const CommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set_project'),
    name: z.string().min(1).max(80).optional(),
    bpm: z.number().min(50).max(140).optional(),
    swing: unit.optional(),
    humanize: unit.optional(),
    window: z.enum(WINDOW_SCENES).optional().describe('What you see outside the window'),
  }),
  z.object({
    type: z.literal('set_key'),
    tonic: z.string().regex(/^[A-Ga-g][#b]?$/).describe('Like C, F#, or Bb'),
    mode: z.enum(MODES),
  }),
  z.object({
    type: z.literal('set_mood'),
    mood: z.enum(MOOD_IDS),
    keep_key: z.boolean().optional().describe('Keep the current key instead of the mood key'),
    scene: target.scene,
  }),
  z.object({
    type: z.literal('set_progression'),
    progression: z.string().describe('A preset id, or chords like "ii9 V13 Imaj9 vi9" or "Em9 A13 Dmaj9:2 Bm9:2". ":N" sets beats, default 4.'),
    scene: target.scene,
  }),
  z.object({
    type: z.literal('set_backing'),
    scene: target.scene,
    chords: z.object({ enabled: z.boolean(), instrument: z.enum(CHORD_INSTRUMENTS), style: z.enum(COMP_STYLES), volume: unit }).partial().optional(),
    bass: z.object({ enabled: z.boolean(), style: z.enum(BASS_STYLES), volume: unit }).partial().optional(),
    drums: z.object({ enabled: z.boolean(), groove: z.enum(GROOVE_IDS), volume: unit }).partial().optional(),
  }),
  z.object({
    type: z.literal('mix'),
    master: unit.optional(),
    warmth: unit.optional(),
    crackle: unit.optional(),
    reverb: unit.optional(),
    wobble: unit.optional(),
    rain: z.object({ enabled: z.boolean(), kind: z.enum(RAIN_KINDS), level: unit }).partial().optional(),
  }),
  z.object({
    type: z.literal('add_layer'),
    instrument: z.enum(INSTRUMENT_IDS),
    name: z.string().min(1).max(40).optional(),
    color: z.string().optional(),
    harmony: z.enum(HARMONY_MODES).optional(),
    octave: z.number().int().min(-2).max(2).optional(),
    kit: z.enum(DRUM_KITS).optional(),
    scene: target.scene,
  }),
  z.object({
    type: z.literal('update_layer'),
    layer: z.string(),
    scene: target.scene,
    name: z.string().min(1).max(40).optional(),
    instrument: z.enum(INSTRUMENT_IDS).optional(),
    color: z.string().optional(),
    volume: unit.optional(),
    pan: z.number().min(-1).max(1).optional(),
    muted: z.boolean().optional(),
    solo: z.boolean().optional(),
    harmony: z.enum(HARMONY_MODES).optional(),
    octave: z.number().int().min(-2).max(2).optional(),
    kit: z.enum(DRUM_KITS).optional(),
  }),
  z.object({ type: z.literal('remove_layer'), layer: z.string(), scene: target.scene }),
  z.object({
    type: z.literal('draw_path'),
    ...pen,
    points: z.array(z.object({ x: unit, y: unit, t: z.number().min(0).optional(), p: unit.optional() })).min(1).max(5000),
  }),
  z.object({ type: z.literal('draw_line'), ...pen, from: point, to: point }),
  z.object({ type: z.literal('draw_curve'), ...pen, points: z.array(point).min(2).max(64).describe('A smooth curve passes through every point') }),
  z.object({
    type: z.literal('draw_shape'),
    ...pen,
    shape: z.enum(SHAPES),
    x: unit.describe('Left edge'),
    y: unit.describe('Vertical center'),
    width: z.number().min(0.005).max(1),
    height: z.number().min(0).max(1),
    cycles: z.number().min(0.5).max(32).optional().describe('Waves, zigzags, or stair steps across the width'),
  }),
  z.object({
    type: z.literal('draw_melody'),
    ...target,
    notes: z
      .array(
        z.object({
          pitch: z.union([z.string(), z.number().int().min(0).max(127)]).describe('Like "A4" or a MIDI number. Played exactly, no snapping.'),
          beat: z.number().min(0).describe('Start, in beats from the start of the scene (4 per bar)'),
          beats: z.number().min(0.25).max(16).optional().describe('Length in beats. Default 1.'),
          velocity: unit.optional(),
        }),
      )
      .min(1)
      .max(256),
  }),
  z.object({
    type: z.literal('erase'),
    ...target,
    strokes: z.array(z.string()).optional().describe('Stroke ids to remove'),
    region: z.object({ x0: unit, x1: unit, y0: unit.optional(), y1: unit.optional() }).optional().describe('Remove strokes that pass through this box'),
    all: z.boolean().optional().describe('Clear the whole layer'),
  }),
  z.object({
    type: z.literal('add_scene'),
    name: z.string().min(1).max(40),
    bars: z.number().int().min(1).max(16).optional(),
    copy_from: z.string().optional().describe('Scene to copy layers, chords, and backing from'),
    progression: z.string().optional(),
    select: z.boolean().optional().describe('Make it the active scene. Default true.'),
  }),
  z.object({ type: z.literal('update_scene'), scene: z.string(), name: z.string().min(1).max(40).optional(), bars: z.number().int().min(1).max(16).optional() }),
  z.object({ type: z.literal('remove_scene'), scene: z.string() }),
  z.object({ type: z.literal('select_scene'), scene: z.string() }),
  z.object({
    type: z.literal('arrange'),
    items: z.array(z.object({ scene: z.string(), repeat: z.number().int().min(1).max(16).optional() })).min(1).max(64),
  }),
  z.object({ type: z.literal('describe'), scene: target.scene }),
]);

export type Command = z.infer<typeof CommandSchema>;
export type CommandType = Command['type'];
export type CommandOf<T extends CommandType> = Extract<Command, { type: T }>;

/** Commands that only read the project. */
export const READ_ONLY_COMMANDS: readonly CommandType[] = ['describe'];
