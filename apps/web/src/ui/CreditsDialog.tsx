// Credits for every sound Haku ships (read from the sample manifest) and the libraries it's built on.

import type { Credit, SampleManifest } from '@haku/core';
import { Dialog } from './Dialog.tsx';

interface Props {
  open: boolean;
  onClose: () => void;
  manifest: SampleManifest | null;
}

const LIBRARIES = [
  { name: 'Tone.js', license: 'MIT', url: 'https://github.com/Tonejs/Tone.js' },
  { name: '@tonejs/midi', license: 'MIT', url: 'https://github.com/Tonejs/Midi' },
  { name: 'React', license: 'MIT', url: 'https://react.dev' },
  { name: 'Zod', license: 'MIT', url: 'https://zod.dev' },
  { name: 'Lucide icons', license: 'ISC', url: 'https://lucide.dev' },
  { name: 'Figtree', license: 'OFL-1.1', url: 'https://fontsource.org/fonts/figtree' },
  { name: 'Fraunces', license: 'OFL-1.1', url: 'https://fontsource.org/fonts/fraunces' },
];

function soundCredits(manifest: SampleManifest): Credit[] {
  const all = [
    ...Object.values(manifest.instruments).map((i) => i!.credit),
    manifest.drums.credit,
    ...Object.values(manifest.ambience).map((a) => a.credit),
  ];
  // Several instruments share a source (VSCO), so dedupe by name.
  return [...new Map(all.map((c) => [c.name, c])).values()];
}

export function CreditsDialog({ open, onClose, manifest }: Props) {
  return (
    <Dialog open={open} title="Credits" onClose={onClose} wide>
      <h3 className="dialog__section">Sounds</h3>
      {manifest ? (
        <ul className="credit-list">
          {soundCredits(manifest).map((c) => (
            <li key={c.name}>
              <a href={c.url} target="_blank" rel="noreferrer">
                {c.name}
              </a>
              <span>{c.author}</span>
              <span className="credit-list__license">{c.license}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dialog__note">Sounds are still loading.</p>
      )}

      <h3 className="dialog__section">Built with</h3>
      <ul className="credit-list">
        {LIBRARIES.map((l) => (
          <li key={l.name}>
            <a href={l.url} target="_blank" rel="noreferrer">
              {l.name}
            </a>
            <span className="credit-list__license">{l.license}</span>
          </li>
        ))}
      </ul>

      <p className="dialog__note">
        Haku is Apache 2.0. Made with 💖 by{' '}
        <a href="https://pinkpixel.dev" target="_blank" rel="noreferrer">
          Pink Pixel
        </a>
        .
      </p>
    </Dialog>
  );
}
