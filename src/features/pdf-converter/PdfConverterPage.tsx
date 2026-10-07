import { FileImage, ImageDown } from "lucide-react";
import { Link } from "react-router-dom";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";
import { UtilityPage } from "../../components/UtilitySurface";
import { PageHeader } from "../../components/ui";
import { featureResource } from "../../i18n/featureMessages";
import { localizedPath } from "../../i18n/languages";
import { useAppLanguage } from "../../i18n/routing";
import { PdfImagePanel } from "../pdf-editor/PdfImagePanel";

export type PdfImageConversionMode = "image-to-pdf" | "pdf-to-image";
const navigation = [
  { mode: "image-to-pdf", icon: FileImage },
  { mode: "pdf-to-image", icon: ImageDown },
] as const;

export function PdfConverterPage({ mode }: { mode: PdfImageConversionMode }) {
  const language = useAppLanguage();
  const copy = featureResource<{
    modes: Record<PdfImageConversionMode, { title: string; description: string }>;
    navigation: Record<PdfImageConversionMode, string>;
  }>(language, "pdf.page");
  const title = language === "ko" ? "PDF 변환" : "PDF Converter";
  return <UtilityPage toolId="pdf-converter">
    <div className="pdf-tool-page" data-pdf-mode={mode}>
      <PageHeader eyebrow={title} title={copy.modes[mode].title} description={copy.modes[mode].description}>
        <PrivacyBanner compact />
      </PageHeader>
      <nav aria-label={title} className="pdf-tool-navigation mb-[17px] grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
        {navigation.map(({ mode: itemMode, icon: Icon }) => <Link
          key={itemMode}
          to={localizedPath(language, `/tools/pdf-converter/${itemMode}`)}
          data-active={mode === itemMode || undefined}
          aria-current={mode === itemMode ? "page" : undefined}
          className={`flex min-h-[43px] items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold outline-none transition-[color,background-color,box-shadow] focus-visible:ring-3 focus-visible:ring-primary/30 ${mode === itemMode ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:bg-card/60 hover:text-foreground"}`}
        ><Icon size={17} /><span>{copy.navigation[itemMode]}</span></Link>)}
      </nav>
      <PdfImagePanel direction={mode} />
      <ToolGuideWrapper slug="pdfConverter" />
    </div>
  </UtilityPage>;
}
