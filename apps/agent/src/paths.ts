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

/** The built web app. A published build carries it in dist/web; in the repo it's apps/web/dist (run `pnpm --filter @haku/web build`). */
export function webDir(): string {
  if (process.env.HAKU_WEB_DIR) return resolve(process.env.HAKU_WEB_DIR);
  const candidates = [new URL('./web', import.meta.url), new URL('../../web/dist', import.meta.url)].map((u) => fileURLToPath(u));
  const found = candidates.find((dir) => existsSync(join(dir, 'index.html')));
  if (!found) throw new Error("Can't find the built Haku app. In the repo, run `pnpm --filter @haku/web build` first.");
  return found;
}
