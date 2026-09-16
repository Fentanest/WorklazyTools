import { useAppLanguage } from "../../i18n/routing";
import { resources } from "../../i18n/resources";
import { UtilityPage, UtilityNotice } from "../../components/UtilitySurface";
import { ToolGuide, type GuideBlock } from "../../components/ToolGuide";

export function DocumentRedactorFallback() {
  const language = useAppLanguage();
  const c = resources[language].features.documentRedactor as typeof resources.ko.features.documentRedactor;
  return (
    <UtilityPage toolId="document-redactor">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold">{c.title}</h1>
        <p className="mt-2 text-muted-foreground">{c.description}</p>
      </header>
      <UtilityNotice tone="error" role="alert">
        {c.errors["not-ready"]}
      </UtilityNotice>
      {c.guide && (
        <ToolGuide
          title={c.guide.title}
          description={c.guide.description}
          blocks={c.guide.blocks as GuideBlock[]}
          faq={(c.guide.faq || []).map((item: {q: string, a: string}) => ({ question: item.q, answer: item.a }))}
        >
          {c.guide.fallbackNotice && (
            <UtilityNotice className="mb-4" tone="warning">
              {c.guide.fallbackNotice}
            </UtilityNotice>
          )}
        </ToolGuide>
      )}
    </UtilityPage>
  );
}
