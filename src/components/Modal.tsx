// Pop-up window using the browser's built-in <dialog> (handles Esc + focus)

import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  labelledBy: string; // id of the title inside
  children: ReactNode;
}

export function Modal({ open, onClose, labelledBy, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={labelledBy}
      onClose={onClose}
      // Click on the dark background closes it
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="modal-body">{children}</div>
    </dialog>
  );
}

// Title row with a close button
export function ModalHeader({ id, title, onClose, closeLabel }: {
  id: string;
  title: string;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <div className="modal-head">
      <h2 id={id}>{title}</h2>
      <button type="button" className="icon-btn" aria-label={closeLabel} onClick={onClose}>
        ✕
      </button>
    </div>
  );
}
