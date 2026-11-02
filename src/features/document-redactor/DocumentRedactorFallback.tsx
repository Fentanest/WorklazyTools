import { usePersistentHandoffReceiver } from "../../app/useHandoffReceiver";
import { useUnsavedWorkGuard } from "../../app/toolState";
import { PersistentHandoffNotice } from "../../components/PersistentHandoffNotice";
import { useAppLanguage } from "../../i18n/routing";
import { resources } from "../../i18n/resources";
import { UtilityPage, UtilityNotice } from "../../components/UtilitySurface";
import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";

export function DocumentRedactorFallback() {
  const language = useAppLanguage();
  const c = resources[language].features.documentRedactor as typeof resources.ko.features.documentRedactor;
  const handoff = usePersistentHandoffReceiver("document-redactor", { kind: "inspection", invalidate: () => {},
    receive: files => ({ status: "rejected", accepted: [], rejected: files.map(file => ({ file, reasonCode: "unavailable" })) }) });
  useUnsavedWorkGuard("redactor-handoff-fallback", handoff.recoveryFiles.length > 0, { kind: "files", scopePath: "/tools/document-redactor" });
  return (
    <UtilityPage toolId="document-redactor">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold">{c.title}</h1>
        <p className="mt-2 text-muted-foreground">{c.description}</p>
      </header>
      <PersistentHandoffNotice handoff={handoff} disabled onSelectAgain={() => {}} />
      <UtilityNotice kind="error" role="alert">
        {c.errors["not-ready"]}
      </UtilityNotice>
      <ToolGuideWrapper slug="documentRedactor">
        {c.fallbackNotice && (
          <UtilityNotice className="mb-4" kind="warning">
            {c.fallbackNotice}
          </UtilityNotice>
        )}
      </ToolGuideWrapper>
    </UtilityPage>
  );
}
