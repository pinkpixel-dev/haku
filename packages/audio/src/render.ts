// Offline rendering: the same Rig the browser plays, rendered faster than real time to a buffer.
// Used by WAV export in the browser and by the CLI in Node.

import * as Tone from 'tone';
import { beatsToSeconds, buildArrangementScore, buildSceneScore, type Project, type Score } from '@haku/core';
import type { SampleBank } from './bank.ts';
import { Rig } from './rig.ts';
import type { PcmAudio } from './wav.ts';

export interface RenderOptions {
  /** One scene (looped `loops` times) or the whole arrangement. Default scene. */
  scope?: 'scene' | 'song';
  sceneId?: string;
  /** How many times to play the scene. Default 1. */
  loops?: number;
  /** Seconds of release and reverb tail after the last bar. Default 3. */
  tail?: number;
  sampleRate?: number;
}

/** Humanize can nudge the first hit slightly before zero, so the transport starts a hair late. */
const LEAD_IN = 0.05;

function loopScore(score: Score, loops: number): Score {
  if (loops <= 1) return score;
  const out: Score = { ...score, beats: score.beats * loops, events: [], chords: [], sections: [] };
  for (let i = 0; i < loops; i++) {
    const at = i * score.beats;
    out.events.push(...score.events.map((e) => ({ ...e, time: e.time + at })));
    out.chords.push(...score.chords.map((c) => ({ ...c, time: c.time + at })));
    out.sections.push(...score.sections.map((s) => ({ ...s, start: s.start + at })));
  }
  return out;
}

export function scoreFor(project: Project, opts: RenderOptions = {}): Score {
  return opts.scope === 'song' ? buildArrangementScore(project) : loopScore(buildSceneScore(project, opts.sceneId), opts.loops ?? 1);
}

export async function renderProject(project: Project, bank: SampleBank, opts: RenderOptions = {}): Promise<PcmAudio> {
  const score = scoreFor(project, opts);
  const sampleRate = opts.sampleRate ?? 44100;
  const seconds = LEAD_IN + beatsToSeconds(score.beats, score.bpm) + (opts.tail ?? 3);

  const rendered = await Tone.Offline(
    async (ctx) => {
      const rig = new Rig(bank);
      rig.sync(project);
      await rig.ready;
      ctx.transport.bpm.value = score.bpm;
      rig.schedule(score);
      rig.master.startAmbience(0);
      ctx.transport.start(LEAD_IN);
    },
    seconds,
    2,
    sampleRate,
  );

  const buffer = rendered.get();
  if (!buffer) throw new Error('Render came back empty');
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  return { sampleRate: buffer.sampleRate, channels };
}

/** Peak and RMS in dBFS, for checking the mix. */
export function measure({ channels }: PcmAudio): { peakDb: number; rmsDb: number } {
  let peak = 0;
  let sum = 0;
  let n = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i]!;
      if (!Number.isFinite(v)) return { peakDb: Number.NaN, rmsDb: Number.NaN };
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
      n++;
    }
  }
  const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  return { peakDb: db(peak), rmsDb: db(Math.sqrt(sum / Math.max(1, n))) };
}
