import { FileImage, FileOutput, ImageDown, Layers3 } from "lucide-react";
import { NavLink } from "react-router-dom";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { PageHeader } from "../../components/ui";
import { useAppLanguage } from "../../i18n/routing";
import { localizedPath } from "../../i18n/languages";
import { PdfConvertPanel } from "./PdfConvertPanel";
import { PdfImagePanel } from "./PdfImagePanel";
import { PdfOrganizePanel } from "./PdfOrganizePanel";
import type { PdfToolMode } from "./types";

const modeDefinitions = {
  organize: {
    eyebrow: "PDF PAGE EDITOR",
    title: "PDF 페이지 편집·병합·추출",
    description: "페이지를 눈으로 확인하며 순서 변경·회전·선택하고, 하나의 PDF나 여러 범위별 PDF로 저장하세요.",
  },
  "image-to-pdf": {
    eyebrow: "IMAGE TO PDF",
    title: "이미지를 PDF로 변환",
    description: "JPG·PNG 이미지의 순서를 정하고 A4 맞춤 또는 원본 이미지 크기의 PDF로 변환하세요.",
  },
  "pdf-to-image": {
    eyebrow: "PDF TO IMAGE",
    title: "PDF를 이미지로 변환",
    description: "PDF의 모든 페이지를 PNG 또는 JPG로 렌더링하고 하나의 ZIP으로 내려받으세요.",
  },
  convert: {
    eyebrow: "PDF OCR & CONVERT",
    title: "PDF를 DOCX·XLSX·TXT로 변환",
    description: "내장 텍스트와 한국어·영어 OCR 결과를 문서·스프레드시트·텍스트 또는 검색 가능한 PDF로 저장하세요.",
  },
} as const;

const navigation = [
  { mode: "organize", to: "/tools/pdf-editor", label: "편집·병합·추출", icon: Layers3 },
  { mode: "image-to-pdf", to: "/tools/pdf-editor/image-to-pdf", label: "이미지→PDF", icon: FileImage },
  { mode: "pdf-to-image", to: "/tools/pdf-editor/pdf-to-image", label: "PDF→이미지", icon: ImageDown },
  { mode: "convert", to: "/tools/pdf-editor/convert", label: "문서·OCR", icon: FileOutput },
] as const;

