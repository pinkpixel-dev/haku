// The playing band: one channel per track (a drawn layer, or a scene's chords, bass, or drums),
// each holding voices for the instruments it plays, all feeding the master chain.
// The browser and the offline renderer both build a Rig, sync it to a project, and schedule a score.

import * as Tone from 'tone';
import { beatsToSeconds, type InstrumentId, type NoteEvent, type Project, type Score } from '@haku/core';
import type { SampleBank } from './bank.ts';
import { createVoice, type Voice } from './instruments.ts';
import { MasterChain } from './master.ts';
import { faderToGain } from './levels.ts';

interface Track {
  channel: Tone.Channel;
  voices: Map<InstrumentId, Voice>;
}

interface TrackSettings {
  volume: number;
  pan: number;
}

const BACKING = ['chords', 'bass', 'drums'] as const;

/**
 * Backing tracks are per scene, so each scene's band volume holds in a full-song render.
 * Drawn layers already have unique ids.
 */
export function trackKey(e: Pick<NoteEvent, 'track' | 'time'>, score: Pick<Score, 'sections'>): string {
  if (!e.track.startsWith('backing:')) return e.track;
  const section = score.sections.findLast((s) => e.time >= s.start - 0.5) ?? score.sections[0];
  return `${e.track}@${section?.sceneId ?? ''}`;
}

function trackSettings(project: Project): Map<string, TrackSettings> {
  const out = new Map<string, TrackSettings>();
  for (const scene of project.scenes) {
    for (const layer of scene.layers) out.set(layer.id, { volume: layer.volume, pan: layer.pan });
    for (const part of BACKING) out.set(`backing:${part}@${scene.id}`, { volume: scene.backing[part].volume, pan: 0 });
  }
  return out;
}

export class Rig {
  readonly master: MasterChain;
  readonly ready: Promise<void>;
  private readonly bank: SampleBank;
  private readonly tracks = new Map<string, Track>();
  private settings = new Map<string, TrackSettings>();
  private part: Tone.Part<{ time: number; e: NoteEvent; key: string; seconds: number }> | null = null;

  constructor(bank: SampleBank) {
    this.bank = bank;
    this.master = new MasterChain(bank);
    this.ready = this.master.ready;
  }

  /** Applies volumes, pans, and the mix. Cheap, so the UI can call it on every change. */
  sync(project: Project) {
    this.settings = trackSettings(project);
    this.master.apply(project.mix);
    for (const [key, track] of this.tracks) {
      const s = this.settings.get(key);
      if (!s) {
        this.disposeTrack(key, track);
        continue;
      }
      this.applySettings(track, s);
    }
  }

  private applySettings(track: Track, s: TrackSettings) {
    const gain = faderToGain(s.volume) * 1.56; // 0.8 is unity
    track.channel.volume.value = gain > 0 ? Tone.gainToDb(gain) : -Infinity;
    track.channel.pan.value = s.pan;
  }

  private voice(key: string, instrument: InstrumentId): Voice {
    let track = this.tracks.get(key);
    if (!track) {
      track = { channel: new Tone.Channel().connect(this.master.input), voices: new Map() };
      this.applySettings(track, this.settings.get(key) ?? { volume: 0.8, pan: 0 });
      this.tracks.set(key, track);
    }
    let voice = track.voices.get(instrument);
    if (!voice) {
      voice = createVoice(instrument, this.bank);
      voice.output.connect(track.channel);
      track.voices.set(instrument, voice);
    }
    return voice;
  }

  /**
   * Schedules a score on the current context's transport, replacing whatever was scheduled before.
   * Voices are created up front so nothing gets built in the middle of playback.
   */
  schedule(score: Score) {
    this.part?.dispose();
    const events = score.events.map((e) => {
      const key = trackKey(e, score);
      this.voice(key, e.instrument);
      return {
        time: Math.max(0, beatsToSeconds(e.time, score.bpm)),
        e,
        key,
        seconds: Math.max(0.03, beatsToSeconds(e.duration, score.bpm)),
      };
    });
    this.part = new Tone.Part((time, ev) => this.voice(ev.key, ev.e.instrument).play(ev.e, time, ev.seconds), events);
    this.part.start(0);
  }

  clear() {
    this.part?.dispose();
    this.part = null;
  }

  private disposeTrack(key: string, track: Track) {
    for (const v of track.voices.values()) v.dispose();
    track.channel.dispose();
    this.tracks.delete(key);
  }

  dispose() {
    this.clear();
    for (const [key, track] of this.tracks) this.disposeTrack(key, track);
    this.master.dispose();
  }
}
