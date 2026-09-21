import { TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { UnsavedWorkKind } from "../app/toolState";
import { Button } from "./ui/button";

interface UnsavedWorkDialogProps {
  open: boolean;
  kind: UnsavedWorkKind;
  onStay: () => void;
  onLeave: () => void;
}

// In-app confirmation shown *before* SPA navigation destroys tool state.
// Native <dialog> provides the modal top layer, initial focus handling, and
// the Escape-to-stay gesture; it never uses window.confirm().
export function UnsavedWorkDialog({ open, kind, onStay, onLeave }: UnsavedWorkDialogProps) {
  const { t } = useTranslation("common");
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const stayRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onStayRef = useRef(onStay);
  const onLeaveRef = useRef(onLeave);
  onStayRef.current = onStay;
  onLeaveRef.current = onLeave;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      stayRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open ]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      // Escape behaves exactly like "stay": nothing is lost.
      event.preventDefault();
      onStayRef.current();
    };
    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target === dialog) onStayRef.current();
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
      data-testid="unsaved-work-dialog"
      className="w-[min(440px,calc(100vw-2rem))] rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-xl backdrop:bg-black/50"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
          <TriangleAlert size={20} />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-bold tracking-tight">
            {t("recovery.unsavedWorkTitle")}
          </h2>
          <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {t(kind === "files" ? "recovery.unsavedWorkDescriptionFiles" : "recovery.unsavedWorkDescriptionEdits")}
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button ref={stayRef} type="button" variant="default" className="rounded-xl font-bold" data-testid="unsaved-stay" onClick={() => onStayRef.current()}>
          {t("recovery.unsavedStay")}
        </Button>
        <Button type="button" variant="destructive" className="rounded-xl font-bold" data-testid="unsaved-leave" onClick={() => onLeaveRef.current()}>
          {t("recovery.unsavedLeave")}
        </Button>
      </div>
    </dialog>
  );
}
