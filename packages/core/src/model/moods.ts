// Mood presets: a starting point for tempo, key, harmony, backing, and the scene outside the window.

import type { ProgressionPresetId } from '../theory/progressions.ts';
import type { Key } from '../theory/scales.ts';
import type { Backing, Mix } from './schema.ts';
import type { InstrumentId, WindowScene } from './constants.ts';

export interface Mood {
  label: string;
  bpm: number;
  key: Key;
  progression: ProgressionPresetId;
  lead: InstrumentId;
  swing: number;
  window: WindowScene;
  backing: Backing;
  mix: Mix;
}

export const MOODS = {
  'rainy-study': {
    label: 'Rainy study',
    bpm: 72,
    key: { tonic: 'F', mode: 'major' },
    progression: 'jazzy-251',
    lead: 'piano',
    swing: 0.35,
    window: 'rain',
    backing: {
      chords: { enabled: true, instrument: 'wurli', style: 'lazy', volume: 0.6 },
      bass: { enabled: true, style: 'roots', volume: 0.7 },
      drums: { enabled: true, groove: 'brushes', volume: 0.65 },
    },
    mix: { master: 0.8, warmth: 0.55, crackle: 0.35, reverb: 0.4, wobble: 0.25, rain: { enabled: true, kind: 'roof', level: 0.45 } },
  },
  'late-night-train': {
    label: 'Late-night train',
    bpm: 68,
    key: { tonic: 'A', mode: 'minor' },
    progression: 'late-night',
    lead: 'wurli',
    swing: 0.4,
    window: 'night-city',
    backing: {
      chords: { enabled: true, instrument: 'piano', style: 'sustain', volume: 0.55 },
      bass: { enabled: true, style: 'dub', volume: 0.75 },
      drums: { enabled: true, groove: 'dusty', volume: 0.7 },
    },
    mix: { master: 0.8, warmth: 0.65, crackle: 0.45, reverb: 0.45, wobble: 0.4, rain: { enabled: true, kind: 'window', level: 0.2 } },
  },
  'sunny-cafe': {
    label: 'Sunny café',
    bpm: 86,
    key: { tonic: 'G', mode: 'major' },
    progression: 'sunday-walk',
    lead: 'marimba',
    swing: 0.2,
    window: 'sunny',
    backing: {
      chords: { enabled: true, instrument: 'piano', style: 'stabs', volume: 0.55 },
      bass: { enabled: true, style: 'walking', volume: 0.65 },
      drums: { enabled: true, groove: 'bossa', volume: 0.6 },
    },
    mix: { master: 0.8, warmth: 0.35, crackle: 0.2, reverb: 0.3, wobble: 0.15, rain: { enabled: false, kind: 'roof', level: 0.3 } },
  },
  'dusk-walk': {
    label: 'Dusk walk',
    bpm: 78,
    key: { tonic: 'D', mode: 'dorian' },
    progression: 'dorian-float',
    lead: 'harp',
    swing: 0.3,
    window: 'dusk',
    backing: {
      chords: { enabled: true, instrument: 'wurli', style: 'lazy', volume: 0.55 },
      bass: { enabled: true, style: 'roots', volume: 0.7 },
      drums: { enabled: true, groove: 'halftime', volume: 0.65 },
    },
    mix: { master: 0.8, warmth: 0.5, crackle: 0.3, reverb: 0.45, wobble: 0.3, rain: { enabled: false, kind: 'roof', level: 0.3 } },
  },
  'snowy-window': {
    label: 'Snowy window',
    bpm: 64,
    key: { tonic: 'Eb', mode: 'major' },
    progression: 'snowfall',
    lead: 'glock',
    swing: 0.25,
    window: 'snow',
    backing: {
      chords: { enabled: true, instrument: 'pad', style: 'sustain', volume: 0.5 },
      bass: { enabled: true, style: 'roots', volume: 0.6 },
      drums: { enabled: true, groove: 'sparse', volume: 0.5 },
    },
    mix: { master: 0.8, warmth: 0.6, crackle: 0.3, reverb: 0.6, wobble: 0.2, rain: { enabled: false, kind: 'window', level: 0.3 } },
  },
} as const satisfies Record<string, Mood>;

export type MoodId = keyof typeof MOODS;
export const MOOD_IDS = Object.keys(MOODS) as [MoodId, ...MoodId[]];

export function getMood(id: string): Mood {
  const mood = (MOODS as Record<string, Mood>)[id];
  if (!mood) throw new Error(`Unknown mood "${id}". Try one of: ${MOOD_IDS.join(', ')}`);
  return mood;
}
