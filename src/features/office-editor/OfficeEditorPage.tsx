import { FileEdit, FileSpreadsheet, MonitorUp, Presentation, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { FileDropZone, formatBytes, PageHeader, SectionCard } from "../../components/ui";
import { useAppLanguage, useLocalizedPath } from "../../i18n/routing";
import { stagePendingOfficeFile } from "./pendingOfficeFile";
import { OFFICE_DOWNLOAD_BYTES } from "./officeAssets";

const OFFICE_ACCEPT = ".docx,.doc,.odt,.xlsx,.xls,.ods,.pptx,.ppt,.odp";
const OFFICE_EXTENSIONS = new Set(["docx", "doc", "odt", "xlsx", "xls", "ods", "pptx", "ppt", "odp"]);

export function OfficeEditorPage() {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "en" ? en : ko;
  const appPath = useLocalizedPath("/tools/office-editor/app/");
  const downloadSize = formatBytes(OFFICE_DOWNLOAD_BYTES);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffError, setHandoffError] = useState<string>();
  const openDroppedFile = async (files: File[]) => {
    const file = files.at(-1);
    if (!file || handoffBusy) return;
    if (!OFFICE_EXTENSIONS.has(file.name.split(".").pop()?.toLowerCase() ?? "")) {
      setHandoffError(L("DOCX, DOC, ODT, XLSX, XLS, ODS, PPTX, PPT 또는 ODP 파일 한 개를 선택해 주세요.", "Choose one DOCX, DOC, ODT, XLSX, XLS, ODS, PPTX, PPT or ODP file."));
      return;
    }
    setHandoffBusy(true);
    setHandoffError(undefined);
    try {
      await stagePendingOfficeFile(file);
      window.location.assign(appPath);
    } catch {
      setHandoffBusy(false);
      setHandoffError(L("브라우저에 파일을 임시 보관하지 못했습니다. 저장 공간을 허용한 뒤 다시 시도해 주세요.", "The file could not be held temporarily in this browser. Allow site storage and try again."));
    }
  };
  return <div className="page tool-page page-enter accent-context-violet office-editor-landing">
    <PageHeader eyebrow="OFFICE TOOL" title={L("브라우저 오피스 편집기", "Browser Office Editor")} description={L("LibreOffice 기반 편집 화면에서 문서·스프레드시트·프레젠테이션을 열고 저장하세요.", "Open and save documents, spreadsheets, and presentations in a LibreOffice-based editor.")}>
      <div className="header-status ready"><span className="status-dot" /> {L("파일 업로드 없이 편집", "Edit without file uploads")}</div>
    </PageHeader>
    <PrivacyBanner compact />

    <SectionCard title={L("데스크톱형 오피스 화면", "Desktop-style office workspace")} description={L(`편집할 파일을 선택한 뒤에만 대용량 자산을 내려받습니다. 첫 준비에는 약 ${downloadSize}의 저장 공간과 안정적인 인터넷 연결이 필요합니다.`, `Large assets download only after you choose a file to edit. Initial setup needs about ${downloadSize} of storage and a stable connection.`)}>
      <div className="office-format-grid">
        <div><FileEdit size={23} /><strong>Writer</strong><span>DOCX · DOC · ODT</span></div>
        <div><FileSpreadsheet size={23} /><strong>Calc</strong><span>XLSX · XLS · ODS</span></div>
        <div><Presentation size={23} /><strong>Impress</strong><span>PPTX · PPT · ODP</span></div>
      </div>
      <div className="office-start-panel">
        <MonitorUp size={25} />
        <div><strong>{L("집중 편집용 별도 작업 화면에서 열립니다.", "The editor opens in a dedicated workspace for focused editing.")}</strong><small>{L("다운로드 바이트, 준비 단계와 경과 시간을 계속 표시합니다.", "Downloaded bytes, preparation stages, and elapsed time remain visible.")}</small></div>
        <Link className="primary-button accent-violet" to={appPath}>{L("오피스 편집기 시작", "Start office editor")}</Link>
      </div>
      <div className="office-landing-drop">
        <FileDropZone files={[]} onFiles={openDroppedFile} accept={OFFICE_ACCEPT} hint={L("파일을 놓으면 준비부터 문서 열기까지 자동으로 진행합니다.", "Drop a file to prepare the editor and open it automatically.")} accent="violet" disabled={handoffBusy} />
        <small>{handoffBusy ? L("집중 편집 화면으로 이동하는 중…", "Opening the focused editor workspace…") : L("DOCX·DOC·ODT·XLSX·XLS·ODS·PPTX·PPT·ODP · 한 파일", "DOCX, DOC, ODT, XLSX, XLS, ODS, PPTX, PPT or ODP · one file")}</small>
        {handoffError && <p className="field-error" role="alert">{handoffError}</p>}
      </div>
    </SectionCard>

    <div className="comparison-prepare-note"><ShieldCheck size={16} /><span><strong>{L("문서는 현재 브라우저 안에서만 열고 저장합니다.", "Documents are opened and saved only in your current browser.")}</strong><small>{L("매크로 실행과 외부 문서 갱신은 열 때 차단합니다. 중요한 문서는 저장한 파일을 원래 프로그램에서도 확인하세요.", "Macro execution and external document updates are blocked on open. Verify important saved files in their original application.")}</small></span></div>

    <ToolGuide
      title={L("브라우저 오피스 편집기 안내", "Browser office editor guide")}
      description={L("LibreOffice를 브라우저에서 실행하는 대용량 편집 기능입니다.", "This large editor runs LibreOffice in your browser.")}
      blocks={language === "en" ? [
        { title: "One-step opening", paragraphs: ["Drop or choose one supported file to move to the focused workspace, prepare the editor, and open the document automatically."] },
        { title: "First download", paragraphs: [`The first start downloads about ${downloadSize}, including a Korean fallback font. A byte-based progress bar and current step are shown, and the files are cached for later visits.`] },
        { title: "Compatibility", paragraphs: ["Writer, Calc, and Impress formats are supported. A Korean fallback font is included, but pagination and advanced Microsoft Office features can still render differently."] },
        { title: "Privacy and safety", paragraphs: ["A file dropped on this guide page is held briefly in browser storage only to cross into the focused workspace, then removed immediately. Macros and external document updates are disabled when it opens."] },
        { title: "Saving", paragraphs: ["Save downloads a copy using the current filename. The output container is checked before the browser offers it for download."] },
      ] : [
        { title: "한 번에 열기", paragraphs: ["지원 파일 한 개를 놓거나 선택하면 집중 작업 화면 이동, 편집기 준비와 문서 열기를 자동으로 이어서 실행합니다."] },
        { title: "최초 다운로드", paragraphs: [`처음 시작할 때 한글 대체 글꼴을 포함해 약 ${downloadSize}를 내려받습니다. 실제 바이트 기준 진행률과 현재 단계를 표시하고 다음 방문을 위해 브라우저에 보관합니다.`] },
        { title: "호환성", paragraphs: ["Writer, Calc, Impress 형식과 한글 대체 글꼴을 지원하지만 페이지 나눔과 복잡한 Microsoft Office 기능은 다르게 표시될 수 있습니다."] },
        { title: "개인정보와 안전", paragraphs: ["안내 화면에 놓은 파일은 집중 작업 화면으로 넘기는 동안만 브라우저 저장 공간에 보관하고 가져온 즉시 삭제합니다. 문서를 열 때 매크로 실행과 외부 문서 갱신은 차단합니다."] },
        { title: "저장", paragraphs: ["저장을 누르면 현재 파일 이름으로 사본을 내려받습니다. 브라우저가 다운로드를 제공하기 전에 출력 파일 구조를 확인합니다."] },
      ]}
      faq={language === "en" ? [
        { question: "Why is the first start large?", answer: "A browser build of the office suite and its fonts and resources must be stored locally. Later starts can reuse the cache." },
        { question: "Does Korean text display correctly?", answer: "A Korean fallback font is bundled. Documents that require proprietary fonts can still have different line breaks or spacing." },
        { question: "Is this an official Microsoft Office web app?", answer: "No. It is a LibreOffice-based browser editor and compatibility can differ from Microsoft Office." },
        { question: "Are HWP files supported here?", answer: "Use the dedicated HWP editor for HWP/HWPX files. This editor focuses on Writer, Calc, and Impress formats." },
      ] : [
        { question: "처음 실행 용량이 큰 이유는 무엇인가요?", answer: "오피스 프로그램과 글꼴·리소스를 브라우저에 저장해야 하기 때문입니다. 다음 실행부터는 저장된 파일을 재사용할 수 있습니다." },
        { question: "한글 글꼴도 표시되나요?", answer: "한글 대체 글꼴을 함께 제공합니다. 전용 상용 글꼴이 필요한 문서는 줄바꿈이나 글자 간격이 원본과 다를 수 있습니다." },
        { question: "Microsoft의 공식 웹 오피스인가요?", answer: "아닙니다. LibreOffice 기반 브라우저 편집기이며 Microsoft Office와 호환성 차이가 있을 수 있습니다." },
        { question: "HWP도 여기서 편집할 수 있나요?", answer: "HWP/HWPX는 전용 HWP 편집기를 이용하세요. 이 편집기는 Writer·Calc·Impress 형식에 초점을 둡니다." },
      ]}
    />
  </div>;
}
