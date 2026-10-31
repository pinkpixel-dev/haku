// Drawing commands: turn lines, curves, shapes, and note lists into strokes on a layer.

import {
  buildSceneScore,
  curvePath,
  findLayer,
  INSTRUMENTS,
  layerRange,
  linePath,
  makeId,
  noteName,
  parseNote,
  pitchToY,
  prefersFlats,
  shapePath,
  timePoints,
  type Layer,
  type Project,
  type Stroke,
  type StrokePoint,
} from '@haku/core';
import type { CommandOf } from './schemas.ts';
import type { ExecResult } from './execute.ts';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

type DrawCommand = CommandOf<'draw_path' | 'draw_line' | 'draw_curve' | 'draw_shape'>;

function strokePoints(cmd: DrawCommand): StrokePoint[] {
  const ms = cmd.duration_ms ?? 1500;
  switch (cmd.type) {
    case 'draw_path': {
      const hasTime = cmd.points.every((p) => p.t !== undefined);
      if (hasTime) {
        return cmd.points.map((p) => {
          const pressure = p.p ?? cmd.velocity;
          return { x: p.x, y: p.y, t: p.t!, ...(pressure === undefined ? {} : { p: pressure }) };
        });
      }
      const timed = timePoints(cmd.points, ms, cmd.velocity);
      return timed.map((t, i) => (cmd.points[i]!.p === undefined ? t : { ...t, p: cmd.points[i]!.p }));
    }
    case 'draw_line':
      return timePoints(linePath(cmd.from, cmd.to), ms, cmd.velocity);
    case 'draw_curve':
      return timePoints(curvePath(cmd.points), ms, cmd.velocity);
    case 'draw_shape':
      return timePoints(shapePath(cmd.shape, cmd), ms, cmd.velocity);
  }
}

/** A short readout of what a set of strokes now plays, so the drawer hears it in words. */
function summarizeNotes(project: Project, sceneId: string, layer: Layer, strokeIds: Set<string>): { text: string; count: number } {
  const score = buildSceneScore({ ...project, swing: 0, humanize: 0, scenes: project.scenes.map((s) => (s.id === sceneId ? { ...s, layers: s.layers.map((l) => ({ ...l, muted: false, solo: false })) } : s)) }, sceneId);
  const notes = score.events.filter((e) => e.strokeId && strokeIds.has(e.strokeId));
  if (notes.length === 0) return { text: 'no notes (the stroke may be outside the canvas or too small)', count: 0 };
  const flats = prefersFlats(project.key);
  if (INSTRUMENTS[layer.instrument].kind === 'drums') {
    const counts = new Map<string, number>();
    for (const n of notes) counts.set(n.drum!, (counts.get(n.drum!) ?? 0) + 1);
    return { text: `${plural(notes.length, 'hit')} (${[...counts].map(([k, v]) => `${k} ${v}`).join(', ')})`, count: notes.length };
  }
  // Positions are beats from the start of the scene, the same unit draw_melody takes.
  const shown = notes.slice(0, 16).map((n) => `${noteName(n.midi, flats)}@${Math.round(n.time * 100) / 100}`);
  const more = notes.length > 16 ? ` and ${notes.length - 16} more` : '';
  return { text: `${plural(notes.length, 'note')} (pitch@beat): ${shown.join(' ')}${more}`, count: notes.length };
}

export function drawStroke(project: Project, cmd: DrawCommand): ExecResult {
  const { scene, layer } = findLayer(project, cmd.layer, cmd.scene);
  const stroke: Stroke = { id: makeId('k'), brush: cmd.brush ?? 'pencil', size: cmd.size ?? 0.3, points: strokePoints(cmd) };
  layer.strokes.push(stroke);
  const { text, count } = summarizeNotes(project, scene.id, layer, new Set([stroke.id]));
  const what = cmd.type === 'draw_shape' ? `${cmd.shape} shape` : cmd.type.replace('draw_', '');
  return { project, message: `Drew a ${stroke.brush} ${what} on "${layer.name}" [${stroke.id}]: ${text}`, data: { strokeId: stroke.id, notes: count } };
}

export function drawMelody(project: Project, cmd: CommandOf<'draw_melody'>): ExecResult {
  const { scene, layer } = findLayer(project, cmd.layer, cmd.scene);
  if (INSTRUMENTS[layer.instrument].kind === 'drums') throw new Error(`"${layer.name}" is a drum layer. Use draw_path with dots, or pick a melodic layer.`);
  const range = layerRange(layer);
  const totalBeats = scene.bars * 4;
  const flats = prefersFlats(project.key);
  const ids = new Set<string>();

  for (const n of cmd.notes) {
    const midi = typeof n.pitch === 'number' ? n.pitch : parseNote(n.pitch);
    if (midi === null) throw new Error(`Can't read pitch "${n.pitch}". Use a note like "A4" or a MIDI number.`);
    if (midi < range[0] || midi > range[1]) {
      throw new Error(`${noteName(midi, flats)} is outside "${layer.name}" (${noteName(range[0], flats)} to ${noteName(range[1], flats)}). Change the layer octave or pick another note.`);
    }
    const beats = n.beats ?? 1;
    if (n.beat + beats > totalBeats + 1e-6) throw new Error(`A note at beat ${n.beat} lasting ${beats} runs past the end of the scene (${totalBeats} beats)`);
    const y = pitchToY(midi, range);
    // Inset a hair from the column edges so the stroke covers exactly the right sixteenths.
    const x0 = (n.beat + 0.01) / totalBeats;
    const x1 = (n.beat + beats - 0.01) / totalBeats;
    const points = timePoints([{ x: x0, y }, { x: x1, y }], 200, n.velocity ?? 0.6);
    const stroke: Stroke = { id: makeId('k'), brush: 'pencil', size: 0.3, points, exact: true };
    layer.strokes.push(stroke);
    ids.add(stroke.id);
  }
  const { text } = summarizeNotes(project, scene.id, layer, ids);
  return { project, message: `Wrote a melody on "${layer.name}": ${text}`, data: { strokeIds: [...ids] } };
}

function strokeHits(stroke: Stroke, region: { x0: number; x1: number; y0?: number; y1?: number }): boolean {
  const [xa, xb] = [Math.min(region.x0, region.x1), Math.max(region.x0, region.x1)];
  const [ya, yb] = [Math.min(region.y0 ?? 0, region.y1 ?? 1), Math.max(region.y0 ?? 0, region.y1 ?? 1)];
  return stroke.points.some((p) => p.x >= xa && p.x <= xb && p.y >= ya && p.y <= yb);
}

export function erase(project: Project, cmd: CommandOf<'erase'>): ExecResult {
  const { layer } = findLayer(project, cmd.layer, cmd.scene);
  if (!cmd.all && !cmd.strokes && !cmd.region) throw new Error('Say what to erase: strokes, a region, or all');
  const before = layer.strokes.length;
  const ids = new Set(cmd.strokes ?? []);
  layer.strokes = cmd.all ? [] : layer.strokes.filter((s) => !ids.has(s.id) && !(cmd.region && strokeHits(s, cmd.region)));
  const removed = before - layer.strokes.length;
  return { project, message: `Erased ${plural(removed, 'stroke')} from "${layer.name}"`, data: { removed } };
}
