import { FileImage, FileOutput, ImageDown, Layers3 } from "lucide-react";
import { NavLink } from "react-router-dom";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
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
    <div className="page tool-page page-enter pdf-tool-page" data-pdf-mode={mode}>
      <PageHeader eyebrow={definition.eyebrow} title={definition.title} description={definition.description}>
        <PrivacyBanner compact />
      </PageHeader>

      <nav className="pdf-tool-navigation" aria-label={featureMessage(language, "pdf.messages.PdfEditorPage.pdfTools")}>
        {navigation.map((item) => {
          const Icon = item.icon;
          return <NavLink key={item.mode} to={localizedPath(language, item.to)} end={item.mode === "organize"} className={mode === item.mode ? "active" : ""}><Icon size={17} /><span>{page.navigation[item.mode]}</span></NavLink>;
        })}
      </nav>

      {mode === "organize" && <PdfOrganizePanel />}
      {(mode === "image-to-pdf" || mode === "pdf-to-image") && <PdfImagePanel direction={mode} />}
      {mode === "convert" && <PdfConvertPanel />}

      <PdfGuide mode={mode} />
    </div>
  );
}

function PdfGuide({ mode }: { mode: PdfToolMode }) {
  const language = useAppLanguage();
  const page = featureResource<PdfPageCopy>(language, "pdf.page");
  const guide = page.guides[mode === "convert" ? "convert" : "standard"];
  return <ToolGuide title={guide.title} description={guide.description} blocks={guide.blocks} faq={guide.faq} />;
}
