// The drawing surface. Pointer, pen (with pressure), and touch all work. Finished strokes go out as
// draw_path commands; the eraser drags a box and sends an erase command for that region.

import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { buildSceneScore, type Project, type Scene, type StrokePoint } from '@haku/core';
import { engine } from '../audio/engine.ts';
import { CHORD_STRIP, renderCanvas, type Box } from './render.ts';

export type Tool = 'draw' | 'erase';

interface Props {
  project: Project;
  scene: Scene;
  activeLayerId: string | null;
  tool: Tool;
  size: number;
  onStroke: (points: StrokePoint[]) => void;
  onErase: (box: Box) => void;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function DrawCanvas({ project, scene, activeLayerId, tool, size, onStroke, onErase }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const score = useMemo(() => buildSceneScore(project, scene.id), [project, scene.id]);

  // Everything the frame loop reads lives in one ref, so redraws never wait on React.
  const live = useRef({
    draft: null as { points: StrokePoint[]; started: number } | null,
    eraseBox: null as Box | null,
    dirty: true,
    size: { w: 0, h: 0 },
  });
  const props = useRef({ scene, score, activeLayerId, size });
  props.current = { scene, score, activeLayerId, size };
  live.current.dirty = true;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;
    let wasPlaying = false;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = wrap.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      live.current.size = { w: width, h: height };
      live.current.dirty = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const loop = () => {
      // In song mode only show the playhead while this scene is the one sounding.
      const pos = engine.position();
      const beat = pos && pos.sceneId === props.current.scene.id ? pos.beat : null;
      const playing = beat !== null;
      if (live.current.dirty || playing || wasPlaying) {
        const p = props.current;
        const layer = p.scene.layers.find((l) => l.id === p.activeLayerId);
        const d = live.current.draft;
        renderCanvas(ctx, {
          width: live.current.size.w,
          height: live.current.size.h,
          scene: p.scene,
          score: p.score,
          activeLayerId: p.activeLayerId,
          draft: d && layer ? { points: d.points, color: layer.color, size: p.size } : null,
          eraseBox: live.current.eraseBox,
          beat,
        });
        live.current.dirty = false;
      }
      wasPlaying = playing;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  const toPoint = (e: PointerEvent | ReactPointerEvent, started: number): StrokePoint => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const point: StrokePoint = {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top - CHORD_STRIP) / (rect.height - CHORD_STRIP)),
      t: Math.max(0, e.timeStamp - started),
    };
    if (e.pointerType === 'pen' && e.pressure > 0) point.p = clamp01(e.pressure);
    return point;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || !activeLayerId) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const started = e.timeStamp;
    const first = toPoint(e, started);
    if (tool === 'erase') live.current.eraseBox = { x0: first.x, x1: first.x, y0: first.y, y1: first.y };
    else live.current.draft = { points: [first], started };
    live.current.dirty = true;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const { draft, eraseBox } = live.current;
    if (eraseBox) {
      const p = toPoint(e, 0);
      eraseBox.x1 = p.x;
      eraseBox.y1 = p.y;
    } else if (draft) {
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      for (const ev of events) draft.points.push(toPoint(ev, draft.started));
    } else return;
    live.current.dirty = true;
  };

  const finish = (e: ReactPointerEvent<HTMLCanvasElement>, cancelled = false) => {
    const { draft, eraseBox } = live.current;
    live.current.draft = null;
    live.current.eraseBox = null;
    live.current.dirty = true;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (cancelled) return;
    if (draft) onStroke(draft.points);
    if (eraseBox) {
      // A click with no drag erases a small area around the point.
      const pad = 0.012;
      onErase({
        x0: clamp01(Math.min(eraseBox.x0, eraseBox.x1) - pad),
        x1: clamp01(Math.max(eraseBox.x0, eraseBox.x1) + pad),
        y0: clamp01(Math.min(eraseBox.y0, eraseBox.y1) - pad * 2),
        y1: clamp01(Math.max(eraseBox.y0, eraseBox.y1) + pad * 2),
      });
    }
  };

  const layerName = scene.layers.find((l) => l.id === activeLayerId)?.name ?? 'no layer';
  return (
    <div ref={wrapRef} className="canvas-wrap" data-tool={tool}>
      <canvas
        ref={canvasRef}
        className="draw-canvas"
        role="img"
        aria-label={`Scene ${scene.name}, ${scene.bars} bars. Drawing on ${layerName}.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e)}
        onPointerCancel={(e) => finish(e, true)}
      />
    </div>
  );
}
