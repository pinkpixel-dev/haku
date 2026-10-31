// 16-bit PCM WAV encoding with TPDF dither. Used for exports in the browser and the CLI.

export interface PcmAudio {
  sampleRate: number;
  channels: Float32Array[];
}

export function encodeWav({ sampleRate, channels }: PcmAudio): Uint8Array {
  const numCh = channels.length;
  const frames = channels[0]?.length ?? 0;
  const dataBytes = frames * numCh * 2;
  const out = new Uint8Array(44 + dataBytes);
  const view = new DataView(out.buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i));
  };

  text(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numCh * 2, true);
  view.setUint16(32, numCh * 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, dataBytes, true);

  let at = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numCh; c++) {
      const dither = (Math.random() - Math.random()) / 32768;
      const s = Math.max(-1, Math.min(1, channels[c]![i]! + dither));
      view.setInt16(at, Math.round(s * 32767), true);
      at += 2;
    }
  }
  return out;
}
