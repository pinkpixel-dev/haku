// Numbers an agent can act on: how each drawn layer sits against the chords and the key, where
// layers rub against each other, and (after an offline render) how loud the result is.

import {
  buildSceneScore,
  findScene,
  INSTRUMENTS,
  mod12,
  noteName,
  prefersFlats,
  scalePcs,
  type Project,
} from '@haku/core';

export interface LayerStats {
  id: string;
  name: string;
  instrument: string;
  notes: number;
  notesPerBar: number;
  /** Tonal layers only. */
  range?: string;
  /** Share of notes on beats 1 and 3 that are chord tones. Tonal layers only. */
  strongBeatChordTones?: number;
  /** Notes outside the key that aren't tones of the chord under them either. */
  outOfKey?: number;
  averageVelocity: number;
  /** Longest stretch without a note starting or sounding, in beats. */
  longestRest: number;
  /** Drum layers only. */
  hits?: Record<string, number>;
}

export interface SceneStats {
  id: string;
  name: string;
  bars: number;
  layers: LayerStats[];
  /** Notes from different drawn layers sounding a minor 2nd or minor 9th apart at the same time. */
  clashes: { beat: number; notes: string }[];
}

export interface Levels {
  seconds: number;
  peakDb: number;
  rmsDb: number;
  lufs: number;
}

const round = (v: number, places = 2) => Math.round(v * 10 ** places) / 10 ** places;

export function analyzeScenes(project: Project, sceneIds: string[]): SceneStats[] {
  const flats = prefersFlats(project.key);
  const scale = new Set(scalePcs(project.key));

  return sceneIds.map((sceneId) => {
    const scene = findScene(project, sceneId);
    const score = buildSceneScore(project, scene.id);
    const beats = scene.bars * 4;
    const chordAt = (t: number) => score.chords.find((c) => t >= c.time - 1e-6 && t < c.time + c.duration) ?? score.chords.at(-1);

    const layers = scene.layers.map((layer): LayerStats => {
      const notes = score.events.filter((e) => e.track === layer.id).sort((a, b) => a.time - b.time);
      let longestRest = notes.length ? Math.max(0, notes[0]!.time) : beats;
      let end = notes[0]?.time ?? 0;
      for (const e of notes) {
        longestRest = Math.max(longestRest, e.time - end);
        end = Math.max(end, e.time + e.duration);
      }
      if (notes.length) longestRest = Math.max(longestRest, beats - end);

      const base: LayerStats = {
        id: layer.id,
        name: layer.name,
        instrument: layer.instrument,
        notes: notes.length,
        notesPerBar: round(notes.length / scene.bars, 1),
        averageVelocity: notes.length ? round(notes.reduce((s, e) => s + e.velocity, 0) / notes.length) : 0,
        longestRest: round(longestRest, 2),
      };

      if (INSTRUMENTS[layer.instrument].kind === 'drums') {
        const hits: Record<string, number> = {};
        for (const e of notes) hits[e.drum ?? '?'] = (hits[e.drum ?? '?'] ?? 0) + 1;
        return { ...base, hits };
      }

      // Swing and humanize nudge times; snap back to sixteenths to find the beat a note sits on.
      const strong = notes.filter((e) => {
        const t = Math.round(e.time * 4) / 4;
        return t % 2 === 0;
      });
      const chordTones = strong.filter((e) => chordAt(Math.round(e.time * 4) / 4)?.pcs.includes(mod12(e.midi))).length;
      const pitches = notes.map((e) => e.midi);
      return {
        ...base,
        range: notes.length ? `${noteName(Math.min(...pitches), flats)} to ${noteName(Math.max(...pitches), flats)}` : 'none',
        strongBeatChordTones: strong.length ? round(chordTones / strong.length) : 1,
        // Notes borrowed from the chord playing underneath (G# over E7 in A minor) aren't wrong.
        outOfKey: notes.filter((e) => {
          const pc = mod12(e.midi);
          return !scale.has(pc) && !chordAt(Math.round(e.time * 4) / 4)?.pcs.includes(pc);
        }).length,
      };
    });

    // Half-step rubs between drawn tonal layers. One per beat is enough to point at the spot.
    const tonal = new Set(scene.layers.filter((l) => INSTRUMENTS[l.instrument].kind === 'tonal').map((l) => l.id));
    const drawn = score.events.filter((e) => tonal.has(e.track));
    const clashes = new Map<number, string>();
    for (let i = 0; i < drawn.length; i++) {
      for (let j = i + 1; j < drawn.length; j++) {
        const a = drawn[i]!;
        const b = drawn[j]!;
        if (a.track === b.track) continue;
        const overlap = Math.min(a.time + a.duration, b.time + b.duration) - Math.max(a.time, b.time);
        // A minor 2nd or minor 9th rubs. Wider gaps, and major 7ths, sound fine.
        const gap = Math.abs(a.midi - b.midi);
        if (overlap > 0.1 && (gap === 1 || gap === 13)) {
          const beat = round(Math.max(a.time, b.time), 2);
          if (!clashes.has(beat)) clashes.set(beat, `${noteName(a.midi, flats)} against ${noteName(b.midi, flats)}`);
        }
      }
    }

    return {
      id: scene.id,
      name: scene.name,
      bars: scene.bars,
      layers,
      clashes: [...clashes].sort((a, b) => a[0] - b[0]).map(([beat, notes]) => ({ beat, notes })),
    };
  });
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const db = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '-inf');

export function formatAnalysis(scenes: SceneStats[], levels: Levels | null): string {
  const lines: string[] = [];
  for (const scene of scenes) {
    if (lines.length) lines.push('');
    lines.push(`Scene ${scene.name} [${scene.id}], ${scene.bars} bars`);
    if (!scene.layers.length) lines.push('  No layers.');
    for (const l of scene.layers) {
      const parts = [`${l.notes} notes (${l.notesPerBar}/bar)`];
      if (l.hits) parts.push(Object.entries(l.hits).map(([k, v]) => `${k} ${v}`).join(', ') || 'no hits');
      else if (l.notes) {
        parts.push(`range ${l.range}`, `strong-beat chord tones ${pct(l.strongBeatChordTones ?? 1)}`, `out of key ${l.outOfKey}`);
      }
      if (l.notes) parts.push(`avg velocity ${l.averageVelocity}`, `longest rest ${l.longestRest} beats`);
      lines.push(`  "${l.name}" (${l.instrument}): ${parts.join(', ')}`);
    }
    if (scene.clashes.length) {
      const shown = scene.clashes.slice(0, 8).map((c) => `beat ${c.beat} ${c.notes}`);
      lines.push(`  Half-step clashes between layers: ${shown.join('; ')}${scene.clashes.length > 8 ? `; and ${scene.clashes.length - 8} more` : ''}`);
    } else {
      lines.push('  No half-step clashes between layers.');
    }
  }
  if (levels) {
    lines.push('');
    lines.push(`Render: ${levels.seconds.toFixed(1)} s, ${db(levels.lufs)} LUFS integrated, peak ${db(levels.peakDb)} dBFS, RMS ${db(levels.rmsDb)} dBFS`);
    if (levels.peakDb > -0.5) lines.push('  Peaks are close to clipping. Try lowering master or a busy layer.');
    else if (levels.lufs < -20) lines.push('  Quiet for lofi. Most moods land around -12 to -15 LUFS.');
  }
  return lines.join('\n');
}
