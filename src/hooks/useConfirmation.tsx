import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmationDialog } from "../components/ConfirmationDialog";

/** One pending decision per owner; duplicate requests decline without replacing it. */
export function useConfirmation() {
  const { t } = useTranslation("common");
  const pending = useRef<((accepted: boolean) => void) | undefined>(undefined);
  const [request, setRequest] = useState<{ message: string; confirmLabel: string }>();
  const confirm = useCallback((message: string, confirmLabel: string) => {
    if (pending.current) return Promise.resolve(false);
    return new Promise<boolean>(resolve => {
      pending.current = resolve;
      setRequest({ message, confirmLabel });
    });
  }, []);
  const settle = (accepted: boolean) => {
    const resolve = pending.current;
    pending.current = undefined;
    setRequest(undefined);
    resolve?.(accepted);
  };
  useEffect(() => () => { pending.current?.(false); pending.current = undefined; }, []);
  const confirmation = <ConfirmationDialog open={!!request} title={t("recovery.unsavedWorkTitle")}
    message={request?.message ?? ""} cancelLabel={t("actions.cancel")} confirmLabel={request?.confirmLabel ?? ""}
    onCancel={() => settle(false)} onConfirm={() => settle(true)} />;
  return { confirm, confirmation };
}
