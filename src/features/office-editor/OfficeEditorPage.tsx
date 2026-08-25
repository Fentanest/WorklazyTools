import { FileEdit, FileSpreadsheet, MonitorUp, Presentation, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { PageHeader, SectionCard } from "../../components/ui";
import { useAppLanguage, useLocalizedPath } from "../../i18n/routing";

export function OfficeEditorPage() {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "en" ? en : ko;
  const appPath = useLocalizedPath("/tools/office-editor/app/");
  return <div className="page tool-page page-enter accent-context-violet office-editor-landing">
    <PageHeader eyebrow="OFFICE TOOL" title={L("브라우저 오피스 편집기", "Browser Office Editor")} description={L("LibreOffice 기반 편집 화면에서 문서·스프레드시트·프레젠테이션을 열고 저장하세요.", "Open and save documents, spreadsheets, and presentations in a LibreOffice-based editor.")}>
      <div className="header-status ready"><span className="status-dot" /> {L("파일 업로드 없이 편집", "Edit without file uploads")}</div>
    </PageHeader>
    <PrivacyBanner compact />

    <SectionCard title={L("데스크톱형 오피스 화면", "Desktop-style office workspace")} description={L("큰 편집 파일은 시작 버튼을 누른 뒤에만 내려받습니다. 첫 준비에는 약 250MB의 저장 공간과 안정적인 인터넷 연결이 필요합니다.", "Large editor files download only after you start. Initial setup needs about 250 MB of storage and a stable connection.")}>
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
    </SectionCard>

    <div className="comparison-prepare-note"><ShieldCheck size={16} /><span><strong>{L("문서는 현재 브라우저 안에서만 열고 저장합니다.", "Documents are opened and saved only in your current browser.")}</strong><small>{L("매크로 실행과 외부 문서 갱신은 열 때 차단합니다. 중요한 문서는 저장한 파일을 원래 프로그램에서도 확인하세요.", "Macro execution and external document updates are blocked on open. Verify important saved files in their original application.")}</small></span></div>

    <ToolGuide
      title={L("브라우저 오피스 편집기 안내", "Browser office editor guide")}
      description={L("LibreOffice를 브라우저에서 실행하는 대용량 편집 기능입니다.", "This large editor runs LibreOffice in your browser.")}
      blocks={language === "en" ? [
        { title: "First download", paragraphs: ["The first start downloads about 250 MB. A byte-based progress bar and current step are shown, and the files are cached for later visits."] },
        { title: "Compatibility", paragraphs: ["Writer, Calc, and Impress formats are supported, but fonts, pagination, macros, and complex Microsoft Office features can render differently."] },
        { title: "Privacy and safety", paragraphs: ["Files remain in browser memory. Macros and external document updates are disabled when a document opens."] },
        { title: "Saving", paragraphs: ["Save downloads a copy using the current filename. The output container is checked before the browser offers it for download."] },
      ] : [
        { title: "최초 다운로드", paragraphs: ["처음 시작할 때 약 250MB를 내려받습니다. 실제 바이트 기준 진행률과 현재 단계를 표시하고 다음 방문을 위해 브라우저에 보관합니다."] },
        { title: "호환성", paragraphs: ["Writer, Calc, Impress 형식을 지원하지만 글꼴, 페이지 나눔, 매크로와 복잡한 Microsoft Office 기능은 다르게 표시될 수 있습니다."] },
        { title: "개인정보와 안전", paragraphs: ["파일은 브라우저 메모리에서만 사용합니다. 문서를 열 때 매크로 실행과 외부 문서 갱신은 차단합니다."] },
        { title: "저장", paragraphs: ["저장을 누르면 현재 파일 이름으로 사본을 내려받습니다. 브라우저가 다운로드를 제공하기 전에 출력 파일 구조를 확인합니다."] },
      ]}
      faq={language === "en" ? [
        { question: "Why is the first start large?", answer: "A browser build of the office suite and its fonts and resources must be stored locally. Later starts can reuse the cache." },
        { question: "Is this an official Microsoft Office web app?", answer: "No. It is a LibreOffice-based browser editor and compatibility can differ from Microsoft Office." },
        { question: "Are HWP files supported here?", answer: "Use the dedicated HWP editor for HWP/HWPX files. This editor focuses on Writer, Calc, and Impress formats." },
      ] : [
        { question: "처음 실행 용량이 큰 이유는 무엇인가요?", answer: "오피스 프로그램과 글꼴·리소스를 브라우저에 저장해야 하기 때문입니다. 다음 실행부터는 저장된 파일을 재사용할 수 있습니다." },
        { question: "Microsoft의 공식 웹 오피스인가요?", answer: "아닙니다. LibreOffice 기반 브라우저 편집기이며 Microsoft Office와 호환성 차이가 있을 수 있습니다." },
        { question: "HWP도 여기서 편집할 수 있나요?", answer: "HWP/HWPX는 전용 HWP 편집기를 이용하세요. 이 편집기는 Writer·Calc·Impress 형식에 초점을 둡니다." },
      ]}
    />
  </div>;
}
