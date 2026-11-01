import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setupNodeAudio, nodeDecoder, readManifest } from '@haku/audio/node';
setupNodeAudio();
const core = await import('@haku/core');
const { execute } = await import('@haku/protocol');
const { loadSampleBank, renderProject, integratedLoudness, measure, encodeWav } = await import('@haku/audio');
const dir = resolve(import.meta.dirname, '../assets/samples');
const bank = await loadSampleBank(await readManifest(dir), nodeDecoder(dir));
for (const [mood, instrument, style] of [['rainy-study', 'wurli', 'lazy'], ['rainy-study', 'vibes', 'lazy'], ['dusk-walk', 'vibes', 'shells'], ['sunny-cafe', 'piano', 'stabs'], ['sunny-cafe', 'guitar', 'stabs'], ['late-night-train', 'guitar', 'rolled']]) {
  let p = core.createProject({ name: mood, mood, seed: 42 });
  const run = (cmd) => (p = execute(p, cmd).project);
  run({ type: 'set_backing', chords: { instrument, style } });
  run({ type: 'draw_shape', shape: 'wave', x: 0.02, y: 0.45, width: 0.96, height: 0.35, cycles: 3, duration_ms: 1400 });
  const audio = await renderProject(p, bank, { loops: 2 });
  const name = `band-${instrument}_${style}_${mood}.wav`;
  if (instrument === 'vibes' || instrument === 'guitar') await writeFile(join(process.argv[2], name), encodeWav(audio));
  console.log(name.padEnd(40), integratedLoudness(audio).toFixed(1), 'LUFS  peak', measure(audio).peakDb.toFixed(1));
}
