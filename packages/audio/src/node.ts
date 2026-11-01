// Node setup for offline rendering. Import this BEFORE '@haku/audio' (which imports Tone), call
// setupNodeAudio(), then dynamically import '@haku/audio'. See DOCS/ERRORS.md for why.

import * as nwa from 'node-web-audio-api';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SampleManifest } from '@haku/core';

/** Puts the Web Audio classes Tone needs on globalThis. Leaves out AudioContext on purpose. */
export function setupNodeAudio() {
  const g = globalThis as Record<string, unknown>;
  for (const [k, v] of Object.entries(nwa)) {
    // A realtime AudioContext would open the sound card and keep Node running forever.
    if (k !== 'AudioContext' && !(k in g)) g[k] = v;
  }
  g.window ??= globalThis;
  // Tone prints a version banner to stdout on load, which would corrupt an MCP server's stdio stream.
  g.TONE_SILENCE_LOGGING = true;
}

export async function readManifest(dir: string): Promise<SampleManifest> {
  return JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as SampleManifest;
}

/** Decodes sample files from a directory. Node's fetch can't read file:// URLs, so this reads them directly. */
export function nodeDecoder(dir: string) {
  const ctx = new nwa.OfflineAudioContext(2, 1, 44100);
  return async (path: string): Promise<AudioBuffer> => {
    const bytes = await readFile(join(dir, path));
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return (await ctx.decodeAudioData(ab)) as unknown as AudioBuffer;
  };
}
