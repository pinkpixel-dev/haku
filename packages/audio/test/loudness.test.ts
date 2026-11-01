import { describe, expect, it } from 'vitest';
import { integratedLoudness } from '../src/loudness.ts';

const sine = (seconds: number, freq: number, peakDb: number, sampleRate = 48000) => {
  const amp = 10 ** (peakDb / 20);
  const ch = Float32Array.from({ length: Math.round(seconds * sampleRate) }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / sampleRate));
  return { sampleRate, channels: [ch, ch.slice()] };
};

describe('integratedLoudness', () => {
  // BS.1770 calibration: a 1 kHz sine at -20 dBFS in both channels reads -20 LUFS.
  it('reads a calibration tone correctly at 48 and 44.1 kHz', () => {
    expect(integratedLoudness(sine(5, 1000, -20))).toBeCloseTo(-20, 1);
    expect(integratedLoudness(sine(5, 1000, -20, 44100))).toBeCloseTo(-20, 1);
  });

  it('follows level changes one for one', () => {
    expect(integratedLoudness(sine(5, 1000, -30)) - integratedLoudness(sine(5, 1000, -20))).toBeCloseTo(-10, 1);
  });

  it('weights low bass down', () => {
    expect(integratedLoudness(sine(5, 30, -20))).toBeLessThan(-21);
  });

  it('returns -Infinity for silence', () => {
    expect(integratedLoudness({ sampleRate: 48000, channels: [new Float32Array(48000), new Float32Array(48000)] })).toBe(-Infinity);
  });
});
