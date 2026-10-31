// Draws the loop canvas: chord strip, beat grid, the notes each layer plays, the strokes that made
// them, and the playhead. Pure drawing, no state. Coordinates match the engine: x is time across the
// whole scene, y is pitch across the layer's range (0 is the top).

import { drumRows, INSTRUMENTS, layerRange, pitchToY, type Layer, type Scene, type Score, type StrokePoint } from '@haku/core';

export const CHORD_STRIP = 30;

export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface RenderInput {
  width: number;
  height: number;
  scene: Scene;
  score: Score;
  activeLayerId: string | null;
  draft: { points: StrokePoint[]; color: string; size: number } | null;
  eraseBox: Box | null;
  beat: number | null;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function noteY(layer: Layer, midi: number, drum?: string): [number, number] {
  if (INSTRUMENTS[layer.instrument].kind === 'drums') {
    const rows = drumRows(layer.kit);
    const i = Math.max(0, rows.indexOf(drum as (typeof rows)[number]));
    return [1 - (i + 1) / rows.length, 1 / rows.length];
  }
  const range = layerRange(layer);
  const step = 1 / (range[1] - range[0]);
  return [pitchToY(midi, range) - step / 2, step];
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function renderCanvas(ctx: CanvasRenderingContext2D, input: RenderInput) {
  const { width: w, height, scene, score, activeLayerId, beat } = input;
  const top = CHORD_STRIP;
  const h = height - top;
  const beats = scene.bars * 4;
  const bx = (b: number) => (b / beats) * w;

  const colors = {
    text: css('--text'),
    muted: css('--text-muted'),
    faint: css('--text-faint'),
    border: css('--border'),
    strong: css('--border-strong'),
    sunken: css('--sunken'),
    raised: css('--raised'),
    coral: css('--coral'),
  };

  ctx.clearRect(0, 0, w, height);

  // Chord strip.
  ctx.fillStyle = colors.sunken;
  ctx.fillRect(0, 0, w, top);
  ctx.font = `600 12px ${css('--font-ui')}`;
  ctx.textBaseline = 'middle';
  for (const [i, chord] of score.chords.entries()) {
    const x = bx(chord.time);
    const cw = bx(chord.time + chord.duration) - x;
    if (i % 2 === 1) {
      ctx.fillStyle = colors.raised;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(x, 0, cw, top);
      ctx.globalAlpha = 1;
    }
    const playing = beat !== null && beat >= chord.time && beat < chord.time + chord.duration;
    ctx.fillStyle = playing ? colors.text : colors.muted;
    ctx.fillText(chord.symbol, x + 10, top / 2, Math.max(0, cw - 14));
  }

  // Beat and bar grid.
  for (let b = 0; b <= beats; b++) {
    const x = Math.round(bx(b)) + 0.5;
    const bar = b % 4 === 0;
    ctx.strokeStyle = bar ? colors.strong : colors.border;
    ctx.globalAlpha = bar ? 0.9 : 0.45;
    ctx.beginPath();
    ctx.moveTo(x, bar ? 0 : top);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const active = scene.layers.find((l) => l.id === activeLayerId) ?? null;

  // Pitch guides for the active layer: drum rows, or one line per C.
  ctx.font = `500 10.5px ${css('--font-ui')}`;
  ctx.fillStyle = colors.faint;
  if (active && INSTRUMENTS[active.instrument].kind === 'drums') {
    const rows = drumRows(active.kit);
    rows.forEach((piece, i) => {
      const y = top + (1 - (i + 1) / rows.length) * h;
      ctx.strokeStyle = colors.border;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(w, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillText(piece, 8, y + h / rows.length / 2);
    });
  } else if (active) {
    const range = layerRange(active);
    for (let m = Math.ceil(range[0] / 12) * 12; m <= range[1]; m += 12) {
      const y = Math.round(top + pitchToY(m, range) * h) + 0.5;
      ctx.strokeStyle = colors.border;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      // Label above the line, or below it when the line hugs the chord strip.
      ctx.fillText(`${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`, 8, y - top < 16 ? y + 9 : y - 7);
    }
  }

  // Notes, inactive layers first so the active one sits on top.
  const layers = [...scene.layers].sort((a, b) => Number(a.id === activeLayerId) - Number(b.id === activeLayerId));
  const byId = new Map(scene.layers.map((l) => [l.id, l]));
  for (const layer of layers) {
    const isActive = layer.id === activeLayerId;
    ctx.fillStyle = layer.color;
    for (const e of score.events) {
      if (e.track !== layer.id) continue;
      const l = byId.get(e.track)!;
      const [ny, nh] = noteY(l, e.midi, e.drum);
      const x = bx(e.time);
      const nw = Math.max(3, bx(e.time + e.duration) - x - 1.5);
      const y = top + ny * h;
      const rh = Math.max(4, nh * h - 1.5);
      const sounding = beat !== null && beat >= e.time && beat < e.time + Math.max(e.duration, 0.12);
      ctx.globalAlpha = isActive ? (sounding ? 1 : 0.62) : sounding ? 0.5 : 0.2;
      ctx.beginPath();
      ctx.roundRect(x, y, nw, rh, Math.min(3, rh / 2));
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Strokes.
  const drawStroke = (points: readonly StrokePoint[], color: string, size: number, alpha: number) => {
    if (!points.length) return;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2 + size * 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0]!.x * w, top + points[0]!.y * h, ctx.lineWidth / 2 + 1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(p.x * w, top + p.y * h) : ctx.moveTo(p.x * w, top + p.y * h)));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  for (const layer of layers) {
    const isActive = layer.id === activeLayerId;
    for (const s of layer.strokes) drawStroke(s.points, layer.color, s.size, isActive ? 0.85 : 0.18);
  }
  if (input.draft) drawStroke(input.draft.points, input.draft.color, input.draft.size, 1);

  // Erase box.
  if (input.eraseBox) {
    const { x0, x1, y0, y1 } = input.eraseBox;
    ctx.strokeStyle = colors.text;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.min(x0, x1) * w + 0.5, top + Math.min(y0, y1) * h + 0.5, Math.abs(x1 - x0) * w, Math.abs(y1 - y0) * h);
    ctx.setLineDash([]);
  }

  // Playhead.
  if (beat !== null) {
    const x = Math.round(bx(beat)) + 0.5;
    ctx.strokeStyle = colors.coral;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}
