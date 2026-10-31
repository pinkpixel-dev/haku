import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { nodeDecoder, readManifest, setupNodeAudio } from '../src/node.ts';

// Tone must only be imported after the Node audio globals exist.
setupNodeAudio();
const { createProject, beatsToSeconds } = await import('@haku/core');
const { execute } = await import('@haku/protocol');
const audio = await import('../src/index.ts');

const samplesDir = resolve(import.meta.dirname, '../../../assets/samples');
let bank: Awaited<ReturnType<typeof audio.loadSampleBank>>;

beforeAll(async () => {
  bank = await audio.loadSampleBank(await readManifest(samplesDir), nodeDecoder(samplesDir));
}, 30_000);

describe('offline render', () => {
  it('renders a mood with drawn notes to a sensible level', async () => {
    let p = createProject({ mood: 'rainy-study', seed: 1, bars: 2 });
    p = execute(p, { type: 'draw_shape', shape: 'wave', x: 0, y: 0.5, width: 1, height: 0.3, cycles: 2 }).project;
    p = execute(p, { type: 'add_layer', instrument: 'fm-ep' }).project;
    p = execute(p, { type: 'draw_line', layer: 'FM keys', from: { x: 0, y: 0.6 }, to: { x: 1, y: 0.4 } }).project;

    const out = await audio.renderProject(p, bank, { tail: 1 });
    const seconds = out.channels[0]!.length / out.sampleRate;
    expect(out.channels).toHaveLength(2);
    expect(seconds).toBeCloseTo(0.05 + beatsToSeconds(8, p.bpm) + 1, 1);

    const { peakDb, rmsDb } = audio.measure(out);
    expect(Number.isFinite(peakDb)).toBe(true);
    expect(peakDb).toBeLessThan(0);
    expect(rmsDb).toBeGreaterThan(-35);
  }, 60_000);

  it('is silent with every part muted and no ambience', async () => {
    let p = createProject({ mood: 'sunny-cafe', seed: 1, bars: 1 });
    p = execute(p, { type: 'set_backing', chords: { enabled: false }, bass: { enabled: false }, drums: { enabled: false } }).project;
    p = execute(p, { type: 'mix', crackle: 0, rain: { enabled: false } }).project;
    const { peakDb } = audio.measure(await audio.renderProject(p, bank, { tail: 0.5 }));
    expect(peakDb).toBeLessThan(-90);
  }, 60_000);
});

describe('trackKey', () => {
  const score = { sections: [{ sceneId: 'a', name: 'A', start: 0, beats: 16 }, { sceneId: 'b', name: 'B', start: 16, beats: 16 }] };

  it('keeps drawn layer ids as they are', () => {
    expect(audio.trackKey({ track: 'l_1', time: 20 }, score)).toBe('l_1');
  });

  it('splits backing tracks by scene, tolerating humanize pulling a note early', () => {
    expect(audio.trackKey({ track: 'backing:bass', time: 3 }, score)).toBe('backing:bass@a');
    expect(audio.trackKey({ track: 'backing:bass', time: 15.98 }, score)).toBe('backing:bass@b');
    expect(audio.trackKey({ track: 'backing:bass', time: 17 }, score)).toBe('backing:bass@b');
  });
});

describe('encodeWav', () => {
  it('writes a 16-bit stereo PCM header and clamps samples', () => {
    const wav = audio.encodeWav({ sampleRate: 44100, channels: [new Float32Array([0, 2]), new Float32Array([0, -2])] });
    const view = new DataView(wav.buffer);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe('RIFF');
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getInt16(48, true)).toBe(32767);
    expect(view.getInt16(50, true)).toBe(-32767);
  });
});
