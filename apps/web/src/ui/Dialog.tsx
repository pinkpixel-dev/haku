// A modal built on the native <dialog>, which brings focus trapping, Escape to close, and the
// backdrop for free.

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './controls.tsx';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function Dialog({ open, title, onClose, children, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog--wide' : ''}`}
      aria-labelledby={titleId}
      onClose={onClose}
      // Clicking the backdrop (the dialog element itself, outside the inner box) closes it.
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dialog__box">
        <header className="dialog__head">
          <h2 id={titleId}>{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>
        <div className="dialog__body">{open && children}</div>
      </div>
    </dialog>
  );
}
