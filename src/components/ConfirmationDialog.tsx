import { TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Button } from "./ui/button";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  testId?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

// In-app confirmation shown *before* SPA navigation destroys tool state.
// Native <dialog> provides the modal top layer, initial focus handling, and
// the Escape-to-stay gesture; it never uses window.confirm().
export function ConfirmationDialog({ open, title, message, cancelLabel, confirmLabel, testId = "confirmation-dialog", onCancel, onConfirm }: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const close = () => {
    if (!dialogRef.current?.open) return;
    dialogRef.current.close();
    if (previousFocus.current?.isConnected) previousFocus.current.focus();
  };
  const stayRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onStayRef = useRef(onCancel);
  const onLeaveRef = useRef(onConfirm);
  onStayRef.current = onCancel;
  onLeaveRef.current = onConfirm;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      stayRef.current?.focus();
    } else if (!open && dialog.open) {
      close();
    }
  }, [open ]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      // Escape behaves exactly like "stay": nothing is lost.
      event.preventDefault();
      close();
      onStayRef.current();
    };
    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target === dialog) { close(); onStayRef.current(); }
    };
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("click", handleBackdropClick);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("click", handleBackdropClick);
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-testid={testId}
      className="w-[min(440px,calc(100vw-2rem))] rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-xl backdrop:bg-black/50"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
          <TriangleAlert size={20} />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-bold tracking-tight">
            {title}
          </h2>
          <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {message}
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button ref={stayRef} type="button" variant="default" className="rounded-xl font-bold" data-testid={testId === "unsaved-work-dialog" ? "unsaved-stay" : "confirmation-cancel"} onClick={() => { close(); onStayRef.current(); }}>
          {cancelLabel}
        </Button>
        <Button type="button" variant="destructive" className="rounded-xl font-bold" data-testid={testId === "unsaved-work-dialog" ? "unsaved-leave" : "confirmation-accept"} onClick={() => { close(); onLeaveRef.current(); }}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
