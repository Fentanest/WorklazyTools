import { FileImage, FileOutput, ImageDown, Layers3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { UtilityPage } from "../../components/UtilitySurface";
import { PageHeader } from "../../components/ui";
import { featureMessage, featureResource } from "../../i18n/featureMessages";
import { localizedPath } from "../../i18n/languages";
import { useAppLanguage } from "../../i18n/routing";
import { PdfConvertPanel } from "./PdfConvertPanel";
import { PdfImagePanel } from "./PdfImagePanel";
import { PdfOrganizePanel } from "./PdfOrganizePanel";
import type { PdfToolMode } from "./types";

interface PdfGuideCopy {
  title: string;
  description: string;
  blocks: Array<{ title: string; paragraphs: string[] }>;
  faq: Array<{ question: string; answer: string }>;
}

interface PdfPageCopy {
  modes: Record<PdfToolMode, { eyebrow: string; title: string; description: string }>;
  navigation: Record<PdfToolMode, string>;
  guides: { standard: PdfGuideCopy; convert: PdfGuideCopy };
}

const navigation = [
  { mode: "organize", to: "/tools/pdf-editor", icon: Layers3 },
  { mode: "image-to-pdf", to: "/tools/pdf-editor/image-to-pdf", icon: FileImage },
  { mode: "pdf-to-image", to: "/tools/pdf-editor/pdf-to-image", icon: ImageDown },
  { mode: "convert", to: "/tools/pdf-editor/convert", icon: FileOutput },
] as const;

export function PdfEditorPage({ mode }: { mode: PdfToolMode }) {
  const language = useAppLanguage();
  const page = featureResource<PdfPageCopy>(language, "pdf.page");
  const definition = page.modes[mode];
  return (
    <UtilityPage toolId="pdf-editor" className={`max-w-[1180px]${mode === "organize" ? " max-[820px]:pb-[calc(170px+env(safe-area-inset-bottom))]" : ""}`}>
      <div className="pdf-tool-page" data-pdf-mode={mode}>
        <PageHeader eyebrow={definition.eyebrow} title={definition.title} description={definition.description}>
          <PrivacyBanner compact />
        </PageHeader>

        <PdfModeNavigation mode={mode} labels={page.navigation} ariaLabel={featureMessage(language, "pdf.messages.PdfEditorPage.pdfTools")} language={language} />

        {mode === "organize" && <PdfOrganizePanel />}
        {(mode === "image-to-pdf" || mode === "pdf-to-image") && <PdfImagePanel direction={mode} />}
        {mode === "convert" && <PdfConvertPanel />}

        <PdfGuide mode={mode} />
      </div>
    </UtilityPage>
  );
}

function PdfModeNavigation({ mode, labels, ariaLabel, language }: {
  mode: PdfToolMode;
  labels: PdfPageCopy["navigation"];
  ariaLabel: string;
  language: ReturnType<typeof useAppLanguage>;
}) {
  const navigationRef = useRef<HTMLElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    const element = navigationRef.current;
    if (!element) return;
    const update = () => {
      const remaining = element.scrollWidth - element.clientWidth - element.scrollLeft;
      setOverflow({ left: element.scrollLeft > 2, right: remaining > 2 });
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className="relative mb-[17px]"
      data-testid="pdf-navigation-shell"
      data-scroll-cue={overflow.right ? "right" : overflow.left ? "left" : "none"}
    >
      <nav
        ref={navigationRef}
        className="pdf-tool-navigation grid grid-cols-[repeat(4,minmax(120px,1fr))] gap-1 overflow-x-auto rounded-2xl bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[821px]:grid-cols-4"
        aria-label={ariaLabel}
      >
        {navigation.map((item) => {
          const Icon = item.icon;
          const selected = mode === item.mode;
          return (
            <NavLink
              key={item.mode}
              to={localizedPath(language, item.to)}
              end={item.mode === "organize"}
              data-active={selected || undefined}
              className={`flex min-h-[43px] items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-bold outline-none transition-[color,background-color,box-shadow] focus-visible:ring-3 focus-visible:ring-violet-700/30 ${selected ? "bg-card text-violet-700 shadow-sm dark:text-violet-300" : "text-muted-foreground hover:bg-card/60 hover:text-foreground"}`}
            >
              <Icon size={17} /><span>{labels[item.mode]}</span>
            </NavLink>
          );
        })}
      </nav>
      {overflow.left && <span aria-hidden="true" data-scroll-cue-side="left" className="pointer-events-none absolute inset-y-1 left-0 z-10 w-10 rounded-l-2xl bg-gradient-to-r from-background via-background/90 to-transparent min-[821px]:hidden" />}
      {overflow.right && <span aria-hidden="true" data-scroll-cue-side="right" className="pointer-events-none absolute inset-y-1 right-0 z-10 w-12 rounded-r-2xl bg-gradient-to-l from-background via-background/90 to-transparent min-[821px]:hidden" />}
    </div>
  );
}

function PdfGuide({ mode }: { mode: PdfToolMode }) {
  const language = useAppLanguage();
  const page = featureResource<PdfPageCopy>(language, "pdf.page");
  const guide = page.guides[mode === "convert" ? "convert" : "standard"];
  return <ToolGuide title={guide.title} description={guide.description} blocks={guide.blocks} faq={guide.faq} />;
}
