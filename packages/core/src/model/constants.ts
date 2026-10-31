// Instruments, brushes, drum pieces, and the other fixed vocabularies the model uses.

export const INSTRUMENTS = {
  piano: { label: 'Upright piano', range: [55, 84], kind: 'tonal', gm: 0 },
  wurli: { label: 'Wurlitzer', range: [55, 81], kind: 'tonal', gm: 4 },
  'fm-ep': { label: 'FM keys', range: [55, 81], kind: 'tonal', gm: 5 },
  glock: { label: 'Glockenspiel', range: [72, 96], kind: 'tonal', gm: 9 },
  marimba: { label: 'Marimba', range: [55, 84], kind: 'tonal', gm: 12 },
  harp: { label: 'Harp', range: [48, 84], kind: 'tonal', gm: 46 },
  pad: { label: 'Warm pad', range: [55, 79], kind: 'tonal', gm: 89 },
  pluck: { label: 'Soft pluck', range: [60, 84], kind: 'tonal', gm: 24 },
  bass: { label: 'Round bass', range: [31, 55], kind: 'tonal', gm: 33 },
  drums: { label: 'Drums', range: [0, 0], kind: 'drums', gm: 0 },
} as const satisfies Record<string, { label: string; range: readonly [number, number]; kind: 'tonal' | 'drums'; gm: number }>;

export type InstrumentId = keyof typeof INSTRUMENTS;
export const INSTRUMENT_IDS = Object.keys(INSTRUMENTS) as [InstrumentId, ...InstrumentId[]];

/** Brushes decide the rhythmic grid a stroke is read on and how its notes are shaped. */
export const BRUSHES = {
  pencil: { label: 'Pencil', stepsPerBeat: 2, velocity: 0.7, note: 'Melodies in eighth notes, held notes merge' },
  brush: { label: 'Brush', stepsPerBeat: 1, velocity: 0.55, note: 'Long soft notes on the beat' },
  chalk: { label: 'Chalk', stepsPerBeat: 2, velocity: 0.6, note: 'Two-note harmonies under the line' },
  spray: { label: 'Spray', stepsPerBeat: 4, velocity: 0.45, note: 'Scattered sparkly sixteenths' },
  stamp: { label: 'Stamp', stepsPerBeat: 4, velocity: 0.75, note: 'One hit per step, great for drums' },
} as const;

export type BrushId = keyof typeof BRUSHES;
export const BRUSH_IDS = Object.keys(BRUSHES) as [BrushId, ...BrushId[]];

export const HARMONY_MODES = ['smart', 'scale', 'pentatonic', 'chord', 'chromatic'] as const;
export type HarmonyMode = (typeof HARMONY_MODES)[number];

export const DRUM_PIECES = {
  kick: { label: 'Kick', gm: 36 },
  snare: { label: 'Snare', gm: 38 },
  brush: { label: 'Brush snare', gm: 40 },
  rim: { label: 'Side stick', gm: 37 },
  hat: { label: 'Hi-hat', gm: 42 },
  brushhat: { label: 'Brush hat', gm: 44 },
  openhat: { label: 'Open hat', gm: 46 },
  ride: { label: 'Ride', gm: 51 },
  tom: { label: 'Tom', gm: 45 },
} as const;

export type DrumPiece = keyof typeof DRUM_PIECES;
export const DRUM_PIECE_IDS = Object.keys(DRUM_PIECES) as [DrumPiece, ...DrumPiece[]];

export const DRUM_KITS = ['sticks', 'brushes'] as const;
export type DrumKit = (typeof DRUM_KITS)[number];

/** Rows of a drum layer from the bottom of the canvas to the top. */
export function drumRows(kit: DrumKit): DrumPiece[] {
  return kit === 'brushes'
    ? ['kick', 'tom', 'brush', 'rim', 'brushhat', 'openhat', 'ride']
    : ['kick', 'tom', 'snare', 'rim', 'hat', 'openhat', 'ride'];
}

export const COMP_STYLES = ['sustain', 'lazy', 'stabs', 'arp'] as const;
export type CompStyle = (typeof COMP_STYLES)[number];

export const BASS_STYLES = ['roots', 'walking', 'dub'] as const;
export type BassStyle = (typeof BASS_STYLES)[number];

export const CHORD_INSTRUMENTS = ['piano', 'wurli', 'fm-ep', 'pad', 'harp'] as const satisfies readonly InstrumentId[];

export const GROOVE_IDS = ['dusty', 'brushes', 'halftime', 'bossa', 'sparse'] as const;
export type GrooveId = (typeof GROOVE_IDS)[number];

export const WINDOW_SCENES = ['rain', 'dusk', 'night-city', 'sunny', 'snow'] as const;
export type WindowScene = (typeof WINDOW_SCENES)[number];

export const RAIN_KINDS = ['roof', 'window'] as const;

/** Layer colors, drawn from the Haku icon. */
export const LAYER_COLORS = ['#e8897a', '#8fae8b', '#f2c48d', '#a39bd1', '#7fb7c9', '#d98fb0', '#c9a27e'] as const;
