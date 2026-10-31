// One voice per instrument. Sampled instruments pick a velocity layer per note, synths are built
// from Tone's native-node synths (no AudioWorklets, so they render in Node too), and the drum kit
// fires one-shot buffer sources with round robins.

import * as Tone from 'tone';
import { DRUM_PIECE_IDS, INSTRUMENTS, pickLayer, type DrumPiece, type InstrumentId, type NoteEvent } from '@haku/core';
import { bankBuffer, type SampleBank } from './bank.ts';
import { DRUM_TRIM_DB, INSTRUMENT_TRIM_DB, SAMPLE_LAYER_LIFT_DB, dbToGain, sampleVelocityGain } from './levels.ts';

export interface Voice {
  readonly output: Tone.Gain;
  /** time is in context seconds, seconds is the note length. */
  play(e: NoteEvent, time: number, seconds: number): void;
  dispose(): void;
}

/** Brush size sets brightness: 0 is a dark ~1 kHz low-pass, 1 is wide open. */
const brightnessHz = (b: number) => 1000 * 2 ** (Math.max(0, Math.min(1, b)) * 4);

type Synthish = { triggerAttackRelease(note: Tone.Unit.Frequency, dur: number, time: number, velocity: number): unknown; dispose(): unknown };

/** Wraps a playable thing with a brightness filter and the instrument trim. */
function filteredVoice(instrument: InstrumentId, pick: (e: NoteEvent) => Synthish, nodes: Tone.ToneAudioNode[], filter: Tone.Filter): Voice {
  const output = new Tone.Gain(dbToGain(INSTRUMENT_TRIM_DB[instrument]));
  filter.connect(output);
  return {
    output,
    play(e, time, seconds) {
      filter.frequency.setValueAtTime(brightnessHz(e.brightness), time);
      pick(e).triggerAttackRelease(Tone.Frequency(e.midi, 'midi').toFrequency(), seconds, time, e.velocity);
    },
    dispose() {
      for (const n of nodes) n.dispose();
      filter.dispose();
      output.dispose();
    },
  };
}

function sampledVoice(instrument: InstrumentId, bank: SampleBank): Voice {
  const def = bank.manifest.instruments[instrument];
  if (!def) throw new Error(`No samples for ${instrument}`);
  const filter = new Tone.Filter({ type: 'lowpass', frequency: 12000, rolloff: -12 });
  const lifts = SAMPLE_LAYER_LIFT_DB[instrument] ?? [];
  const nodes: Tone.ToneAudioNode[] = [];
  const layers = def.layers.map((layer, i) => {
    const urls: Record<number, Tone.ToneAudioBuffer> = {};
    for (const [midi, file] of Object.entries(layer.zones)) urls[Number(midi)] = bankBuffer(bank, file);
    const lift = new Tone.Gain(dbToGain(lifts[i] ?? 0)).connect(filter);
    const sampler = new Tone.Sampler({ urls, release: def.release }).connect(lift);
    nodes.push(sampler, lift);
    return { maxVelocity: layer.maxVelocity, sampler };
  });
  const play = (e: NoteEvent) => {
    const { sampler } = pickLayer(layers, e.velocity);
    return {
      triggerAttackRelease: (note: Tone.Unit.Frequency, dur: number, time: number, velocity: number) =>
        sampler.triggerAttackRelease(note, dur, time, sampleVelocityGain(velocity)),
      dispose() {},
    };
  };
  return filteredVoice(instrument, play, nodes, filter);
}

function synthVoice(instrument: InstrumentId): Voice {
  const filter = new Tone.Filter({ type: 'lowpass', frequency: 8000, rolloff: -12 });
  let synth: Tone.PolySynth;
  switch (instrument) {
    case 'fm-ep':
      // A tine-ish electric piano: 1:1 FM with a fast-decaying modulator.
      synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1,
        modulationIndex: 3.5,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.002, decay: 1.8, sustain: 0.18, release: 0.9 },
        modulationEnvelope: { attack: 0.002, decay: 0.45, sustain: 0.08, release: 0.6 },
      });
      break;
    case 'pad':
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 16 },
        envelope: { attack: 0.9, decay: 0.6, sustain: 0.8, release: 2.4 },
      });
      filter.Q.value = 0.5;
      break;
    case 'pluck':
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.003, decay: 0.4, sustain: 0, release: 0.35 },
      });
      break;
    case 'bass':
      // Round and soft: a triangle through a short filter envelope. Poly so chalk strokes still work.
      synth = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.008, decay: 0.35, sustain: 0.65, release: 0.35 },
        filter: { Q: 1, type: 'lowpass', rolloff: -24 },
        filterEnvelope: { attack: 0.005, decay: 0.25, sustain: 0.35, release: 0.4, baseFrequency: 110, octaves: 2.6 },
      });
      synth.maxPolyphony = 4;
      break;
    default:
      throw new Error(`${instrument} isn't a synth`);
  }
  synth.connect(filter);
  return filteredVoice(instrument, () => synth, [synth], filter);
}

function drumVoice(bank: SampleBank): Voice {
  const output = new Tone.Gain(dbToGain(INSTRUMENT_TRIM_DB.drums));
  // Built up front: nothing can be created inside an offline render's callbacks except one-shots.
  const pieces = new Map<DrumPiece, Tone.Gain>(
    DRUM_PIECE_IDS.map((piece) => [piece, new Tone.Gain(dbToGain(DRUM_TRIM_DB[piece])).connect(output)]),
  );
  return {
    output,
    play(e, time) {
      const piece = e.drum;
      const layers = piece && bank.manifest.drums.pieces[piece];
      if (!piece || !layers?.length) return;
      const files = pickLayer(layers, e.velocity).files;
      // Round robin from the note's position, so the same score always picks the same file.
      const file = files[Math.floor(e.time * 4 + 0.01) % files.length]!;
      // Pin the context: during an offline render Tone has already switched the global one back.
      const src = new Tone.ToneBufferSource({ url: bankBuffer(bank, file), context: output.context }).connect(pieces.get(piece)!);
      src.onended = () => src.dispose();
      src.start(time, 0, undefined, e.velocity ** 1.2);
    },
    dispose() {
      for (const g of pieces.values()) g.dispose();
      output.dispose();
    },
  };
}

export function createVoice(instrument: InstrumentId, bank: SampleBank): Voice {
  if (INSTRUMENTS[instrument].kind === 'drums') return drumVoice(bank);
  if (bank.manifest.instruments[instrument]) return sampledVoice(instrument, bank);
  return synthVoice(instrument);
}
