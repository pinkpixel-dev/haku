// Point generators for drawing from code. Agents describe a shape, and this turns it into
// the same kind of point list a mouse would produce, timing included.

import type { StrokePoint } from './model/schema.ts';

export interface Pt {
  x: number;
  y: number;
}

export const SHAPES = ['wave', 'arc', 'zigzag', 'stairs-up', 'stairs-down'] as const;
export type ShapeKind = (typeof SHAPES)[number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Spreads timestamps evenly along the path so drawing speed is constant. */
export function timePoints(path: readonly Pt[], durationMs: number, pressure?: number): StrokePoint[] {
  const lengths = [0];
  for (let i = 1; i < path.length; i++) {
    lengths.push(lengths[i - 1]! + Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y));
  }
  const total = lengths[lengths.length - 1]! || 1;
  return path.map((p, i) => ({
    x: clamp01(p.x),
    y: clamp01(p.y),
    t: Math.round((lengths[i]! / total) * durationMs),
    ...(pressure === undefined ? {} : { p: clamp01(pressure) }),
  }));
}

export function linePath(from: Pt, to: Pt): Pt[] {
  const steps = Math.max(2, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) * 200));
  return Array.from({ length: steps + 1 }, (_, i) => ({
    x: from.x + ((to.x - from.x) * i) / steps,
    y: from.y + ((to.y - from.y) * i) / steps,
  }));
}

/** A smooth Catmull-Rom curve through every control point. */
export function curvePath(points: readonly Pt[]): Pt[] {
  if (points.length < 3) return points.length === 2 ? linePath(points[0]!, points[1]!) : [...points];
  const out: Pt[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const steps = Math.max(4, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 200));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

export interface ShapeOptions {
  /** Left edge, 0 to 1. */
  x: number;
  /** Vertical center, 0 (top) to 1 (bottom). */
  y: number;
  width: number;
  height: number;
  /** Waves, zigzags, and stair steps to fit in the width. */
  cycles?: number;
}

export function shapePath(kind: ShapeKind, { x, y, width, height, cycles = 2 }: ShapeOptions): Pt[] {
  const n = Math.max(24, Math.ceil(width * 240));
  const at = (f: number) => x + width * f;
  switch (kind) {
    case 'wave':
      return Array.from({ length: n + 1 }, (_, i) => ({ x: at(i / n), y: y - (height / 2) * Math.sin((i / n) * cycles * Math.PI * 2) }));
    case 'arc':
      return Array.from({ length: n + 1 }, (_, i) => ({ x: at(i / n), y: y + height / 2 - height * Math.sin((i / n) * Math.PI) }));
    case 'zigzag': {
      const corners: Pt[] = [];
      for (let i = 0; i <= cycles * 2; i++) corners.push({ x: at(i / (cycles * 2)), y: y + (i % 2 === 0 ? height / 2 : -height / 2) });
      return corners.flatMap((c, i) => (i === 0 ? [c] : linePath(corners[i - 1]!, c).slice(1)));
    }
    case 'stairs-up':
    case 'stairs-down': {
      const steps = Math.max(2, Math.round(cycles * 2));
      const dir = kind === 'stairs-up' ? -1 : 1;
      const out: Pt[] = [];
      for (let i = 0; i < steps; i++) {
        const sy = y - (dir * height) / 2 + (dir * height * i) / (steps - 1);
        out.push(...linePath({ x: at(i / steps), y: sy }, { x: at((i + 1) / steps) - 0.001, y: sy }));
      }
      return out;
    }
  }
}
