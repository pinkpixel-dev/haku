#!/usr/bin/env node
// Builds the shipped sample set in assets/samples/ from the raw sources in assets/sources/.
// Run scripts/samples/fetch.mjs first (and grab the two Freesound rain files by hand, see DOCS/SPIKES.md).
//
// Each instrument gets one static gain so its loudest sample peaks at -1 dBFS. That keeps the natural
// balance between soft and loud layers and between registers, which per-file normalizing would flatten.
// Needs ffmpeg with libvorbis on the PATH.

import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = join(root, 'assets', 'sources');
const out = join(root, 'assets', 'samples');

const VSCO = { author: 'Versilian Studios', license: 'CC0-1.0', url: 'https://github.com/sgossner/VSCO-2-CE' };
const credits = {
  piano: { name: 'Upright Piano (VSCO 2 CE)', ...VSCO, author: 'Simon Dalzell of Ivy Audio, via Versilian Studios' },
  glock: { name: 'Glockenspiel (VSCO 2 CE)', ...VSCO },
  marimba: { name: 'Marimba (VSCO 2 CE)', ...VSCO },
  harp: { name: 'Harp (VSCO 2 CE)', ...VSCO },
  vibes: { name: 'Vibraphone, soft mallets (VCSL)', author: 'Versilian Studios', license: 'CC0-1.0', url: 'https://github.com/sgossner/VCSL' },
  kalimba: { name: 'Kalimba, Tanzania (VCSL)', author: 'Versilian Studios', license: 'CC0-1.0', url: 'https://github.com/sgossner/VCSL' },
  guitar: { name: 'Spanish classical guitar (FreePats)', author: 'roberto@zenvoid.org, for the FreePats project', license: 'CC0-1.0', url: 'https://freepats.zenvoid.org/Guitar/acoustic-guitar.html' },
  wurli: { name: 'Wurlitzer EP200', author: 'Greg Sullivan, sfz mapping by kinwie', license: 'CC-BY-3.0', url: 'https://github.com/sfzinstruments/GregSullivan.E-Pianos' },
  drums: { name: 'Big Rusty Drums', author: 'Karoryfer Samples', license: 'CC0-1.0', url: 'https://github.com/sfzinstruments/karoryfer.big-rusty-drums' },
  perc: { name: 'Shaker and cabasa (VCSL)', author: 'Versilian Studios', license: 'CC0-1.0', url: 'https://github.com/sgossner/VCSL' },
  rain_roof: { name: 'Soft rain on roof window', author: 'Metadex', license: 'CC0-1.0', url: 'https://freesound.org/people/Metadex/sounds/235827/' },
  rain_window: { name: 'January rain on a window', author: 'mmorgaine', license: 'CC0-1.0', url: 'https://freesound.org/people/mmorgaine/sounds/333510/' },
};

// ---------- helpers ----------

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-hide_banner', '-nostdin', ...args]);
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve(stderr) : reject(new Error(`ffmpeg failed (${code}):\n${stderr.slice(-800)}`))));
  });
}

async function sampleRate(file) {
  const proc = spawn('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', file]);
  let text = '';
  proc.stdout.on('data', (d) => (text += d));
  await new Promise((resolve, reject) => proc.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffprobe failed on ${file}`)))));
  return Number(text.trim());
}

async function duration(file) {
  const proc = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  let text = '';
  proc.stdout.on('data', (d) => (text += d));
  await new Promise((resolve, reject) => proc.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffprobe failed on ${file}`)))));
  return Number(text.trim());
}

async function pool(items, limit, worker) {
  let next = 0;
  const results = new Array(items.length);
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await worker(items[i], i);
      }
    }),
  );
  return results;
}

