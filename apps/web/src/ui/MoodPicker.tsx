// The mood button in the top bar. It opens a row of little windows, one per mood, and picking
// one applies it (tempo, key, chords, band, mix, and the view outside). Strokes stay put.

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { MOOD_IDS, MOODS, type MoodId, type Project } from '@haku/core';
import type { Command } from '@haku/protocol';
import { WindowArt } from './window/WindowArt.tsx';

interface Props {
  project: Project;
  sceneId: string;
  run: (cmd: Command) => void;
}

export function MoodPicker({ project, sceneId, run }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = project.mood && project.mood in MOODS ? (project.mood as MoodId) : null;

  useEffect(() => {
    if (!open) return;
    // Focus the current mood (or the first) so arrow keys and Enter work right away.
    wrapRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"], .mood-card')?.focus();
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (mood: MoodId) => {
    run({ type: 'set_mood', scene: sceneId, mood });
    setOpen(false);
    buttonRef.current?.focus();
  };

  // Left and right arrows move between cards.
  const onCardKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const cards = [...(wrapRef.current?.querySelectorAll<HTMLButtonElement>('.mood-card') ?? [])];
    const i = cards.indexOf(document.activeElement as HTMLButtonElement);
    cards[(i + (e.key === 'ArrowRight' ? 1 : cards.length - 1)) % cards.length]?.focus();
    e.preventDefault();
  };

  return (
    <div className="mood-picker" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="mood-button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Mood: ${current ? MOODS[current].label : 'none'}. Change mood`}
        onClick={() => setOpen((o) => !o)}
      >
        <WindowArt scene={current ? MOODS[current].window : project.window} className="mood-button__thumb" />
        <span>{current ? MOODS[current].label : 'Pick a mood'}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <div className="mood-popover" role="group" aria-label="Moods" onKeyDown={onCardKey}>
          {MOOD_IDS.map((id) => {
            const m = MOODS[id];
            return (
              <button key={id} type="button" className="mood-card" aria-pressed={id === current} onClick={() => pick(id)}>
                <WindowArt scene={m.window} className="mood-card__art" />
                <span className="mood-card__name">{m.label}</span>
                <span className="mood-card__meta">
                  {m.key.tonic} {m.key.mode} · {m.bpm} bpm
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
