// Plain-text summaries of a project. This is how an agent "sees" what it drew: chords, layers,
// note ranges, and a tiny piano roll per layer.

import { buildSceneScore } from './engine/score.ts';
import type { NoteEvent } from './engine/types.ts';
import { BRUSHES, INSTRUMENTS } from './model/constants.ts';
import { findScene } from './model/project.ts';
import type { Project } from './model/schema.ts';
import { noteName } from './theory/notes.ts';
import { progressionText } from './theory/progressions.ts';
import { keyLabel, prefersFlats } from './theory/scales.ts';

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** A compact piano roll: one row per pitch used, one column per eighth note, "|" between bars. */
export function pianoRoll(events: readonly NoteEvent[], beats: number, flats: boolean, maxRows = 14): string[] {
  if (events.length === 0) return ['(empty)'];
  const cols = Math.ceil(beats * 2);
  const pitches = [...new Set(events.map((e) => e.midi))].sort((a, b) => b - a);
  const shown = pitches.length > maxRows ? pitches.filter((_, i) => i % Math.ceil(pitches.length / maxRows) === 0) : pitches;
  const width = Math.max(...shown.map((p) => noteName(p, flats).length));
  return shown.map((p) => {
    const row = Array.from({ length: cols }, () => '.');
    for (const e of events) {
      if (e.midi !== p) continue;
      const start = Math.min(cols - 1, Math.round(e.time * 2));
      const end = Math.min(cols, Math.max(start + 1, Math.round((e.time + e.duration) * 2)));
      row[start] = 'o';
      for (let c = start + 1; c < end; c++) if (row[c] === '.') row[c] = '-';
    }
    let line = '';
    for (let c = 0; c < cols; c++) line += (c % 8 === 0 ? '|' : '') + row[c];
    return `${noteName(p, flats).padStart(width)} ${line}|`;
  });
}

export function describeProject(project: Project, sceneId?: string): string {
  const flats = prefersFlats(project.key);
  const scene = findScene(project, sceneId);
  const score = buildSceneScore(project, scene.id);
  const lines: string[] = [];

  lines.push(`${project.name} · ${keyLabel(project.key)} · ${project.bpm} BPM · swing ${pct(project.swing)} · humanize ${pct(project.humanize)}`);
  lines.push(`Mood: ${project.mood ?? 'custom'} · window: ${project.window}`);
  const arrangement = project.arrangement
    .map((a) => `${project.scenes.find((s) => s.id === a.sceneId)?.name ?? a.sceneId}${a.repeat > 1 ? `×${a.repeat}` : ''}`)
    .join(' → ');
  lines.push(`Scenes: ${project.scenes.map((s) => `${s.name} [${s.id}] ${s.bars} bars`).join(', ')}`);
  lines.push(`Arrangement: ${arrangement}`);
  const mix = project.mix;
  lines.push(
    `Mix: master ${pct(mix.master)}, warmth ${pct(mix.warmth)}, crackle ${pct(mix.crackle)}, reverb ${pct(mix.reverb)}, ` +
      `wobble ${pct(mix.wobble)}, rain ${mix.rain.enabled ? `${mix.rain.kind} ${pct(mix.rain.level)}` : 'off'}`,
  );
  lines.push('');
  lines.push(`Scene ${scene.name} (${scene.bars} bars, ${scene.bars * 4} beats). Canvas x 0→1 spans the whole scene, y 0 is the top (high notes).`);
  lines.push(`Chords: ${progressionText(scene.progression, project.key)}`);
  const b = scene.backing;
  lines.push(
    `Backing: chords ${b.chords.enabled ? `${b.chords.instrument} ${b.chords.style}` : 'off'} · ` +
      `bass ${b.bass.enabled ? b.bass.style : 'off'} · drums ${b.drums.enabled ? b.drums.groove : 'off'}`,
  );

  for (const layer of scene.layers) {
    const notes = score.events.filter((e) => e.track === layer.id);
    const flags = [layer.muted && 'muted', layer.solo && 'solo'].filter(Boolean).join(', ');
    const brushes = [...new Set(layer.strokes.map((s) => BRUSHES[s.brush].label.toLowerCase()))].join('/');
    lines.push('');
    lines.push(
      `Layer "${layer.name}" [${layer.id}] ${INSTRUMENTS[layer.instrument].label}, harmony ${layer.harmony}, ` +
        `octave ${layer.octave >= 0 ? '+' : ''}${layer.octave}, volume ${pct(layer.volume)}${flags ? ` (${flags})` : ''}`,
    );
    if (layer.strokes.length === 0) {
      lines.push('  No strokes yet.');
      continue;
    }
    const range = notes.length
      ? `${noteName(Math.min(...notes.map((n) => n.midi)), flats)} to ${noteName(Math.max(...notes.map((n) => n.midi)), flats)}`
      : 'none';
    lines.push(`  ${layer.strokes.length} strokes (${brushes}), ${notes.length} notes, range ${range}`);
    if (INSTRUMENTS[layer.instrument].kind === 'drums') {
      const counts = new Map<string, number>();
      for (const n of notes) counts.set(n.drum ?? '?', (counts.get(n.drum ?? '?') ?? 0) + 1);
      lines.push(`  Hits: ${[...counts].map(([k, v]) => `${k} ${v}`).join(', ')}`);
    } else {
      // Undo swing and humanize for display, so the roll lines up with the grid.
      const gridded = notes.map((n) => ({ ...n, time: Math.round(n.time * 4) / 4 }));
      for (const row of pianoRoll(gridded, scene.bars * 4, flats)) lines.push(`  ${row}`);
    }
  }
  return lines.join('\n');
}
