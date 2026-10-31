import type { DrumPiece, InstrumentId } from '../model/constants.ts';

export type EventSource = 'stroke' | 'chords' | 'bass' | 'drums';

/** One note in a rendered score. Times and durations are in beats from the start of the score. */
export interface NoteEvent {
  time: number;
  duration: number;
  midi: number;
  /** 0 to 1. */
  velocity: number;
  /** Layer id for drawn notes, or "backing:chords" / "backing:bass" / "backing:drums". */
  track: string;
  instrument: InstrumentId;
  source: EventSource;
  drum?: DrumPiece;
  /** 0 is dark and soft, 1 is bright. Comes from brush size. */
  brightness: number;
  strokeId?: string;
}

export interface ChordEvent {
  time: number;
  duration: number;
  symbol: string;
  rootPc: number;
  pcs: number[];
}

export interface Score {
  bpm: number;
  beats: number;
  events: NoteEvent[];
  chords: ChordEvent[];
  /** Where each scene starts, in beats, in arrangement order. */
  sections: { sceneId: string; name: string; start: number; beats: number }[];
}

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}
