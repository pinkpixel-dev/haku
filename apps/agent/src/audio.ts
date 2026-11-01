// Offline audio for the CLI and MCP server. Tone has to see the Node Web Audio globals before it
// loads, so @haku/audio is only ever imported dynamically, after setupNodeAudio(). The sample bank
// loads once per process.

import type { PcmAudio, RenderOptions } from '@haku/audio';
import type { Project } from '@haku/core';
import type { Levels } from './analyze.ts';
import { samplesDir } from './paths.ts';

export interface AudioKit {
  render(project: Project, opts: RenderOptions): Promise<PcmAudio>;
  wav(audio: PcmAudio): Uint8Array;
  levels(audio: PcmAudio): Levels;
}

let kit: Promise<AudioKit> | null = null;

export function loadAudio(): Promise<AudioKit> {
  kit ??= (async () => {
    const node = await import('@haku/audio/node');
    node.setupNodeAudio();
    const audio = await import('@haku/audio');
    const dir = samplesDir();
    const bank = await audio.loadSampleBank(await node.readManifest(dir), node.nodeDecoder(dir));
    return {
      render: (project, opts) => audio.renderProject(project, bank, opts),
      wav: (pcm) => audio.encodeWav(pcm),
      levels: (pcm) => ({
        seconds: (pcm.channels[0]?.length ?? 0) / pcm.sampleRate,
        ...audio.measure(pcm),
        lufs: audio.integratedLoudness(pcm),
      }),
    };
  })();
  kit.catch(() => (kit = null));
  return kit;
}
