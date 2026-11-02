import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { clearRecovery, getRecovery, reconcileHandoffLocation, subscribeHandoff } from "../app/memoryHandoff";
import { Button } from "./ui/button";

export function HandoffRecoveryHost() {
  const recovery = useSyncExternalStore(subscribeHandoff, getRecovery);
  const location = useLocation();
  const { t } = useTranslation("common");
  useEffect(() => { reconcileHandoffLocation(); }, [location.pathname, location.search]);
  const download = () => {
    if (!recovery) return;
    // URLs belong to this click, never an effect cleanup (StrictMode-safe).
    for (const file of recovery.files) {
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name;
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
    // Let the browser dispatch downloads before the deferred document move.
    setTimeout(() => clearRecovery(), 0);
  };
  return recovery ? <section role="region" aria-label={t("handoff.recoveryTitle")} className="m-4 grid gap-3 rounded-2xl border border-border bg-card p-5" data-handoff-recovery>
    <p>{t("handoff.recoveryTitle")}</p>
    <p>{t("handoff.memoryOnly")}</p>
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={download}>{t("handoff.downloadResult")}</Button>
      <Button type="button" variant="outline" onClick={() => clearRecovery()}>{t("handoff.discard")}</Button>
    </div>
  </section> : null;
}
