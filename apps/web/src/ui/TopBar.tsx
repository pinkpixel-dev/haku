import { useMemo } from 'react';
import { Download, FolderOpen, Info, Loader2, Play, Redo2, Repeat, Square, Undo2 } from 'lucide-react';
import { MODES, PROGRESSION_PRESETS, PROGRESSIONS, resolveProgression, type Project, type Scene } from '@haku/core';
import type { Command } from '@haku/protocol';
import type { EngineStatus, PlayMode } from '../audio/engine.ts';
import type { SaveState } from '../state/useProject.ts';
import { IconButton, Select } from './controls.tsx';
import { MoodPicker } from './MoodPicker.tsx';

const TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const BARS = [1, 2, 4, 8, 16] as const;
const SAVE_LABEL: Record<SaveState, string> = { saved: 'Saved', saving: 'Saving…', error: "Couldn't save" };

interface Props {
  project: Project;
  scene: Scene;
  run: (cmd: Command) => void;
  playing: boolean;
  mode: PlayMode;
  status: EngineStatus;
  saveState: SaveState;
  canUndo: boolean;
  canRedo: boolean;
  onToggle: () => void;
  onMode: (m: PlayMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onProjects: () => void;
  onExport: () => void;
  onCredits: () => void;
}

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

export function TopBar(p: Props) {
  const { project, scene, run } = p;
  const preset = useMemo(() => {
    const current = JSON.stringify(scene.progression);
    return PROGRESSION_PRESETS.find((id) => JSON.stringify(resolveProgression(id, project.key)) === current) ?? 'custom';
  }, [scene.progression, project.key]);

  const loading = p.status.state === 'loading';
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="wordmark">haku</span>
        <input
          className="project-name"
          aria-label="Project name"
          value={project.name}
          maxLength={80}
          onChange={(e) => e.target.value.trim() && run({ type: 'set_project', name: e.target.value })}
        />
        <span className={`save-state save-state--${p.saveState}`} role="status">
          {SAVE_LABEL[p.saveState]}
        </span>
      </div>

      <div className="topbar__transport">
        <IconButton label={p.playing ? 'Stop (Space)' : 'Play (Space)'} variant="primary" onClick={p.onToggle} disabled={loading} className="play-btn">
          {loading ? <Loader2 size={18} className="spin" /> : p.playing ? <Square size={16} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </IconButton>
        <div className="segmented segmented--text" role="group" aria-label="Playback">
          <button type="button" aria-label="Loop" aria-pressed={p.mode === 'loop'} data-tip="Loop the scene you're editing" onClick={() => p.onMode('loop')}>
            <Repeat size={13} /> Loop
          </button>
          <button type="button" aria-label="Song" aria-pressed={p.mode === 'song'} data-tip="Play the whole arrangement" onClick={() => p.onMode('song')}>
            Song
          </button>
        </div>
        <label className="bpm">
          <input
            type="number"
            min={50}
            max={140}
            value={project.bpm}
            aria-label="Tempo in BPM"
            onChange={(e) => {
              const bpm = Number(e.target.value);
              if (bpm >= 50 && bpm <= 140) run({ type: 'set_project', bpm });
            }}
          />
          <span aria-hidden="true">bpm</span>
        </label>
      </div>

      <div className="topbar__music">
        <Select
          label="Key"
          hideLabel
          className="field--key"
          value={project.key.tonic}
          options={(TONICS.includes(project.key.tonic as (typeof TONICS)[number]) ? TONICS : [...TONICS, project.key.tonic]).map((t) => ({ value: t, label: t }))}
          onChange={(tonic) => run({ type: 'set_key', tonic, mode: project.key.mode })}
        />
        <Select label="Mode" hideLabel value={project.key.mode} options={MODES.map((m) => ({ value: m, label: m }))} onChange={(mode) => run({ type: 'set_key', tonic: project.key.tonic, mode })} />
        <Select
          label="Chords"
          hideLabel
          value={preset}
          options={[...(preset === 'custom' ? [{ value: 'custom', label: 'Custom chords' }] : []), ...PROGRESSION_PRESETS.map((id) => ({ value: id, label: PROGRESSIONS[id].label }))]}
          onChange={(id) => id !== 'custom' && run({ type: 'set_progression', scene: scene.id, progression: id })}
        />
        <Select
          label="Bars"
          hideLabel
          value={String(scene.bars)}
          options={BARS.map((b) => ({ value: String(b), label: `${b} ${b === 1 ? 'bar' : 'bars'}` }))}
          onChange={(b) => run({ type: 'update_scene', scene: scene.id, bars: Number(b) })}
        />
        <MoodPicker project={project} sceneId={scene.id} run={run} />
      </div>

      <div className="topbar__actions">
        <IconButton label={`Undo (${mod}Z)`} disabled={!p.canUndo} onClick={p.onUndo}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label={`Redo (${mod}Shift+Z)`} disabled={!p.canRedo} onClick={p.onRedo}>
          <Redo2 size={16} />
        </IconButton>
        <span className="topbar__divider" aria-hidden="true" />
        <IconButton label="Projects" onClick={p.onProjects}>
          <FolderOpen size={16} />
        </IconButton>
        <IconButton label="Export WAV or MIDI" onClick={p.onExport}>
          <Download size={16} />
        </IconButton>
        <IconButton label="Credits" onClick={p.onCredits} className="tip-left">
          <Info size={16} />
        </IconButton>
      </div>
    </header>
  );
}
