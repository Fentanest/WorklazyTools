import { useTranslation } from "react-i18next";
import { UtilityNotice } from "./UtilitySurface";
import { Button } from "./ui/button";
import type { usePersistentHandoffReceiver } from "../app/useHandoffReceiver";

export function PersistentHandoffNotice({ handoff, onSelectAgain, disabled = false }: {
  handoff: ReturnType<typeof usePersistentHandoffReceiver>; onSelectAgain: () => void; disabled?: boolean;
}) {
  const { t } = useTranslation("common");
  if (!handoff.notReceived && !(handoff.result && handoff.recoveryFiles.length)) return null;
  return <UtilityNotice kind="warning" role="status" className="mb-4 flex-col items-start gap-2" data-handoff-recovery>
    <p>{t(handoff.recoveryFiles.length ? "handoff.partial" : "handoff.notReceived", { count: handoff.recoveryFiles.length })}</p>
    <ul className="max-w-full break-all">{handoff.recoveryFiles.map((file, index) => <li key={index}>{file.name}</li>)}</ul>
    <div className="flex flex-wrap gap-2">
      {!!handoff.recoveryFiles.length && <Button type="button" variant="outline" onClick={() => {
        for (const file of handoff.recoveryFiles) {
          const url = URL.createObjectURL(file), link = document.createElement("a");
          link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
        }
        setTimeout(handoff.dismiss, 0);
      }}>{t("handoff.downloadReceived")}</Button>}
      <Button type="button" variant="outline" disabled={disabled} onClick={onSelectAgain}>{t("handoff.selectAgain")}</Button>
      <Button type="button" variant="ghost" onClick={handoff.dismiss}>{t("handoff.close")}</Button>
    </div>
  </UtilityNotice>;
}
