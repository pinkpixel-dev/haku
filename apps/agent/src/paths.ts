// Finding bundled files: the sample set and the snapshot fonts. A published build carries a copy next to the bundle (dist/samples); in the
// repo the source files use assets/samples directly. HAKU_SAMPLES overrides both.

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function samplesDir(): string {
  if (process.env.HAKU_SAMPLES) return resolve(process.env.HAKU_SAMPLES);
  const candidates = [new URL('./samples', import.meta.url), new URL('../../../assets/samples', import.meta.url)].map((u) => fileURLToPath(u));
  const found = candidates.find((dir) => existsSync(join(dir, 'manifest.json')));
  if (!found) throw new Error("Can't find Haku's samples. Set HAKU_SAMPLES to the folder that holds manifest.json.");
  return found;
}

/** Figtree for snapshots. Loading every system font instead takes seconds on a well-stocked machine. */
export function fontFiles(): string[] {
  const dirs = [new URL('./fonts', import.meta.url), new URL('../assets/fonts', import.meta.url)].map((u) => fileURLToPath(u));
  const dir = dirs.find((d) => existsSync(join(d, 'Figtree-Regular.ttf')));
  return dir ? ['Figtree-Regular.ttf', 'Figtree-SemiBold.ttf'].map((f) => join(dir, f)) : [];
}
