// Renders projects offline to WAV and prints their levels, for tuning the mix by measurement.
//
//   pnpm render                        every mood with a demo melody, into ./renders
//   pnpm render --mood sunny-cafe      just one mood
//   pnpm render --project song.json    a saved project file (the whole arrangement)
//   pnpm render --out some/dir         somewhere else

import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { setupNodeAudio, nodeDecoder, readManifest } from '@haku/audio/node';

setupNodeAudio();
const { createProject, parseProject, MOOD_IDS } = await import('@haku/core');
const { execute } = await import('@haku/protocol');
const { loadSampleBank, renderProject, encodeWav, measure } = await import('@haku/audio');

const { values: args } = parseArgs({
  options: {
    mood: { type: 'string' },
    project: { type: 'string' },
    out: { type: 'string', default: 'renders' },
    loops: { type: 'string', default: '2' },
  },
});

const samplesDir = resolve(import.meta.dirname, '../assets/samples');
const bank = await loadSampleBank(await readManifest(samplesDir), nodeDecoder(samplesDir));
await mkdir(args.out, { recursive: true });

/** A short melody plus a sparkle layer, so every instrument in the mood is heard. */
function demoProject(mood) {
  let p = createProject({ name: mood, mood, seed: 42 });
  const run = (cmd) => (p = execute(p, cmd).project);
  run({ type: 'draw_shape', shape: 'wave', x: 0.02, y: 0.45, width: 0.46, height: 0.35, cycles: 2, duration_ms: 1400 });
  run({ type: 'draw_shape', shape: 'stairs-down', x: 0.52, y: 0.4, width: 0.44, height: 0.4, cycles: 4, brush: 'brush' });
  run({ type: 'add_layer', instrument: 'glock', name: 'Sparkle' });
  run({ type: 'draw_line', layer: 'Sparkle', brush: 'spray', from: { x: 0.5, y: 0.3 }, to: { x: 0.98, y: 0.6 } });
  return p;
}

function lufs(file) {
  // ebur128 prints its summary to stderr.
  const { stderr } = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  return stderr?.match(/Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/)?.[1] ?? '?';
}

async function renderOne(name, project, opts) {
  const started = performance.now();
  const audio = await renderProject(project, bank, opts);
  const file = join(args.out, `${name}.wav`);
  await writeFile(file, encodeWav(audio));
  const { peakDb, rmsDb } = measure(audio);
  const secs = audio.channels[0].length / audio.sampleRate;
  console.log(
    `${name.padEnd(18)} ${secs.toFixed(1).padStart(5)} s   peak ${peakDb.toFixed(1).padStart(6)} dBFS   rms ${rmsDb.toFixed(1).padStart(6)} dBFS   ${lufs(file)} LUFS   (${((performance.now() - started) / 1000).toFixed(1)} s)`,
  );
}

if (args.project) {
  const project = parseProject(JSON.parse(await readFile(args.project, 'utf8')));
  await renderOne(project.name.replace(/[^\w-]+/g, '-'), project, { scope: 'song' });
} else {
  for (const mood of args.mood ? [args.mood] : MOOD_IDS) {
    await renderOne(mood, demoProject(mood), { loops: Number(args.loops) });
  }
}
