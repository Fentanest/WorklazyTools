import { useTranslation } from "react-i18next";
import type { UnsavedWorkKind } from "../app/toolState";
import { ConfirmationDialog } from "./ConfirmationDialog";

interface UnsavedWorkDialogProps {
  open: boolean;
  kind: UnsavedWorkKind;
  /** W1: registration-provided description; falls back to the kind message. */
  message?: string;
  onStay: () => void;
  onLeave: () => void;
}

export function UnsavedWorkDialog({ open, kind, message, onStay, onLeave }: UnsavedWorkDialogProps) {
  const { t } = useTranslation("common");
  return <ConfirmationDialog open={open} title={t("recovery.unsavedWorkTitle")}
    message={message ?? t(kind === "files" ? "recovery.unsavedWorkDescriptionFiles" : "recovery.unsavedWorkDescriptionEdits")}
    cancelLabel={t("recovery.unsavedStay")} confirmLabel={t("recovery.unsavedLeave")}
    testId="unsaved-work-dialog" onCancel={onStay} onConfirm={onLeave} />;
}
