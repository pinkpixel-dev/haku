// Scenes on the left (switch, add, duplicate, rename, remove), the song arrangement on the right
// (which scenes play in what order, and how many times each).

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Minus, Plus, Trash2, X } from 'lucide-react';
import type { Project, Scene } from '@haku/core';
import type { Command } from '@haku/protocol';
import { IconButton } from './controls.tsx';

interface Props {
  project: Project;
  /** The scene on screen (the active one). */
  scene: Scene;
  /** Scene id currently sounding in song mode, for highlighting its chip. */
  playingSceneId: string | null;
  run: (cmd: Command) => void;
}

/** Next unused single letter, then "Scene 27" and up. */
function nextSceneName(project: Project) {
  const used = new Set(project.scenes.map((s) => s.name));
  for (let i = 0; i < 26; i++) {
    const name = String.fromCharCode(65 + i);
    if (!used.has(name)) return name;
  }
  return `Scene ${project.scenes.length + 1}`;
}

export function ScenesBar({ project, scene, playingSceneId, run }: Props) {
  const [name, setName] = useState(scene.name);
  useEffect(() => setName(scene.name), [scene.id, scene.name]);

  const items = project.arrangement;
  const arrange = (next: { sceneId: string; repeat: number }[]) => run({ type: 'arrange', items: next.map((i) => ({ scene: i.sceneId, repeat: i.repeat })) });
  const move = (i: number, by: number) => {
    const next = [...items];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    arrange(next);
  };

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== scene.name) run({ type: 'update_scene', scene: scene.id, name: trimmed });
    else setName(scene.name);
  };

  return (
    <div className="scenes-bar">
      <div className="scenes" role="group" aria-label="Scenes">
        <div className="scene-tabs" role="tablist" aria-label="Scene to edit">
          {project.scenes.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === scene.id}
              className="scene-tab"
              onClick={() => run({ type: 'select_scene', scene: s.id })}
            >
              {s.name}
            </button>
          ))}
        </div>
        <IconButton label="New scene" tipSide="top" onClick={() => run({ type: 'add_scene', name: nextSceneName(project) })}>
          <Plus size={15} />
        </IconButton>
        <IconButton label={`Duplicate scene ${scene.name}`} tipSide="top" onClick={() => run({ type: 'add_scene', name: nextSceneName(project), copy_from: scene.id })}>
          <Copy size={15} />
        </IconButton>
        <input
          className="scene-name"
          aria-label="Scene name"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setName(scene.name);
              e.currentTarget.blur();
            }
          }}
        />
        <IconButton label={`Remove scene ${scene.name}`} tipSide="top" disabled={project.scenes.length === 1} onClick={() => run({ type: 'remove_scene', scene: scene.id })}>
          <Trash2 size={15} />
        </IconButton>
      </div>

      <div className="arrangement" role="group" aria-label="Song arrangement">
        <span className="arrangement__label">Song</span>
        <ol className="arrangement__list">
          {items.map((item, i) => {
            const s = project.scenes.find((x) => x.id === item.sceneId);
            if (!s) return null;
            const playing = playingSceneId === s.id;
            return (
              // Index keys are fine here: the same scene can appear more than once, and chips only move by explicit buttons.
              <li key={`${i}-${item.sceneId}`} className={`chip ${s.id === scene.id ? 'chip--viewed' : ''} ${playing ? 'chip--playing' : ''}`}>
                <IconButton label={`Move ${s.name} earlier`} tipSide="top" disabled={i === 0} onClick={() => move(i, -1)} className="chip__btn">
                  <ChevronLeft size={13} />
                </IconButton>
                <span className="chip__name">{s.name}</span>
                <IconButton
                  label={`Play ${s.name} one time fewer`}
                  tipSide="top"
                  disabled={item.repeat <= 1}
                  onClick={() => arrange(items.map((x, j) => (j === i ? { ...x, repeat: x.repeat - 1 } : x)))}
                  className="chip__btn"
                >
                  <Minus size={12} />
                </IconButton>
                <span className="chip__repeat" aria-label={`plays ${item.repeat} times`}>
                  ×{item.repeat}
                </span>
                <IconButton
                  label={`Play ${s.name} one more time`}
                  tipSide="top"
                  disabled={item.repeat >= 16}
                  onClick={() => arrange(items.map((x, j) => (j === i ? { ...x, repeat: x.repeat + 1 } : x)))}
                  className="chip__btn"
                >
                  <Plus size={12} />
                </IconButton>
                <IconButton label={`Move ${s.name} later`} tipSide="top" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="chip__btn">
                  <ChevronRight size={13} />
                </IconButton>
                <IconButton label={`Take ${s.name} out of the song`} tipSide="top" disabled={items.length === 1} onClick={() => arrange(items.filter((_, j) => j !== i))} className="chip__btn">
                  <X size={13} />
                </IconButton>
              </li>
            );
          })}
        </ol>
        <button type="button" className="btn btn--sm" disabled={items.length >= 64} onClick={() => arrange([...items, { sceneId: scene.id, repeat: 1 }])}>
          <Plus size={13} /> Add {scene.name}
        </button>
      </div>
    </div>
  );
}
