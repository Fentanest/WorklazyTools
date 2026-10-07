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
    ? { title: labels[mode], description: language === "ko" ? "한글(HWP·HWPX), 워드, 엑셀과 PPT 프레젠테이션을 PDF로 저장하세요." : "Convert Word, Excel, PowerPoint and HWP / HWPX documents to PDF." }
    : mode === "pdf-to-document"
      ? { title: labels[mode], description: language === "ko" ? "PDF를 워드·엑셀·PPT·한글 문서로 바꾸고 추출한 내용과 이미지를 확인하세요." : "Convert PDF to Word, Excel, PowerPoint or HWPX and review the extracted text and images." }
      : copy.modes[mode];
  const title = language === "ko" ? "PDF 변환" : "PDF Converter";
  return <UtilityPage toolId="pdf-converter" className="[--primary:var(--brand-strong)] [&_.bg-primary:hover]:bg-[var(--brand-strong)] [&_[data-ui-component=file-list]>li>span:first-child]:text-foreground [&_[data-testid=pdf-download]_small]:text-primary-foreground [&_.privacy-inline]:text-foreground [&_.ui-step-number]:bg-[var(--brand-strong)] [&_.ui-step-number]:text-primary-foreground [&_[data-slot=notice]]:text-foreground">
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
          className={`flex min-h-[43px] items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold outline-none transition-[color,background-color,box-shadow] focus-visible:ring-3 focus-visible:ring-primary/30 ${mode === itemMode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60 hover:text-foreground"}`}
        ><Icon size={17} /><span>{labels[itemMode]}</span></Link>)}
      </nav>
      {mode === "document-to-pdf" ? <DocumentPdfPanel /> : mode === "pdf-to-document" ? <>
        <UtilityNotice kind="info" className="mb-4">{language === "ko"
          ? "DOCX·XLSX는 텍스트·표 추출, PPTX·HWPX는 편집 가능한 글자와 별도 이미지로 기본 문서를 만듭니다. 원본 배치·표 구조·수식·도형 복원은 보장하지 않습니다. 스캔 그림은 편집 가능한 글자가 아니며, OCR 결과를 별도로 확인하세요."
          : "DOCX / XLSX extract text and tables. PPTX / HWPX create basic documents with editable text and separate images. This does not guarantee restoration of the original layout, table structure, formulas, or shapes. Scan pictures are not editable text; check the separate OCR results."}</UtilityNotice>
        <PdfConvertPanel preset={convertPreset} />
      </> : <PdfImagePanel direction={mode} />}
      <ToolGuideWrapper slug="pdfConverter" />
    </div>
  </UtilityPage>;
}
