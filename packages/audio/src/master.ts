// The shared lofi chain every track runs through, plus the ambience (crackle, hiss, rain).
//
//   tracks → input → drive → saturate → trim → warmth low-pass → wobble ┬→ bus → high-pass → comp → makeup ─┐
//                                                                       └→ reverb → return ┘                 │
//   crackle + hiss + rain ───────────────────────────────────────────────────────────────────→ fader → limiter → out
//
// Ambience joins after the compressor so rain never makes the music pump.
// Only native-node effects are used, so this renders identically in Node (see DOCS/ERRORS.md).

import * as Tone from 'tone';
import { createRng, type Mix } from '@haku/core';
import { bankBuffer, type SampleBank } from './bank.ts';
import { CRACKLE_DB, HISS_DB, LIMITER_DB, MASTER_MAKEUP_DB, RAIN_DB, REVERB_RETURN, dbToGain, faderToGain } from './levels.ts';

/** Seconds of generated vinyl crackle. Long enough that the loop isn't noticeable. */
const CRACKLE_SECONDS = 7;

function crackleBuffer(sampleRate: number): Tone.ToneAudioBuffer {
  const rand = createRng(7);
  const data = new Float32Array(Math.floor(sampleRate * CRACKLE_SECONDS));
  let i = 0;
  while (i < data.length) {
    // Mostly tiny ticks, with an occasional louder pop.
    i += Math.floor(-Math.log(1 - rand()) * sampleRate / 38);
    const pop = rand() < 0.04;
    const amp = (pop ? 0.6 + rand() * 0.4 : 0.05 + rand() ** 3 * 0.35) * (rand() < 0.5 ? -1 : 1);
    const len = pop ? 24 + Math.floor(rand() * 40) : 2 + Math.floor(rand() * 6);
    for (let k = 0; k < len && i + k < data.length; k++) data[i + k]! += amp * Math.exp(-k / (len / 3));
  }
  // One-pole high-pass so the ticks don't thump.
  let prevIn = 0;
  let prevOut = 0;
  for (let k = 0; k < data.length; k++) {
    const x = data[k]!;
    prevOut = 0.97 * (prevOut + x - prevIn);
    prevIn = x;
    data[k] = prevOut;
  }
  return Tone.ToneAudioBuffer.fromArray(data);
}

/** tanh curve, normalized so full scale in stays near full scale out. */
function tapeCurve(drive = 2.2) {
  const n = 2048;
  const curve = new Float32Array(n);
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  return curve;
}

export class MasterChain {
  readonly input = new Tone.Gain(1);
  readonly ready: Promise<void>;
  private readonly drive = new Tone.Gain(1);
  private readonly saturate = new Tone.WaveShaper(tapeCurve(), 2048);
  private readonly trim = new Tone.Gain(1);
  private readonly warmth = new Tone.Filter({ type: 'lowpass', frequency: 16000, rolloff: -12, Q: 0.4 });
  private readonly wobble = new Tone.Vibrato({ frequency: 0.55, depth: 0, maxDelay: 0.006, type: 'sine' });
  private readonly reverb = new Tone.Reverb({ decay: 3.2, preDelay: 0.02, wet: 1 });
  private readonly reverbReturn = new Tone.Gain(0);
  private readonly bus = new Tone.Gain(1);
  private readonly highpass = new Tone.Filter({ type: 'highpass', frequency: 32, rolloff: -12 });
  private readonly comp = new Tone.Compressor({ threshold: -20, ratio: 3, attack: 0.015, release: 0.25, knee: 8 });
  private readonly makeup = new Tone.Gain(dbToGain(MASTER_MAKEUP_DB));
  private readonly fader = new Tone.Gain(1);
  private readonly limiter = new Tone.Limiter(LIMITER_DB);

  private readonly crackle: Tone.Player;
  private readonly crackleGain = new Tone.Gain(0);
  private readonly hiss = new Tone.Noise('pink');
  private readonly hissGain = new Tone.Gain(0);
  private readonly hissFilter = new Tone.Filter({ type: 'bandpass', frequency: 5000, Q: 0.4 });
  private readonly rain = new Tone.Player({ loop: true, fadeIn: 1.5, fadeOut: 0.5 });
  private readonly rainGain = new Tone.Gain(0);
  private rainFile: string | null = null;

  private readonly bank: SampleBank;

  constructor(bank: SampleBank) {
    this.bank = bank;
    this.input.chain(this.drive, this.saturate, this.trim, this.warmth, this.wobble);
    this.wobble.connect(this.bus);
    this.wobble.chain(this.reverb, this.reverbReturn, this.bus);
    this.bus.chain(this.highpass, this.comp, this.makeup, this.fader, this.limiter, Tone.getDestination());

    this.crackle = new Tone.Player({ url: crackleBuffer(Tone.getContext().sampleRate), loop: true });
    this.crackle.chain(this.crackleGain, this.fader);
    this.hiss.chain(this.hissFilter, this.hissGain, this.fader);
    this.rain.chain(this.rainGain, this.fader);
    this.ready = this.reverb.ready;
  }

  apply(mix: Mix) {
    const w = mix.warmth;
    // Push into the tape curve harder as warmth goes up, then pull the level back down.
    this.drive.gain.value = dbToGain(w * 10);
    this.trim.gain.value = dbToGain(-w * 8);
    this.warmth.frequency.value = 16000 * (2600 / 16000) ** w;

    this.wobble.depth.value = mix.wobble * 0.35;
    this.wobble.frequency.value = 0.4 + mix.wobble * 0.5;
    this.reverbReturn.gain.value = mix.reverb * REVERB_RETURN;
    this.fader.gain.value = faderToGain(mix.master) * 1.56; // 0.8 (the default) lands at unity

    this.crackleGain.gain.value = mix.crackle > 0 ? dbToGain(CRACKLE_DB) * mix.crackle ** 1.5 : 0;
    this.hissGain.gain.value = mix.crackle > 0 ? dbToGain(HISS_DB) * mix.crackle : 0;

    const file = this.bank.manifest.ambience[mix.rain.kind === 'roof' ? 'rain_roof' : 'rain_window'].file;
    if (file !== this.rainFile) {
      this.rainFile = file;
      this.rain.buffer = bankBuffer(this.bank, file);
    }
    this.rainGain.gain.value = mix.rain.enabled ? dbToGain(RAIN_DB) * faderToGain(mix.rain.level) : 0;
  }

  /** Starts crackle, hiss, and rain. They loop on their own clock, not the transport. */
  startAmbience(time: number, rainOffset = 0) {
    if (this.crackle.state !== 'started') this.crackle.start(time);
    if (this.hiss.state !== 'started') this.hiss.start(time);
    if (this.rain.state !== 'started' && this.rain.loaded) this.rain.start(time, rainOffset);
  }

  stopAmbience(time: number) {
    this.crackle.stop(time);
    this.hiss.stop(time);
    this.rain.stop(time);
  }

  dispose() {
    for (const n of [
      this.input, this.drive, this.saturate, this.trim, this.warmth, this.wobble, this.reverb, this.reverbReturn,
      this.bus, this.highpass, this.comp, this.makeup, this.fader, this.limiter,
      this.crackle, this.crackleGain, this.hiss, this.hissGain, this.hissFilter, this.rain, this.rainGain,
    ]) n.dispose();
  }
}
