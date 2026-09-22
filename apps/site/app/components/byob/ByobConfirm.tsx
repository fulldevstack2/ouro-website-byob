import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "@ouro/ds";

export type ByobConfirmProps = {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** In-app confirm dialog (never window.confirm). */
export function ByobConfirm({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ByobConfirmProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="byob-confirm"
      aria-labelledby={titleId}
      onClose={onCancel}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="byob-confirm__panel">
        <h2 id={titleId} className="byob-confirm__title">
          {title}
        </h2>
        <div className="byob-confirm__body">{body}</div>
        <div className="byob-confirm__actions">
          <Button size="sm" variant="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            variant={danger ? "secondary" : "primary"}
            disabled={busy}
            onClick={onConfirm}
            className={danger ? "byob-confirm__danger" : undefined}
          >
            {busy ? "Working..." : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
