import { useMemo } from 'react';
import { Loader2, Play, Square } from 'lucide-react';
import { MODES, MOOD_IDS, MOODS, PROGRESSION_PRESETS, PROGRESSIONS, resolveProgression, type Project, type Scene } from '@haku/core';
import type { Command } from '@haku/protocol';
import type { EngineStatus } from '../audio/engine.ts';
import { IconButton, Select, titleCase } from './controls.tsx';

const TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const BARS = [1, 2, 4, 8, 16] as const;

interface Props {
  project: Project;
  scene: Scene;
  run: (cmd: Command) => void;
  playing: boolean;
  status: EngineStatus;
  onToggle: () => void;
}

export function TopBar({ project, scene, run, playing, status, onToggle }: Props) {
  const preset = useMemo(() => {
    const current = JSON.stringify(scene.progression);
    return PROGRESSION_PRESETS.find((id) => JSON.stringify(resolveProgression(id, project.key)) === current) ?? 'custom';
  }, [scene.progression, project.key]);

  const loading = status.state === 'loading';
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
      </div>

      <div className="topbar__transport">
        <IconButton label={playing ? 'Stop (Space)' : 'Play (Space)'} variant="primary" onClick={onToggle} disabled={loading} className="play-btn">
          {loading ? <Loader2 size={18} className="spin" /> : playing ? <Square size={16} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </IconButton>
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
          value={TONICS.find((t) => t === project.key.tonic) ?? project.key.tonic}
          options={(TONICS.includes(project.key.tonic as (typeof TONICS)[number]) ? TONICS : [...TONICS, project.key.tonic]).map((t) => ({ value: t, label: t }))}
          onChange={(tonic) => run({ type: 'set_key', tonic, mode: project.key.mode })}
        />
        <Select label="Mode" hideLabel value={project.key.mode} options={MODES.map((m) => ({ value: m, label: m }))} onChange={(mode) => run({ type: 'set_key', tonic: project.key.tonic, mode })} />
        <Select
          label="Chords"
          hideLabel
          value={preset}
          options={[...(preset === 'custom' ? [{ value: 'custom', label: 'Custom chords' }] : []), ...PROGRESSION_PRESETS.map((id) => ({ value: id, label: PROGRESSIONS[id].label }))]}
          onChange={(id) => id !== 'custom' && run({ type: 'set_progression', progression: id })}
        />
        <Select
          label="Bars"
          hideLabel
          value={String(scene.bars)}
          options={BARS.map((b) => ({ value: String(b), label: `${b} ${b === 1 ? 'bar' : 'bars'}` }))}
          onChange={(b) => run({ type: 'update_scene', scene: scene.id, bars: Number(b) })}
        />
      </div>

      <div className="topbar__mood">
        <Select
          label="Mood"
          hideLabel
          value={project.mood ?? ''}
          options={[...(project.mood ? [] : [{ value: '', label: 'Pick a mood' }]), ...MOOD_IDS.map((id) => ({ value: id, label: MOODS[id].label ?? titleCase(id) }))]}
          onChange={(mood) => mood && run({ type: 'set_mood', mood: mood as (typeof MOOD_IDS)[number] })}
        />
      </div>
    </header>
  );
}
