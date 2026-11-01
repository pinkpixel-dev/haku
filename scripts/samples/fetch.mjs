#!/usr/bin/env node
// Downloads the raw sample sources Haku is built from into assets/sources/.
// Only the folders we actually use are fetched, not whole repositories.
// Files that already exist with the right size are skipped, so re-running is cheap.

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'assets', 'sources');

const sources = [
  {
    id: 'vsco2-ce',
    repo: 'sgossner/VSCO-2-CE',
    branch: 'master',
    license: 'CC0-1.0',
    include: ['Keys/Upright Piano/', 'Percussion/Glock/', 'Percussion/Marimba/', 'Strings/Harp/'],
  },
  {
    id: 'big-rusty-drums',
    repo: 'sfzinstruments/karoryfer.big-rusty-drums',
    branch: 'main',
    license: 'CC0-1.0',
    include: [
      'LICENSE',
      'Samples/kick_24/kick/kick/',
      'Samples/snare_14/center/top/',
      'Samples/snare_14/brush/top/',
      'Samples/snare_14/sidestick/top/',
      'Samples/hihat_14/tc/cl/',
      'Samples/hihat_14/cl_brush/cl/',
      'Samples/hihat_14/open/cl/',
      'Samples/ride_22/rd/cl/',
      'Samples/tom_15/center/cl/',
    ],
  },
  {
    id: 'vcsl',
    repo: 'sgossner/VCSL',
    branch: 'master',
    license: 'CC0-1.0',
    // Short shaker strokes (up for soft, down for accents) and the cabasa, for the band's grooves.
    include: [
      'LICENSE',
      'Idiophones/Struck Idiophones/Shaker, Small/Mid_ShakerHighFaster_',
      'Idiophones/Struck Idiophones/Cabasa/Cabasa1_Hit_',
      'Idiophones/Struck Idiophones/Cabasa/Cabasa1_Rub_v1_',
    ],
  },
  {
    id: 'wurlitzer-ep200',
    repo: 'sfzinstruments/GregSullivan.E-Pianos',
    branch: 'master',
    license: 'CC-BY-3.0',
    include: ['LICENSE', 'README.md', 'Wurlitzer EP200/'],
  },
];

async function listTree({ repo, branch }) {
  const res = await fetch(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'haku-sample-fetch' },
  });
  if (!res.ok) throw new Error(`${repo}: tree request failed (${res.status})`);
  const { tree, truncated } = await res.json();
  if (truncated) console.warn(`${repo}: tree listing was truncated, some files may be missing`);
  return tree.filter((entry) => entry.type === 'blob');
}

async function exists(path, size) {
  try {
    return (await stat(path)).size === size;
  } catch {
    return false;
  }
}

async function download(source, entry) {
  const dest = join(outDir, source.id, entry.path);
  if (await exists(dest, entry.size)) return { skipped: true, bytes: entry.size };
  const url = `https://raw.githubusercontent.com/${source.repo}/${source.branch}/${entry.path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length !== entry.size) throw new Error(`${entry.path}: expected ${entry.size} bytes, got ${data.length}`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, data);
  return { skipped: false, bytes: data.length };
}

async function pool(items, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: limit }, async () => {
    while (next < items.length) await worker(items[next++]);
  });
  await Promise.all(runners);
}

for (const source of sources) {
  const tree = await listTree(source);
  const files = tree.filter((entry) => source.include.some((p) => entry.path === p || entry.path.startsWith(p)));
  let fetched = 0;
  let skipped = 0;
  let bytes = 0;
  await pool(files, 8, async (entry) => {
    const result = await download(source, entry);
    result.skipped ? skipped++ : fetched++;
    bytes += result.bytes;
  });
  console.log(
    `${source.id.padEnd(16)} ${String(files.length).padStart(4)} files  ${(bytes / 1e6).toFixed(1).padStart(6)} MB  ` +
      `(${fetched} downloaded, ${skipped} cached)  ${source.license}`,
  );
}
