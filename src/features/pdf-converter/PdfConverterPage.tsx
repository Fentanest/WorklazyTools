import { FileImage, ImageDown, FileOutput, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";
import { UtilityPage } from "../../components/UtilitySurface";
import { PageHeader } from "../../components/ui";
import { featureResource } from "../../i18n/featureMessages";
import { localizedPath } from "../../i18n/languages";
import { useAppLanguage } from "../../i18n/routing";
import { DocumentPdfPanel } from "./DocumentPdfPanel";
import type { PdfConvertPreset } from "../pdf-editor/pdfConvertDirect";
import { PdfConvertPanel } from "../pdf-editor/PdfConvertPanel";
import { UtilityNotice } from "../../components/UtilitySurface";
import { PdfImagePanel } from "../pdf-editor/PdfImagePanel";

export type PdfImageConversionMode = "image-to-pdf" | "pdf-to-image";
type PdfConversionMode = PdfImageConversionMode | "document-to-pdf" | "pdf-to-document";
const navigation = [
  { mode: "image-to-pdf", icon: FileImage },
  { mode: "pdf-to-image", icon: ImageDown },
  { mode: "document-to-pdf", icon: FileOutput },
  { mode: "pdf-to-document", icon: FileText },
] as const;

export function PdfConverterPage({ mode, convertPreset }: { mode: PdfConversionMode; convertPreset?: PdfConvertPreset }) {
  const language = useAppLanguage();
  const copy = featureResource<{
    modes: Record<PdfImageConversionMode, { title: string; description: string }>;
    navigation: Record<PdfImageConversionMode, string>;
  }>(language, "pdf.page");
  const labels = {
    ...copy.navigation,
    "document-to-pdf": language === "ko" ? "문서 → PDF" : "Document → PDF",
    "pdf-to-document": language === "ko" ? "PDF → 문서" : "PDF → Document",
  };
  const details = mode === "document-to-pdf"
    ? { title: labels[mode], description: language === "ko" ? "HWP·HWPX와 Word·Excel·PowerPoint 문서를 PDF로 저장하세요." : "Save HWP, HWPX, Word, Excel, and PowerPoint documents as PDF." }
    : mode === "pdf-to-document"
      ? { title: labels[mode], description: language === "ko" ? "PDF의 텍스트와 표를 문서로 추출하세요." : "Extract PDF text and tables into documents." }
      : copy.modes[mode];
  const title = language === "ko" ? "PDF 변환" : "PDF Converter";
  return <UtilityPage toolId="pdf-converter">
    <div className="pdf-tool-page" data-pdf-mode={mode}>
      <PageHeader eyebrow={title} title={details.title} description={details.description}>
        <PrivacyBanner compact />
      </PageHeader>
      <nav aria-label={title} className="pdf-tool-navigation mb-[17px] grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-2xl bg-muted p-1">
        {navigation.map(({ mode: itemMode, icon: Icon }) => <Link
          key={itemMode}
          to={localizedPath(language, `/tools/pdf-converter/${itemMode}`)}
          data-active={mode === itemMode || undefined}
          aria-current={mode === itemMode ? "page" : undefined}
          className={`flex min-h-[43px] items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold outline-none transition-[color,background-color,box-shadow] focus-visible:ring-3 focus-visible:ring-primary/30 ${mode === itemMode ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:bg-card/60 hover:text-foreground"}`}
        ><Icon size={17} /><span>{labels[itemMode]}</span></Link>)}
      </nav>
      {mode === "document-to-pdf" ? <DocumentPdfPanel /> : mode === "pdf-to-document" ? <>
        <UtilityNotice kind="info" className="mb-4">{language === "ko"
          ? "텍스트·표 추출형 변환입니다. 원본의 배치·도형·서식 복원을 보장하지 않으며 PPTX·HWPX 출력은 제공하지 않습니다. 스캔 PDF는 아래 OCR 설정을 사용하세요."
          : "This conversion extracts text and tables. It does not guarantee restoration of the original layout, shapes, or formatting. PPTX and HWPX output are not available. For scanned PDFs, use the OCR settings below."}</UtilityNotice>
        <PdfConvertPanel preset={convertPreset} />
      </> : <PdfImagePanel direction={mode} />}
      <ToolGuideWrapper slug="pdfConverter" />
    </div>
  </UtilityPage>;
}
