// The sample manifest written by scripts/samples/build.mjs. Both the web app and the CLI load
// instruments from it, and the credits screen reads its license info.

import type { DrumPiece, InstrumentId } from './model/constants.ts';

export interface Credit {
  name: string;
  author: string;
  license: string;
  url: string;
}

export interface SampleLayer {
  /** This layer plays notes at or below this velocity (0 to 1). The last layer covers the rest. */
  maxVelocity: number;
  /** MIDI note to file path, relative to the manifest. */
  zones: Record<string, string>;
}

export interface SampledInstrument {
  credit: Credit;
  /** Seconds of release tail to let ring after note off. */
  release: number;
  layers: SampleLayer[];
}

export interface DrumLayer {
  maxVelocity: number;
  /** Round robins, cycled so repeated hits don't sound like a machine gun. */
  files: string[];
}

export interface SampleManifest {
  version: 1;
  instruments: Partial<Record<InstrumentId, SampledInstrument>>;
  /** `credit` is the kit; `percussionCredit` covers the shaker and cabasa the grooves use. */
  drums: { credit: Credit; percussionCredit: Credit; pieces: Partial<Record<DrumPiece, DrumLayer[]>> };
  ambience: Record<'rain_roof' | 'rain_window', { file: string; credit: Credit }>;
}

export function pickLayer<T extends { maxVelocity: number }>(layers: readonly T[], velocity: number): T {
  return layers.find((l) => velocity <= l.maxVelocity) ?? layers[layers.length - 1]!;
}
