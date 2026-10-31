import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DRUM_PIECE_IDS, pickLayer, type SampleManifest } from '../src/index.ts';

const dir = join(import.meta.dirname, '..', '..', '..', 'assets', 'samples');
const manifestPath = join(dir, 'manifest.json');

describe.skipIf(!existsSync(manifestPath))('sample manifest', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as SampleManifest;

  it('only points at files that exist', () => {
    const files = [
      ...Object.values(manifest.instruments).flatMap((i) => i!.layers.flatMap((l) => Object.values(l.zones))),
      ...Object.values(manifest.drums.pieces).flatMap((layers) => layers!.flatMap((l) => l.files)),
      ...Object.values(manifest.ambience).map((a) => a.file),
    ];
    expect(files.length).toBeGreaterThan(100);
    for (const f of files) expect(existsSync(join(dir, f)), f).toBe(true);
  });

  it('has a sample for every drum the engine can play', () => {
    for (const piece of DRUM_PIECE_IDS) expect(manifest.drums.pieces[piece]?.length, piece).toBeGreaterThan(0);
  });

  it('credits every source, and flags the one that needs attribution', () => {
    const credits = [...Object.values(manifest.instruments).map((i) => i!.credit), manifest.drums.credit, ...Object.values(manifest.ambience).map((a) => a.credit)];
    for (const c of credits) expect(c.license).toMatch(/^CC/);
    expect(manifest.instruments.wurli!.credit.license).toBe('CC-BY-3.0');
  });

  it('picks velocity layers by threshold', () => {
    const piano = manifest.instruments.piano!.layers;
    expect(pickLayer(piano, 0.3)).toBe(piano[0]);
    expect(pickLayer(piano, 0.9)).toBe(piano[1]);
  });
});
