// Loads every file in the sample manifest into Tone buffers. How a file is fetched and decoded is
// passed in, so the same bank works with fetch in the browser and the file system in Node.

import * as Tone from 'tone';
import type { SampleManifest } from '@haku/core';

export interface SampleBank {
  manifest: SampleManifest;
  buffers: Map<string, Tone.ToneAudioBuffer>;
}

/** Fetches and decodes one file, given its path relative to the manifest. */
export type DecodeFile = (path: string) => Promise<AudioBuffer>;

export function manifestFiles(manifest: SampleManifest): string[] {
  const files = new Set<string>();
  for (const inst of Object.values(manifest.instruments)) {
    for (const layer of inst?.layers ?? []) for (const f of Object.values(layer.zones)) files.add(f);
  }
  for (const layers of Object.values(manifest.drums.pieces)) {
    for (const layer of layers ?? []) for (const f of layer.files) files.add(f);
  }
  for (const a of Object.values(manifest.ambience)) files.add(a.file);
  return [...files];
}

export async function loadSampleBank(
  manifest: SampleManifest,
  decode: DecodeFile,
  onProgress?: (loaded: number, total: number) => void,
): Promise<SampleBank> {
  const files = manifestFiles(manifest);
  const buffers = new Map<string, Tone.ToneAudioBuffer>();
  let loaded = 0;
  await Promise.all(
    files.map(async (file) => {
      const audio = await decode(file);
      buffers.set(file, new Tone.ToneAudioBuffer(audio));
      onProgress?.(++loaded, files.length);
    }),
  );
  return { manifest, buffers };
}

/** Decoder for the browser: fetches files relative to baseUrl and decodes them on Tone's context. */
export function browserDecoder(baseUrl: string): DecodeFile {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return async (path) => {
    const res = await fetch(base + path);
    if (!res.ok) throw new Error(`Couldn't load ${path} (${res.status})`);
    return Tone.getContext().decodeAudioData(await res.arrayBuffer());
  };
}

export function bankBuffer(bank: SampleBank, file: string): Tone.ToneAudioBuffer {
  const buf = bank.buffers.get(file);
  if (!buf) throw new Error(`Sample ${file} isn't loaded`);
  return buf;
}
