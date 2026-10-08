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
    ? { title: labels[mode], description: language === "ko" ? "워드·엑셀·PPT는 PDF로 변환하고, HWP·HWPX는 브라우저 인쇄에서 PDF로 저장하세요." : "Convert Word, Excel and PowerPoint to PDF. For HWP or HWPX, use Save as PDF in the browser print dialog." }
    : mode === "pdf-to-document"
      ? { title: labels[mode], description: language === "ko" ? "PDF를 DOCX·XLSX·PPTX·HWPX로 변환하세요. 스캔 페이지는 OCR하거나 원래 모양을 그림으로 보존할 수 있습니다." : "Convert PDF to DOCX, XLSX, PPTX or HWPX. Recognize scanned text with OCR or keep page appearance as an image." }
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
          ? "편집 가능한 내용과 페이지 모양 유지 중 선택하세요. 모양을 유지하면 스캔 문서도 저장할 수 있지만 그림 속 글자는 편집할 수 없습니다. 편집형 결과의 표·글꼴·배치는 원본과 달라질 수 있습니다."
          : "Choose editable content or preserve page appearance. Preserved scan pages keep their look, but text in the image is not editable. Tables, fonts and layout in editable results may differ from the original."}</UtilityNotice>
        <PdfConvertPanel preset={convertPreset} />
      </> : <PdfImagePanel direction={mode} />}
      <ToolGuideWrapper slug="pdfConverter" />
    </div>
  </UtilityPage>;
}
