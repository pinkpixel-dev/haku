// The auto band: comping chords, a bass line, and drums that follow the scene's progression.

import { DRUM_PIECES, type BassStyle, type CompStyle, type GrooveId } from '../model/constants.ts';
import type { Backing } from '../model/schema.ts';
import { QUALITIES, type ChordRef } from '../theory/chords.ts';
import { mod12 } from '../theory/notes.ts';
import { tonicPc, type Key } from '../theory/scales.ts';
import { grooveBar } from './grooves.ts';
import type { NoteEvent } from './types.ts';
import { voiceChord } from './voicing.ts';

export interface PlacedChord {
  chord: ChordRef;
  start: number;
  /** Clipped to the end of the scene. */
  beats: number;
  rootPc: number;
}

/** Lays the progression across the scene, looping it if it's shorter than the scene. */
export function placeChords(progression: readonly ChordRef[], key: Key, totalBeats: number): PlacedChord[] {
  const out: PlacedChord[] = [];
  const tonic = tonicPc(key);
  let t = 0;
  for (let i = 0; t < totalBeats; i = (i + 1) % progression.length) {
    const chord = progression[i]!;
    const beats = Math.min(chord.beats, totalBeats - t);
    out.push({ chord, start: t, beats, rootPc: mod12(tonic + chord.root) });
    t += chord.beats;
  }
  return out;
}

/** Hit times (beat offset, length) for one chord, by comping style. */
function compRhythm(style: CompStyle, beats: number): { at: number; len: number; strum: number }[] {
  switch (style) {
    case 'sustain':
      return [{ at: 0, len: beats, strum: 0.01 }];
    case 'lazy':
      // Strummed a hair late and let ring, the classic lofi keys feel.
      return [{ at: 0.06, len: beats - 0.3, strum: 0.035 }];
    case 'stabs': {
      const hits: { at: number; len: number; strum: number }[] = [];
      for (let bar = 0; bar < beats; bar += 4) {
        for (const [at, len] of [[0, 0.9], [1.5, 0.4], [3, 0.4]] as const) {
          if (bar + at < beats) hits.push({ at: bar + at, len: Math.min(len, beats - bar - at), strum: 0.01 });
        }
      }
      return hits;
    }
    case 'arp':
      return [];
  }
}

export function compChords(
  placed: readonly PlacedChord[],
  backing: Backing['chords'],
  carry: { voicing: number[] | null },
): NoteEvent[] {
  const out: NoteEvent[] = [];
  const base = { track: 'backing:chords', instrument: backing.instrument, source: 'chords' as const, brightness: 0.6 };
  for (const p of placed) {
    const voicing = voiceChord(p.rootPc, p.chord.quality, carry.voicing);
    carry.voicing = voicing;
    if (backing.style === 'arp') {
      // Up and back down in eighths, letting each note ring a little.
      const order = [...voicing, ...voicing.slice(1, -1).reverse()];
      for (let i = 0; i * 0.5 < p.beats; i++) {
        out.push({ ...base, time: p.start + i * 0.5, duration: Math.min(0.9, p.beats - i * 0.5), midi: order[i % order.length]!, velocity: i % 4 === 0 ? 0.55 : 0.42 });
      }
      continue;
    }
    for (const hit of compRhythm(backing.style, p.beats)) {
      voicing.forEach((midi, i) => {
        const at = hit.at + i * hit.strum;
        out.push({ ...base, time: p.start + at, duration: Math.max(0.1, hit.len - i * hit.strum), midi, velocity: 0.5 - i * 0.03 });
      });
    }
  }
  return out;
}

const BASS_RANGE: readonly [number, number] = [33, 52];

function nearestInRange(pc: number, target: number, range = BASS_RANGE): number {
  let best = -1;
  for (let n = range[0]; n <= range[1]; n++) {
    if (mod12(n) === pc && (best < 0 || Math.abs(n - target) < Math.abs(best - target))) best = n;
  }
  return best;
}

function chordTone(p: PlacedChord, kind: 'third' | 'fifth' | 'seventh'): number {
  const tones = QUALITIES[p.chord.quality].tones.map((t) => t % 12);
  const pick = (options: number[], fallback: number) => options.find((o) => tones.includes(o)) ?? fallback;
  const interval = kind === 'third' ? pick([4, 3, 5, 2], 4) : kind === 'fifth' ? pick([7, 6, 8], 7) : pick([10, 11, 9], 10);
  return mod12(p.rootPc + interval);
}

export function bassLine(placed: readonly PlacedChord[], style: BassStyle, carry: { last: number }): NoteEvent[] {
  const out: NoteEvent[] = [];
  const base = { track: 'backing:bass', instrument: 'bass' as const, source: 'bass' as const, brightness: 0.5 };
  const add = (time: number, duration: number, midi: number, velocity: number) => {
    out.push({ ...base, time, duration, midi, velocity });
    carry.last = midi;
  };

  placed.forEach((p, idx) => {
    const root = nearestInRange(p.rootPc, carry.last);
    const fifth = nearestInRange(chordTone(p, 'fifth'), root + 5);
    const next = placed[idx + 1] ?? placed[0]!;

    if (style === 'walking') {
      const tones = [root, nearestInRange(chordTone(p, 'third'), root + 4), fifth, nearestInRange(chordTone(p, 'seventh'), root + 9)];
      for (let b = 0; b < p.beats; b++) {
        const last = b === Math.ceil(p.beats) - 1 && p.beats > 1;
        // The last beat walks into the next root by a half step.
        const nextRoot = nearestInRange(next.rootPc, carry.last);
        const midi = b === 0 ? root : last ? nextRoot + (nextRoot > carry.last ? -1 : 1) : tones[b % tones.length]!;
        add(p.start + b, 0.9, midi, b === 0 ? 0.78 : 0.62);
      }
      return;
    }

    for (let bar = 0; bar < p.beats; bar += 4) {
      const left = p.beats - bar;
      if (style === 'roots') {
        add(p.start + bar, Math.min(2.75, left - 0.1), root, 0.75);
        if (left > 3) add(p.start + bar + 3, 0.75, bar % 8 === 0 ? fifth : root + 12 <= BASS_RANGE[1] ? root + 12 : root, 0.6);
      } else {
        add(p.start + bar, Math.min(1.5, left - 0.1), root, 0.8);
        if (left > 2.5) add(p.start + bar + 2.5, 0.4, root, 0.55);
        if (left > 3.5) add(p.start + bar + 3.5, 0.4, fifth, 0.5);
      }
    }
  });
  return out;
}

export function drumPart(groove: GrooveId, totalBeats: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  const bars = Math.ceil(totalBeats / 4);
  for (let bar = 0; bar < bars; bar++) {
    // Turnaround fills land on every 4th bar and on the scene's last bar.
    const turnaround = bar === bars - 1 || bar % 4 === 3;
    for (const hit of grooveBar(groove, turnaround)) {
      const time = bar * 4 + hit.beat;
      if (time >= totalBeats) continue;
      out.push({
        time,
        duration: 0.25,
        midi: DRUM_PIECES[hit.piece].gm,
        velocity: hit.velocity,
        track: 'backing:drums',
        instrument: 'drums',
        source: 'drums',
        drum: hit.piece,
        brightness: 0.6,
      });
    }
  }
  return out;
}
