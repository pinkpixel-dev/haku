// Every gain in the mix lives here, so tuning the balance means editing one file.
// Values were set by rendering each mood offline and measuring (see scripts/render.mjs).

import type { DrumPiece, InstrumentId } from '@haku/core';

/** Per-instrument trim in dB, applied after the voice. Brings samplers and synths to a common level. */
export const INSTRUMENT_TRIM_DB: Record<InstrumentId, number> = {
  piano: 0,
  wurli: -9,
  'fm-ep': -2,
  glock: -9,
  marimba: -2,
  harp: -3,
  vibes: -9,
  kalimba: -3,
  guitar: -9,
  pad: -11,
  pluck: -6,
  bass: -19,
  drums: 0,
};

/**
 * Extra gain per velocity layer, softest first. The VSCO piano's soft layer sits about 12 dB under
 * its loud one, which is realistic but too much for lofi comping.
 */
export const SAMPLE_LAYER_LIFT_DB: Partial<Record<InstrumentId, number[]>> = {
  piano: [12, 0],
};

/** Sampled layers already carry their own dynamics, so velocity only shapes level a little within one. */
export const sampleVelocityGain = (v: number) => 0.45 + 0.55 * v;

/** Per-piece trim in dB inside the drum kit. The kit was normalized as a whole, so this is balance only. */
export const DRUM_TRIM_DB: Record<DrumPiece, number> = {
  kick: 0,
  snare: -3,
  brush: 8,
  rim: -4,
  hat: -9,
  brushhat: 2,
  openhat: -12,
  ride: -10,
  tom: -4,
  shaker: -3,
  cabasa: -10,
};

/** Gain after the bus compressor, before the master fader and the limiter. */
export const MASTER_MAKEUP_DB = 6;
/** Peak ceiling of the final limiter. */
export const LIMITER_DB = -1;
/** Reverb return level at reverb = 1. */
export const REVERB_RETURN = 0.55;
/** Crackle and hiss level at crackle = 1, in dB. */
export const CRACKLE_DB = -12;
export const HISS_DB = -46;
/** Rain level at level = 1, in dB. */
export const RAIN_DB = 12;

/** Faders (0 to 1) use a squared curve, which feels more even than linear. */
export function faderToGain(v: number): number {
  return Math.max(0, Math.min(1, v)) ** 2;
}

export const dbToGain = (db: number) => 10 ** (db / 20);
