import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { BRUSH_IDS, type BrushId, type StrokePoint } from '@haku/core';
import { engine, type PlayMode } from './audio/engine.ts';
import { DrawCanvas, type Tool } from './canvas/DrawCanvas.tsx';
import type { Box } from './canvas/render.ts';
import { useProject, type ProjectApi } from './state/useProject.ts';
import { CreditsDialog } from './ui/CreditsDialog.tsx';
import { ExportDialog } from './ui/ExportDialog.tsx';
import { LayerPanel } from './ui/LayerPanel.tsx';
import { ProjectsDialog } from './ui/ProjectsDialog.tsx';
import { ScenesBar } from './ui/ScenesBar.tsx';
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

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && !['range', 'radio', 'checkbox'].includes((el as HTMLInputElement).type)));

const subscribe = (fn: () => void) => engine.subscribe(fn);

/** Which scene is sounding right now, for the arrangement strip. Only re-renders when it changes. */
function usePlayingScene(playing: boolean) {
  const [sceneId, setSceneId] = useState<string | null>(null);
  useEffect(() => {
    if (!playing) return setSceneId(null);
    let frame = 0;
    const tick = () => {
      setSceneId(engine.position()?.sceneId ?? null);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  return sceneId;
}

export function App() {
  const api = useProject();
  if (!api) return <div className="app-loading">Opening your last loop…</div>;
  return <Studio api={api} />;
}

type DialogName = 'projects' | 'export' | 'credits' | null;

function Studio({ api }: { api: ProjectApi }) {
  const { project, scene, message, error, run, undo, redo } = api;
  // Remember the selected layer per scene, so switching scenes and back keeps your place.
  const [layerByScene, setLayerByScene] = useState<Record<string, string>>({});
  const [brush, setBrush] = useState<BrushId>('pencil');
  const [size, setSize] = useState(0.3);
  const [tool, setTool] = useState<Tool>('draw');
  const [dialog, setDialog] = useState<DialogName>(null);

  const status = useSyncExternalStore(subscribe, () => engine.status);
  const playing = useSyncExternalStore(subscribe, () => engine.playing);
  const mode = useSyncExternalStore(subscribe, () => engine.mode);
  const playingSceneId = usePlayingScene(playing && mode === 'song');

  useEffect(() => void engine.load(), []);
  useEffect(() => engine.update(project), [project]);

  const remembered = layerByScene[scene.id];
  const activeLayerId = scene.layers.some((l) => l.id === remembered) ? remembered! : (scene.layers.at(-1)?.id ?? null);
  const selectLayer = useCallback((id: string) => setLayerByScene((m) => ({ ...m, [scene.id]: id })), [scene.id]);

  // Select a layer right after adding it.
  const [seen, setSeen] = useState({ scene: scene.id, count: scene.layers.length });
  if (seen.scene !== scene.id || seen.count !== scene.layers.length) {
    const added = seen.scene === scene.id && scene.layers.length > seen.count;
    setSeen({ scene: scene.id, count: scene.layers.length });
    if (added) setLayerByScene((m) => ({ ...m, [scene.id]: scene.layers.at(-1)!.id }));
  }

  const toggle = useCallback(() => void engine.toggle(), []);
  const setMode = useCallback((m: PlayMode) => engine.setMode(m), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog) return;
      const typing = isTyping(e.target);
      const cmd = e.metaKey || e.ctrlKey;
      // Undo and redo, but leave text fields their own native undo.
      if (cmd && !typing && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (cmd && !typing && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (typing || cmd || e.altKey) return;
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
  }, [toggle, undo, redo, dialog]);

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
        : (error ?? message);

  return (
    <div className="app">
      <TopBar
        project={project}
        scene={scene}
        run={run}
        playing={playing}
        mode={mode}
        status={status}
        saveState={api.saveState}
        canUndo={api.canUndo}
        canRedo={api.canRedo}
        onToggle={toggle}
        onMode={setMode}
        onUndo={undo}
        onRedo={redo}
        onProjects={() => setDialog('projects')}
        onExport={() => setDialog('export')}
        onCredits={() => setDialog('credits')}
      />
      <LayerPanel scene={scene} activeLayerId={activeLayerId} onSelect={selectLayer} run={run} />
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
        <ScenesBar project={project} scene={scene} playingSceneId={playingSceneId} run={run} />
      </main>
      <SidePanel project={project} scene={scene} run={run} />
      <footer className={`statusbar ${error || status.state === 'error' ? 'statusbar--error' : ''}`} role="status" aria-live="polite">
        {statusText}
      </footer>

      <ProjectsDialog open={dialog === 'projects'} onClose={() => setDialog(null)} current={project} onOpen={api.open} onNew={api.newProject} notify={api.notify} />
      <ExportDialog open={dialog === 'export'} onClose={() => setDialog(null)} project={project} notify={api.notify} />
      <CreditsDialog open={dialog === 'credits'} onClose={() => setDialog(null)} manifest={engine.manifest} />
    </div>
  );
}
