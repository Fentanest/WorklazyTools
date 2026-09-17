import { useAppLanguage } from "../../i18n/routing";
import { resources } from "../../i18n/resources";
import { UtilityPage, UtilityNotice } from "../../components/UtilitySurface";
import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";

export function DocumentRedactorFallback() {
  const language = useAppLanguage();
  const c = resources[language].features.documentRedactor as typeof resources.ko.features.documentRedactor;
  return (
    <UtilityPage toolId="document-redactor">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold">{c.title}</h1>
        <p className="mt-2 text-muted-foreground">{c.description}</p>
      </header>
      <UtilityNotice kind="error" role="alert">
        {c.errors["not-ready"]}
      </UtilityNotice>
      {c.guide && (
        <ToolGuideWrapper slug="documentRedactor">
          {c.guide.fallbackNotice && (
            <UtilityNotice className="mb-4" kind="warning">
              {c.guide.fallbackNotice}
            </UtilityNotice>
          )}
        </ToolGuideWrapper>
      )}
    </UtilityPage>
  );
}