export function PdfEditorPage({ mode }: { mode: PdfToolMode }) {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  const englishDefinitions = {
    organize: { eyebrow: "PDF PAGE EDITOR", title: "Edit, merge, and extract PDF pages", description: "Review pages visually, reorder, rotate, and select them, then export one PDF or several page ranges." },
    "image-to-pdf": { eyebrow: "IMAGE TO PDF", title: "Convert images to PDF", description: "Arrange JPG and PNG images and create a PDF fitted to A4 or sized to each original image." },
    "pdf-to-image": { eyebrow: "PDF TO IMAGE", title: "Convert PDF pages to images", description: "Render every PDF page as PNG or JPG and download them in a ZIP archive." },
    convert: { eyebrow: "PDF OCR & CONVERT", title: "Convert PDF to DOCX, XLSX, or TXT", description: "Export embedded text and Korean/English OCR results as documents, spreadsheets, text, or a searchable PDF." },
  } as const;
  const definition = language === "ko" ? modeDefinitions[mode] : englishDefinitions[mode];
  return (
    <div className="page tool-page page-enter pdf-tool-page">
      <PageHeader eyebrow={definition.eyebrow} title={definition.title} description={definition.description}>
        <PrivacyBanner compact />
      </PageHeader>

      <nav className="pdf-tool-navigation" aria-label={L("PDF 기능", "PDF tools")}>
        {navigation.map((item) => {
          const Icon = item.icon;
          const label = ({ organize: "Edit, merge & extract", "image-to-pdf": "Image → PDF", "pdf-to-image": "PDF → Image", convert: "Document & OCR" } as const)[item.mode];
          return <NavLink key={item.mode} to={localizedPath(language, item.to)} end={item.mode === "organize"} className={mode === item.mode ? "active" : ""}><Icon size={17} /><span>{L(item.label, label)}</span></NavLink>;
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
  const isConvert = mode === "convert";
  if (language === "en") return (
    <ToolGuide
      title={isConvert ? "PDF text conversion and browser OCR" : "Using the browser PDF tools"}
      description="Selected files stay in this browser's memory and are not uploaded to a processing server. Keep your originals and review every downloaded result."
      blocks={isConvert ? [
        { title: "Text PDFs and scanned PDFs", paragraphs: ["Text PDFs contain selectable characters, so extraction is fast and accurate. Scanned PDFs store each page like a photo and require OCR.", "Automatic OCR runs Korean and English recognition only on pages with little usable embedded text. A drawing or photo with no text may correctly produce an empty result."] },
        { title: "DOCX and XLSX conversion limits", paragraphs: ["PDFs often preserve positions rather than the original paragraphs, tables, and cells. DOCX reconstructs lines as paragraphs, while XLSX estimates cells from spacing.", "Complex tables, columns, vertical text, footnotes, formulas, fonts, and formatting may not be reproduced exactly. Treat the output as an editable draft and compare it with the source."] },
        { title: "OCR models and privacy", paragraphs: ["The OCR runtime and Korean/English models are served from the same GitHub Pages deployment. No external OCR server or CDN receives your document pages.", "OCR cannot start on a first offline visit or when its runtime is not cached. Reopen the site online after clearing storage, using private browsing, or running low on browser storage."] },
        { title: "Large documents", paragraphs: ["OCR renders and recognizes pages one at a time, so it takes longer than embedded-text extraction. For 50+ pages, close heavy tabs and keep enough memory and power available.", "Mobile operating systems may close memory-intensive tabs, so long documents are generally more reliable on a desktop browser."] },
      ] : [
        { title: "Page-level editing", paragraphs: ["Drag previews to reorder pages, remove unwanted pages, and rotate them. The chosen rotation is written to the exported PDF.", "If a source page is already rotated, your rotation is added to its existing orientation so the exported page matches the preview."] },
        { title: "Local processing and file lifetime", paragraphs: ["PDFs, images, and download links live in browser memory. Refreshing or closing the tab clears the current selection and any undownloaded result.", "The site, advertising, and OCR model assets may use ordinary network requests, but your work files are not sent to a conversion server."] },
        { title: "Protected PDFs and signatures", paragraphs: ["Password-protected PDFs are not supported. Use a legitimately unlocked copy provided by the document owner.", "Merging, rotating, splitting, or rebuilding a PDF invalidates existing digital signatures. Forms, bookmarks, links, attachments, and advanced objects may not survive page copying."] },
        { title: "Quality and performance", paragraphs: ["Reordering and extracting pages normally copies original PDF pages rather than rasterizing them. Image conversion and searchable OCR PDFs render pages at the selected resolution.", "More pages and higher resolution increase processing time, memory use, and output size. Previews render lazily at lower resolution to keep long documents responsive."] },
      ]}
      faq={[
        { question: "Are files uploaded to a server?", answer: "No. Selected PDFs, images, and generated results are processed in this browser. The site, ads, and OCR assets may still make ordinary network requests." },
        { question: "Can I process a password-protected PDF?", answer: "Not currently. The tool does not bypass protection; an authorized user must prepare an unlocked copy." },
        { question: "Does it work on mobile?", answer: "Yes, but desktop browsers are more reliable for long PDFs, high-resolution rendering, and large OCR jobs because mobile memory is limited." },
        { question: "Does rotation reduce PDF quality?", answer: "Page-editor rotation changes page properties without recompressing content. Image and OCR-PDF modes do rerender pages." },
        { question: "Can it perfectly restore Word or Excel structure?", answer: "Usually not. PDFs often lack the original paragraph and table structure, so the output is an editable reconstruction based on coordinates and spacing." },
        { question: "Why is the first OCR run slower?", answer: "The browser must download the Korean/English recognition models and runtime. Later runs can start faster while those assets remain cached." },
      ]}
    />
  );
  return (
    <ToolGuide
      title={isConvert ? "PDF 텍스트 변환과 브라우저 OCR 안내" : "브라우저 PDF 도구 이용 안내"}
      description="선택한 작업 파일은 외부 작업 서버로 업로드하지 않고 현재 브라우저의 메모리에서 처리합니다. 중요한 원본은 별도로 보관하고 결과 파일을 내려받은 뒤 확인해 주세요."
      blocks={isConvert ? [
        {
          title: "텍스트 PDF와 스캔 PDF의 차이",
          paragraphs: ["텍스트 PDF는 문자를 직접 선택할 수 있어 빠르고 정확하게 추출할 수 있습니다. 스캔 PDF는 페이지가 사진처럼 저장되어 있으므로 이미지에서 글자를 읽는 OCR 과정이 필요합니다.", "자동 OCR은 페이지에서 읽을 수 있는 글자가 거의 없을 때만 한국어·영어 인식을 실행합니다. 도면이나 사진처럼 글자가 없는 페이지도 정상적인 빈 결과일 수 있습니다."],
        },
        {
          title: "DOCX·XLSX 변환 범위",
          paragraphs: ["PDF는 보이는 위치를 중심으로 저장되고 원래의 문단, 표, 셀 구조가 사라진 경우가 많습니다. DOCX는 읽기 순서와 줄을 문단으로 재구성하고, XLSX는 같은 행에 놓인 글자의 간격을 이용해 셀을 추정합니다.", "복잡한 표, 다단 문서, 세로쓰기, 각주, 수식, 원본 글꼴과 서식은 완전히 재현되지 않을 수 있습니다. 결과는 편집을 시작하기 위한 초안으로 보고 원문과 대조하는 것이 안전합니다."],
        },
        {
          title: "OCR 모델과 개인정보",
          paragraphs: ["OCR 실행 구성요소와 한국어·영어 학습 모델은 Worklazy Tools와 같은 GitHub Pages 배포 경로에서 제공되며 외부 CDN이나 OCR 서버를 사용하지 않습니다. 사용자가 선택한 PDF 페이지와 인식 결과는 브라우저 밖으로 전송하지 않습니다.", "오프라인에서 사이트를 처음 열거나 브라우저 캐시에 실행 파일이 없는 상태에서는 OCR을 시작할 수 없습니다. 캐시 삭제, 시크릿 모드 또는 브라우저 저장 공간 부족 상황에서는 사이트를 온라인으로 다시 연 뒤 시도해 주세요."],
        },
        {
          title: "대용량 문서 처리",
          paragraphs: ["OCR은 페이지를 고해상도 이미지로 만든 뒤 한 장씩 인식하므로 일반 텍스트 추출보다 오래 걸립니다. 50페이지 이상 문서는 충분한 메모리와 전원을 확보하고 다른 무거운 탭을 닫는 것을 권장합니다.", "진행률은 언어 모델 준비, 페이지 렌더링, 인식, 결과 파일 생성 단계를 합쳐 표시합니다. 모바일에서는 운영체제가 메모리 사용량이 큰 탭을 종료할 수 있어 긴 문서는 데스크톱 환경이 더 안정적입니다."],
        },
      ] : [
        { title: "페이지 단위 편집", paragraphs: ["페이지 미리보기를 끌어 순서를 바꾸고 필요 없는 페이지를 제거할 수 있습니다. 회전 버튼은 화면에서 즉시 방향을 바꾸며, 새 PDF를 만들 때 해당 각도가 실제 페이지 속성에 반영됩니다.", "원본이 이미 회전된 페이지라면 원본 방향에 사용자가 선택한 회전을 더합니다. 따라서 화면에서 확인한 방향과 출력 PDF의 방향이 일치합니다."] },
        { title: "로컬 처리와 파일 수명", paragraphs: ["PDF와 이미지는 브라우저 메모리에서 읽고 결과도 임시 다운로드 주소로 제공합니다. 페이지 새로고침이나 탭 종료 시 선택 목록과 아직 내려받지 않은 결과는 사라집니다.", "사이트 화면, 광고 또는 OCR 언어 모델을 불러오는 일반 네트워크 요청은 발생할 수 있지만 작업 파일을 별도 변환 서버로 전송하지 않습니다."] },
        { title: "보호된 PDF와 서명", paragraphs: ["열기 암호로 보호된 PDF는 현재 편집할 수 없습니다. 문서 소유자가 허용한 방법으로 보호를 해제한 사본을 만든 뒤 다시 시도해 주세요.", "PDF를 병합, 회전, 분할하거나 이미지로 다시 만들면 기존 디지털 서명은 유효하지 않게 됩니다. 양식, 책갈피, 링크와 첨부 파일 같은 고급 개체도 페이지 복사 과정에서 제외될 수 있습니다."] },
        { title: "화질과 성능", paragraphs: ["페이지 순서 변경과 추출은 가능한 한 원본 페이지를 복사하므로 일반적으로 화면을 이미지로 다시 찍지 않습니다. PDF를 이미지로 변환하거나 검색 가능한 OCR PDF를 만들 때는 선택한 해상도로 페이지를 새로 렌더링합니다.", "페이지 수와 출력 해상도가 높을수록 작업 시간, 메모리와 결과 파일 크기가 증가합니다. 미리보기는 화면 확인용으로만 낮은 해상도에서 지연 렌더링하여 긴 문서에서도 조작 반응을 유지합니다."] },
      ]}
      faq={[
        { question: "파일이 서버로 업로드되나요?", answer: "아니요. 선택한 PDF·이미지와 생성 결과는 작업 서버로 업로드하지 않고 현재 브라우저에서 처리합니다. 다만 사이트와 광고, OCR 언어 모델을 내려받는 일반 네트워크 통신은 별도로 발생할 수 있습니다." },
        { question: "암호가 설정된 PDF도 처리할 수 있나요?", answer: "현재는 지원하지 않습니다. 보호를 우회하지 않으며, 권한이 있는 사용자가 암호 보호를 해제한 사본을 준비해야 합니다." },
        { question: "모바일에서도 사용할 수 있나요?", answer: "가능하지만 긴 PDF, 고해상도 이미지 변환과 대량 OCR은 메모리 제한 때문에 데스크톱 브라우저가 더 안정적입니다." },
        { question: "회전하면 PDF 화질이 떨어지나요?", answer: "페이지 편집의 회전은 페이지 속성만 바꾸므로 내용을 이미지로 다시 압축하지 않습니다. 이미지 변환과 OCR PDF는 페이지를 다시 렌더링하므로 원본 벡터 구조와 달라집니다." },
        { question: "PDF를 Word나 Excel로 완벽하게 복원할 수 있나요?", answer: "PDF에 원래 문단과 표 구조가 남아 있지 않은 경우가 많아 완벽한 복원은 어렵습니다. 좌표와 글자 간격으로 구조를 추정한 편집용 초안을 제공합니다." },
        { question: "OCR은 왜 처음 실행할 때 더 오래 걸리나요?", answer: "한국어·영어 인식 모델과 브라우저 실행 구성요소를 처음 내려받기 때문입니다. 브라우저 캐시에 남아 있으면 다음 작업은 준비 시간이 짧아질 수 있습니다." },
      ]}
    />
  );
}
