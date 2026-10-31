// Recognizes a few special shapes so drawing feels expressive:
//   dot      a tap, plays one note (or one drum hit)
//   strum    a short vertical line, plays the chord tones it covers as a strum
//   trill    a tight zigzag, alternates a note with the scale tone above it
//   flick    a quick short swipe, adds a grace note before an accented note
//   line     everything else, read as a melody

import type { Stroke } from '../model/schema.ts';

export type Gesture = 'dot' | 'strum' | 'trill' | 'flick' | 'line';

export interface StrokeShape {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  length: number;
  durationMs: number;
  /** Changes of vertical direction bigger than a small threshold. */
  reversals: number;
}

export function measureStroke(stroke: Pick<Stroke, 'points'>): StrokeShape {
  const pts = stroke.points;
  let minX = 1, maxX = 0, minY = 1, maxY = 0, length = 0;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);

  // Count direction changes, ignoring wiggles smaller than the threshold.
  const threshold = 0.012;
  let reversals = 0;
  let dir = 0;
  let anchor = pts[0]!.y;
  for (const p of pts) {
    const d = p.y - anchor;
    if (Math.abs(d) < threshold) continue;
    const nd = Math.sign(d);
    if (dir !== 0 && nd !== dir) reversals++;
    dir = nd;
    anchor = p.y;
  }

  return {
    minX, maxX, minY, maxY,
    width: maxX - minX,
    height: maxY - minY,
    length,
    durationMs: pts[pts.length - 1]!.t - pts[0]!.t,
    reversals,
  };
}

export function classifyStroke(stroke: Pick<Stroke, 'points' | 'brush' | 'exact'>): Gesture {
  const s = measureStroke(stroke);
  if (stroke.points.length === 1 || (s.width < 0.012 && s.height < 0.02)) return 'dot';
  // Stamps, spray, and exact strokes are always read literally.
  if (stroke.exact || stroke.brush === 'stamp' || stroke.brush === 'spray') return 'line';
  if (s.height > 0.06 && s.width < Math.max(0.015, s.height * 0.15)) return 'strum';
  if (s.reversals >= 4 && s.width / s.reversals < 0.04 && s.height < 0.15) return 'trill';
  if (s.durationMs > 0 && s.durationMs < 180 && s.length > 0.03 && s.length < 0.12) return 'flick';
  return 'line';
}