const LETTERS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** "C5", "Ab3", "db4", "F#2" to MIDI, with C4 = 60. */
function noteToMidi(name) {
  const m = /^([a-g])([#b]?)(-?\d)$/i.exec(name);
  if (!m) throw new Error(`Can't read note "${name}"`);
  const shift = m[2] === '#' ? 1 : m[2].toLowerCase() === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + LETTERS[m[1].toLowerCase()] + shift;
}

/** The trim, tune, length, and fade part of the filter chain. Gain is added after measuring. */
async function chainFor(job) {
  const filters = ['silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.002'];
  // asetrate retunes by relabeling the rate, so it has to start from the file's real rate (VCSL ships some 48 kHz files).
  if (job.tuneCents) filters.push(`asetrate=${((await sampleRate(job.input)) * 2 ** (job.tuneCents / 1200)).toFixed(2)}`, 'aresample=44100');
  if (job.volumeDb) filters.push(`volume=${job.volumeDb}dB`);
  const len = Math.min(job.maxLen, await duration(job.input));
  const fade = Math.min(job.fade ?? 0.3, len / 3);
  filters.push(`atrim=0:${len.toFixed(3)}`, `afade=t=out:st=${(len - fade).toFixed(3)}:d=${fade.toFixed(3)}`);
  return filters.join(',');
}

async function peakDb(job) {
  const log = await ffmpeg(['-i', job.input, '-af', `${job.chain},volumedetect`, '-f', 'null', '-']);
  const m = /max_volume: (-?[\d.]+) dB/.exec(log);
  if (!m) throw new Error(`No peak reading for ${job.input}`);
  return Number(m[1]);
}

/** Measures every file in a group, then encodes them all with one shared gain. */
async function encodeGroup(name, jobs) {
  await pool(jobs, 8, async (job) => (job.chain = await chainFor(job)));
  const peaks = await pool(jobs, 8, peakDb);
  const gain = -1 - Math.max(...peaks);
  await pool(jobs, 8, async (job) => {
    const dest = join(out, job.output);
    await mkdir(dirname(dest), { recursive: true });
    await ffmpeg(['-y', '-v', 'error', '-i', job.input, '-af', `${job.chain},volume=${gain.toFixed(2)}dB`, '-ar', '44100', '-c:a', 'libvorbis', '-q:a', '5', dest]);
  });
  console.log(`${name.padEnd(12)} ${String(jobs.length).padStart(3)} files  gain ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB`);
}

// ---------- instruments ----------

function pianoJobs() {
  const dir = join(src, 'vsco2-ce', 'Keys', 'Upright Piano');
  const jobs = [];
  // Index i maps to MIDI 21 + 2i (see MappingChart.txt). Only even indexes ship, so this is every major third.
  for (const [layer, dyn] of [[0, 1], [1, 2]]) {
    for (let i = 4; i <= 38; i += 2) {
      const midi = 21 + 2 * i;
      jobs.push({ input: join(dir, `Player_dyn${dyn}_rr1_${String(i).padStart(3, '0')}.wav`), output: `piano/v${layer}_${midi}.ogg`, layer, midi, maxLen: 5, fade: 0.6 });
    }
  }
  return jobs;
}

/** Reads the Wurlitzer sfz so each sample keeps its key center and the mapper's tuning and level fixes. */
async function wurliJobs() {
  const dir = join(src, 'wurlitzer-ep200', 'Wurlitzer EP200');
  const sfz = await readFile(join(dir, 'Wurlitzer EP200.sfz'), 'utf8');
  const groups = [];
  for (const line of sfz.split('\n')) {
    const lovel = /^lovel=(\d+)/.exec(line);
    if (lovel) groups.push({ lovel: Number(lovel[1]), regions: [] });
    if (line.startsWith('<region>') && groups.length) {
      const attrs = Object.fromEntries([...line.matchAll(/(\w+)=(\S+)/g)].map((m) => [m[1], m[2]]));
      groups[groups.length - 1].regions.push(attrs);
    }
  }
  // mp (velocity 38-65) as the soft layer and f (66-89) as the loud one.
  const jobs = [];
  for (const [layer, lovel] of [[0, 38], [1, 66]]) {
    const group = groups.find((g) => g.lovel === lovel);
    if (!group) throw new Error(`Wurlitzer sfz has no group starting at velocity ${lovel}`);
    const seen = new Set();
    for (const r of group.regions) {
      const midi = Number(r.pitch_keycenter);
      if (seen.has(midi)) continue;
      seen.add(midi);
      jobs.push({
        input: join(dir, 'Samples', r.sample.replace('$EXT', 'flac')),
        output: `wurli/v${layer}_${midi}.ogg`,
        layer,
        midi,
        tuneCents: Number(r.tune ?? 0),
        volumeDb: Number(r.volume ?? 0),
        maxLen: 4,
        fade: 0.5,
      });
    }
  }
  return jobs;
}

/**
 * Instruments whose files are named by note. `transpose` corrects names that don't use C4 = 60:
 * the VSCO glock and marimba files both sound an octave above their names (checked by pitch detection).
 */
function namedJobs(dir, pattern, prefix, maxLen, transpose = 0) {
  return async () => {
    const files = (await readdir(join(src, dir))).filter((f) => pattern.test(f)).sort();
    return files.map((f) => {
      const midi = noteToMidi(pattern.exec(f)[1]) + transpose;
      return { input: join(src, dir, f), output: `${prefix}/v0_${midi}.ogg`, layer: 0, midi, maxLen, fade: 0.5 };
    });
  };
}

/**
 * VCSL vibraphone, soft mallets, two velocity layers. Like the VSCO glock and marimba, the files
 * sound an octave above their names (checked by pitch detection), so they're transposed up 12.
 * Some notes only have a second round robin, so take whichever one exists.
 */
async function vibesJobs() {
  const dir = join(src, 'vcsl', 'Idiophones', 'Struck Idiophones', 'Vibraphone', 'Soft Mallets');
  const pattern = /^Vibes_soft_([A-G]#?\d)_v([12])_rr(\d)_Main\.wav$/;
  const seen = new Set();
  const jobs = [];
  for (const f of (await readdir(dir)).sort()) {
    const m = pattern.exec(f);
    if (!m) continue;
    const midi = noteToMidi(m[1]) + 12;
    const layer = Number(m[2]) - 1;
    if (seen.has(`${layer}_${midi}`)) continue;
    seen.add(`${layer}_${midi}`);
    jobs.push({ input: join(dir, f), output: `vibes/v${layer}_${midi}.ogg`, layer, midi, maxLen: 4, fade: 0.8 });
  }
  return jobs;
}

/**
 * VCSL kalimba (a Tanzanian mbira). It isn't tuned to equal temperament, so every tine was measured
 * (FFT peak near its named note, an octave up like the vibes) and gets its own correction. Where two
 * tines landed on the same note, the one needing less correction stays. Tines above B5 are left out:
 * their fundamentals are too weak to measure reliably.
 */
const KALIMBA = [
  // [file key, MIDI note it plays, measured cents off that note]
  ['G#1_k11', 44, 7], ['B1_k13', 46, 42], ['C#2_k10', 49, -2], ['D#2_k14', 51, 34], ['F2_k9alt', 53, 43],
  ['G2_k15', 56, -48], ['A#2_k8', 59, -38], ['C#3_k16', 61, -45], ['D#3_k7', 64, -45], ['F3_k17', 65, 40],
  ['G3_k6', 67, 17], ['A#3_k18', 71, -48], ['C#4_k5', 73, 10], ['D4_k19', 74, -49], ['D#4_k20', 75, 15],
  ['F4_k3', 77, 27], ['F4_k21', 78, -49], ['G4_k22', 79, 33], ['A#4_k2', 82, 37], ['B4_k23', 83, -43],
];

function kalimbaJobs() {
  const dir = join(src, 'vcsl', 'Idiophones', 'Plucked Idiophones', 'Kalimba, Tanzania');
  return KALIMBA.map(([key, midi, cents]) => ({
    input: join(dir, `MBira3_pluck_Main_${key}_50_100_rr2.wav`),
    output: `kalimba/v0_${midi}.ogg`,
    layer: 0,
    midi,
    tuneCents: -cents,
    maxLen: 2.5,
    fade: 0.6,
  }));
}

/** Guitar notes measured 10 cents or more off pitch in the recording. The rest are within a few cents. */
const GUITAR_CENTS = { 45: 22, 48: 21, 55: -10, 58: 12, 60: 11, 61: 17, 71: 13, 74: 10 };

const DRUMS = {
  kick: { dir: 'kick_24/kick/kick', prefix: 'k', layers: [6, 11], maxLen: 1.2 },
  snare: { dir: 'snare_14/center/top', prefix: 'sn_center', layers: [4, 8], maxLen: 1.0 },
  brush: { dir: 'snare_14/brush/top', prefix: 'sn_b', layers: [3, 6], maxLen: 1.2 },
  rim: { dir: 'snare_14/sidestick/top', prefix: 'sn_ss', layers: [2, 4], maxLen: 0.6 },
  hat: { dir: 'hihat_14/tc/cl', prefix: 'ht_tc', layers: [3, 6], maxLen: 0.6 },
  brushhat: { dir: 'hihat_14/cl_brush/cl', prefix: 'ht_cl_b', layers: [2, 4], maxLen: 0.8 },
  openhat: { dir: 'hihat_14/open/cl', prefix: 'ht_open', layers: [3, 5], maxLen: 1.6 },
  ride: { dir: 'ride_22/rd/cl', prefix: 'rd', layers: [4, 8], maxLen: 2.5 },
  tom: { dir: 'tom_15/center/cl', prefix: 't15', layers: [3, 6], maxLen: 1.5 },
};

function drumJobs() {
  const jobs = [];
  for (const [piece, d] of Object.entries(DRUMS)) {
    d.layers.forEach((vl, layer) => {
      for (const rr of [1, 2]) {
        jobs.push({
          input: join(src, 'big-rusty-drums', 'Samples', d.dir, `${d.prefix}_vl${vl}_rr${rr}.flac`),
          output: `drums/${piece}_v${layer}_r${rr}.ogg`,
          piece,
          layer,
          maxLen: d.maxLen,
          fade: Math.min(0.3, d.maxLen / 3),
        });
      }
    });
  }
  return jobs;
}

/**
 * Hand percussion from VCSL for the band's grooves. Each piece is its own encode group, so adding
 * them never changes the gain the drum kit was built with. Layers go soft to loud by measured peak:
 * the shaker's down strokes are quieter than its up strokes, and the cabasa rub is far softer than a hit.
 */
const PERC = {
  shaker: { dir: 'Idiophones/Struck Idiophones/Shaker, Small', layers: ['Mid_ShakerHighFaster_Down', 'Mid_ShakerHighFaster_Up'], name: (l, rr) => `${l}_rr${rr}.wav`, maxLen: 0.2 },
  cabasa: { dir: 'Idiophones/Struck Idiophones/Cabasa', layers: ['Cabasa1_Rub_v1', 'Cabasa1_Hit'], name: (l, rr) => `${l}_rr${rr}_Mid.wav`, maxLen: 0.35 },
};

function percJobs(piece) {
  const d = PERC[piece];
  return d.layers.flatMap((prefix, layer) =>
    [1, 2].map((rr) => ({
      input: join(src, 'vcsl', d.dir, d.name(prefix, rr)),
      output: `drums/${piece}_v${layer}_r${rr}.ogg`,
      piece,
      layer,
      maxLen: d.maxLen,
      fade: d.maxLen / 3,
    })),
  );
}

// ---------- rain ----------

/** A seamless loop: take the section plus `xfade` seconds, then crossfade that tail into the head. */
async function rainLoop(input, output, start, length, xfade) {
  const fc =
    `[0:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=${start}:${start + length + xfade},asetpts=N/SR/TB,asplit[a][b];` +
    `[a]atrim=0:${xfade},asetpts=N/SR/TB[head];[b]atrim=${xfade},asetpts=N/SR/TB[body];` +
    `[body][head]acrossfade=d=${xfade}:c1=qsin:c2=qsin,highpass=f=60`;
  // A static gain to -24 LUFS. loudnorm's dynamic mode would ride the level and could break the seam.
  const log = await ffmpeg(['-i', input, '-filter_complex', `${fc},ebur128`, '-f', 'null', '-']);
  const m = /Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/.exec(log);
  if (!m) throw new Error(`No loudness reading for ${input}`);
  const gain = -24 - Number(m[1]);
  const dest = join(out, 'ambience', output);
  await mkdir(dirname(dest), { recursive: true });
  await ffmpeg(['-y', '-v', 'error', '-i', input, '-filter_complex', `${fc},volume=${gain.toFixed(2)}dB`, '-c:a', 'libvorbis', '-q:a', '4', dest]);
  console.log(`${output.padEnd(16)} ${length}s loop  gain ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB`);
}

// ---------- main ----------

try {
  await stat(src);
} catch {
  console.error('assets/sources/ is missing. Run `pnpm samples:fetch` first.');
  process.exit(1);
}

await rm(out, { recursive: true, force: true });

const tonal = {
  piano: { jobs: pianoJobs(), release: 1.2, layers: [0.55, 1] },
  wurli: { jobs: await wurliJobs(), release: 0.6, layers: [0.6, 1] },
  glock: { jobs: await namedJobs('vsco2-ce/Percussion/Glock', /^glock_medium_([A-G]\d)\.wav$/, 'glock', 3.5, 12)(), release: 1.5, layers: [1] },
  marimba: { jobs: await namedJobs('vsco2-ce/Percussion/Marimba', /^Marimba_hit_Outrigger_([A-G]\d)_loud_01\.wav$/, 'marimba', 2.5, 12)(), release: 0.8, layers: [1] },
  harp: { jobs: await namedJobs('vsco2-ce/Strings/Harp', /^KSHarp_([A-G]\d)_\w+\.wav$/, 'harp', 4)(), release: 1.5, layers: [1] },
  vibes: { jobs: await vibesJobs(), release: 1.5, layers: [0.6, 1] },
  // FreePats file names match their pitch (checked by pitch detection), so no transpose.
  guitar: { jobs: (await namedJobs('freepats-guitar/SpanishClassicalGuitar-SFZ+FLAC-20190618/samples', /^([A-G]#?\d)\.flac$/, 'guitar', 3)()).map((j) => ({ ...j, tuneCents: -(GUITAR_CENTS[j.midi] ?? 0) })), release: 0.8, layers: [1] },
  kalimba: { jobs: kalimbaJobs(), release: 1.2, layers: [1] },
};

const manifest = { version: 1, instruments: {}, drums: { credit: credits.drums, percussionCredit: credits.perc, pieces: {} }, ambience: {} };

for (const [id, inst] of Object.entries(tonal)) {
  await encodeGroup(id, inst.jobs);
  manifest.instruments[id] = {
    credit: credits[id],
    release: inst.release,
    layers: inst.layers.map((maxVelocity, layer) => ({
      maxVelocity,
      zones: Object.fromEntries(inst.jobs.filter((j) => j.layer === layer).sort((a, b) => a.midi - b.midi).map((j) => [String(j.midi), j.output])),
    })),
  };
}

const drums = drumJobs();
await encodeGroup('drums', drums);
for (const piece of Object.keys(DRUMS)) {
  manifest.drums.pieces[piece] = [0, 1].map((layer) => ({
    maxVelocity: layer === 0 ? 0.6 : 1,
    files: drums.filter((j) => j.piece === piece && j.layer === layer).map((j) => j.output),
  }));
}

for (const piece of Object.keys(PERC)) {
  const jobs = percJobs(piece);
  await encodeGroup(piece, jobs);
  manifest.drums.pieces[piece] = [0, 1].map((layer) => ({
    maxVelocity: layer === 0 ? 0.6 : 1,
    files: jobs.filter((j) => j.layer === layer).map((j) => j.output),
  }));
}

const fs = join(src, 'freesound');
await rainLoop(join(fs, '235827__metadex__soft-rain-on-roof-window.wav'), 'rain_roof.ogg', 40, 60, 4);
await rainLoop(join(fs, '333510__mmorgaine__january-rain-on-a-window.aiff'), 'rain_window.ogg', 1, 40, 4);
manifest.ambience = {
  rain_roof: { file: 'ambience/rain_roof.ogg', credit: credits.rain_roof },
  rain_window: { file: 'ambience/rain_window.ogg', credit: credits.rain_window },
};

await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('wrote assets/samples/manifest.json');
