import { useState } from 'react';
import { AudioLines, Loader2, Music } from 'lucide-react';
import { findScene, type Project } from '@haku/core';
import { exportMidi, exportWav, type ExportScope } from '../export.ts';
import { Dialog } from './Dialog.tsx';

interface Props {
  open: boolean;
  onClose: () => void;
  project: Project;
  notify: (message: string, isError?: boolean) => void;
}

export function ExportDialog({ open, onClose, project, notify }: Props) {
  const [scope, setScope] = useState<ExportScope>('scene');
  const [busy, setBusy] = useState(false);
  const scene = findScene(project);
  const songLength = project.arrangement.reduce((n, a) => n + (project.scenes.find((s) => s.id === a.sceneId)?.bars ?? 0) * a.repeat, 0);

  const wav = async () => {
    setBusy(true);
    try {
      notify(`Saved ${await exportWav(project, scope)}.`);
      onClose();
    } catch (err) {
      notify(`WAV export failed: ${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} title="Export" onClose={() => !busy && onClose()}>
      <fieldset className="choice" disabled={busy}>
        <legend className="field__label">What to export</legend>
        <label className="choice__option">
          <input type="radio" name="scope" checked={scope === 'scene'} onChange={() => setScope('scene')} />
          <span>
            Scene {scene.name}
            <small>
              {scene.bars} bars, played twice for WAV
            </small>
          </span>
        </label>
        <label className="choice__option">
          <input type="radio" name="scope" checked={scope === 'song'} onChange={() => setScope('song')} />
          <span>
            Whole song
            <small>{songLength} bars in arrangement order</small>
          </span>
        </label>
      </fieldset>

      <div className="dialog__actions">
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void wav()}>
          {busy ? <Loader2 size={15} className="spin" /> : <AudioLines size={15} />} {busy ? 'Rendering…' : 'WAV audio'}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => {
            notify(`Saved ${exportMidi(project, scope)}.`);
            onClose();
          }}
        >
          <Music size={15} /> MIDI
        </button>
      </div>
    </Dialog>
  );
}
