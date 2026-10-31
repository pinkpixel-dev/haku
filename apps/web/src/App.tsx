import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { BRUSH_IDS, type BrushId, type StrokePoint } from '@haku/core';
import { engine } from './audio/engine.ts';
import { DrawCanvas, type Tool } from './canvas/DrawCanvas.tsx';
import type { Box } from './canvas/render.ts';
import { useProject } from './state/useProject.ts';
import { LayerPanel } from './ui/LayerPanel.tsx';
import { SidePanel } from './ui/SidePanel.tsx';
import { ToolBar } from './ui/ToolBar.tsx';
import { TopBar } from './ui/TopBar.tsx';

/** draw_path accepts up to 5000 points; fast pens with coalesced events can go past that. */
function thin(points: StrokePoint[], max = 2000): StrokePoint[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out = Array.from({ length: max - 1 }, (_, i) => points[Math.floor(i * step)]!);
  out.push(points[points.length - 1]!);
  return out;
}

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName));

export function App() {
  const { project, scene, message, error, run } = useProject();
  const [activeLayerId, setActiveLayerId] = useState<string | null>(scene.layers[0]?.id ?? null);
  const [brush, setBrush] = useState<BrushId>('pencil');
  const [size, setSize] = useState(0.3);
  const [tool, setTool] = useState<Tool>('draw');

  const status = useSyncExternalStore(
    (fn) => engine.subscribe(fn),
    () => engine.status,
  );
  const playing = useSyncExternalStore(
    (fn) => engine.subscribe(fn),
    () => engine.playing,
  );

  useEffect(() => void engine.load(), []);
  useEffect(() => engine.update(project), [project]);

  // Keep a valid layer selected as layers come and go.
  useEffect(() => {
    if (!scene.layers.some((l) => l.id === activeLayerId)) setActiveLayerId(scene.layers.at(-1)?.id ?? null);
  }, [scene.layers, activeLayerId]);

  // Select a layer right after adding it.
  const layerCount = scene.layers.length;
  const [seenCount, setSeenCount] = useState(layerCount);
  if (layerCount !== seenCount) {
    setSeenCount(layerCount);
    if (layerCount > seenCount) setActiveLayerId(scene.layers.at(-1)!.id);
  }

  const toggle = useCallback(() => void engine.toggle(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space') {
        // Space on a focused button would also click it; play/stop wins.
        e.preventDefault();
        toggle();
      } else if (/^Digit[1-5]$/.test(e.code)) {
        setBrush(BRUSH_IDS[Number(e.code.slice(5)) - 1]!);
        setTool('draw');
      } else if (e.key === 'e' || e.key === 'E') {
        setTool((t) => (t === 'erase' ? 'draw' : 'erase'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? null;

  const onStroke = (points: StrokePoint[]) => {
    if (!activeLayerId) return;
    run({ type: 'draw_path', scene: scene.id, layer: activeLayerId, brush, size, points: thin(points) });
  };
  const onErase = (region: Box) => activeLayerId && run({ type: 'erase', scene: scene.id, layer: activeLayerId, region });

  const statusText =
    status.state === 'loading'
      ? `Loading sounds ${status.loaded}/${status.total}`
      : status.state === 'error'
        ? status.message
        : error ?? message;

  return (
    <div className="app">
      <TopBar project={project} scene={scene} run={run} playing={playing} status={status} onToggle={toggle} />
      <LayerPanel scene={scene} activeLayerId={activeLayerId} onSelect={setActiveLayerId} run={run} />
      <main className="stage">
        <ToolBar
          brush={brush}
          size={size}
          tool={tool}
          canClear={!!activeLayer?.strokes.length}
          onBrush={setBrush}
          onSize={setSize}
          onTool={setTool}
          onClear={() => activeLayerId && run({ type: 'erase', scene: scene.id, layer: activeLayerId, all: true })}
        />
        <DrawCanvas project={project} scene={scene} activeLayerId={activeLayerId} tool={tool} size={size} onStroke={onStroke} onErase={onErase} />
      </main>
      <SidePanel project={project} scene={scene} run={run} />
      <footer className={`statusbar ${error || status.state === 'error' ? 'statusbar--error' : ''}`} role="status" aria-live="polite">
        {statusText}
      </footer>
    </div>
  );
}
