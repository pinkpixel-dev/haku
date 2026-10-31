// MIDI export. One track per drawn layer plus one per backing part, drums on channel 10.

import * as midiModule from '@tonejs/midi';
import { INSTRUMENTS } from './model/constants.ts';
import type { Project } from './model/schema.ts';
import type { Score } from './engine/types.ts';

// @tonejs/midi ships CommonJS for Node (only a default export there) and ESM for bundlers.
const Midi: typeof midiModule.Midi =
  midiModule.Midi ?? (midiModule as unknown as { default: typeof midiModule }).default.Midi;

export { Midi };

function trackName(project: Project, track: string): string {
  if (track === 'backing:chords') return 'Chords';
  if (track === 'backing:bass') return 'Bass';
  if (track === 'backing:drums') return 'Drums';
  for (const scene of project.scenes) {
    const layer = scene.layers.find((l) => l.id === track);
    if (layer) return layer.name;
  }
  return track;
}

/** Volume per track, so the MIDI file roughly matches the mix. */
function trackVolume(project: Project, track: string): number {
  const scene = project.scenes.find((s) => s.layers.some((l) => l.id === track)) ?? project.scenes[0]!;
  if (track === 'backing:chords') return scene.backing.chords.volume;
  if (track === 'backing:bass') return scene.backing.bass.volume;
  if (track === 'backing:drums') return scene.backing.drums.volume;
  return scene.layers.find((l) => l.id === track)?.volume ?? 0.8;
}

export function scoreToMidi(project: Project, score: Score): Uint8Array {
  const midi = new Midi();
  midi.name = project.name;
  midi.header.setTempo(score.bpm);
  const ppq = midi.header.ppq;
  const tracks = new Map<string, ReturnType<typeof midi.addTrack>>();
  let nextChannel = 0;

  for (const e of score.events) {
    let track = tracks.get(e.track);
    if (!track) {
      track = midi.addTrack();
      track.name = trackName(project, e.track);
      if (e.instrument === 'drums') {
        track.channel = 9;
      } else {
        track.channel = nextChannel === 9 ? ++nextChannel : nextChannel;
        nextChannel = (track.channel + 1) % 16;
        track.instrument.number = INSTRUMENTS[e.instrument].gm;
      }
      tracks.set(e.track, track);
    }
    // Scale velocity by track volume, but keep quiet notes audible.
    const velocity = Math.max(0.04, Math.min(1, e.velocity * (0.4 + 0.6 * trackVolume(project, e.track))));
    track.addNote({
      midi: e.midi,
      ticks: Math.round(e.time * ppq),
      durationTicks: Math.max(1, Math.round(e.duration * ppq)),
      velocity,
    });
  }
  return midi.toArray();
}
