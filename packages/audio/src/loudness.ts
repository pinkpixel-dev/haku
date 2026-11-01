// Integrated loudness (ITU-R BS.1770-4, the LUFS number streaming services quote), so the CLI can
// report levels without shelling out to ffmpeg. K-weighting is a high shelf plus a high-pass; then
// 400 ms blocks with 75% overlap, an absolute gate at -70 LUFS, and a relative gate 10 LU down.

import type { PcmAudio } from './wav.ts';

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/**
 * The two K-weighting stages for any sample rate (the spec only lists 48 kHz). This is the bilinear
 * form libebur128 uses; at 48 kHz it reproduces the spec's coefficients exactly.
 */
function kWeighting(fs: number): [Biquad, Biquad] {
  const shelf = (() => {
    const gain = 3.999843853973347;
    const q = 0.7071752369554196;
    const k = Math.tan((Math.PI * 1681.974450955533) / fs);
    const vh = 10 ** (gain / 20);
    const vb = vh ** 0.4996667741545416;
    const a0 = 1 + k / q + k * k;
    return {
      b0: (vh + (vb * k) / q + k * k) / a0,
      b1: (2 * (k * k - vh)) / a0,
      b2: (vh - (vb * k) / q + k * k) / a0,
      a1: (2 * (k * k - 1)) / a0,
      a2: (1 - k / q + k * k) / a0,
    };
  })();
  const highpass = (() => {
    const q = 0.5003270373238773;
    const k = Math.tan((Math.PI * 38.13547087602444) / fs);
    const a0 = 1 + k / q + k * k;
    return { b0: 1, b1: -2, b2: 1, a1: (2 * (k * k - 1)) / a0, a2: (1 - k / q + k * k) / a0 };
  })();
  return [shelf, highpass];
}

function filter(input: ArrayLike<number>, { b0, b1, b2, a1, a2 }: Biquad): Float64Array {
  const out = new Float64Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i]!;
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}

const toLufs = (energy: number) => -0.691 + 10 * Math.log10(energy);

/** Integrated loudness in LUFS. -Infinity for silence or audio shorter than one 400 ms block. */
export function integratedLoudness({ sampleRate, channels }: PcmAudio): number {
  const [shelf, highpass] = kWeighting(sampleRate);
  const weighted = channels.map((ch) => filter(filter(ch, shelf), highpass));

  const block = Math.round(0.4 * sampleRate);
  const hop = Math.round(0.1 * sampleRate);
  const length = channels[0]?.length ?? 0;
  const energies: number[] = [];
  for (let start = 0; start + block <= length; start += hop) {
    let sum = 0;
    for (const ch of weighted) {
      let s = 0;
      for (let i = start; i < start + block; i++) s += ch[i]! * ch[i]!;
      // Left and right both weigh 1.0. Haku only renders stereo.
      sum += s / block;
    }
    energies.push(sum);
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const loud = energies.filter((e) => toLufs(e) > -70);
  if (!loud.length) return -Infinity;
  const relative = toLufs(mean(loud)) - 10;
  const gated = loud.filter((e) => toLufs(e) > relative);
  return gated.length ? toLufs(mean(gated)) : -Infinity;
}
