import { FileEdit, FileSpreadsheet, MonitorUp, Presentation, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Link } from "react-router-dom";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";
import { FileDropZone, formatBytes, PageHeader } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { UtilityNotice, UtilityPage, UtilitySectionCard } from "../../components/UtilitySurface";
import { useAppLanguage, useLocalizedPath } from "../../i18n/routing";
import { stagePendingOfficeFile } from "./pendingOfficeFile";
import { OFFICE_DOWNLOAD_BYTES } from "./officeAssets";

const OFFICE_ACCEPT = ".docx,.doc,.odt,.xlsx,.xls,.ods,.pptx,.ppt,.odp";
const OFFICE_EXTENSIONS = new Set(["docx", "doc", "odt", "xlsx", "xls", "ods", "pptx", "ppt", "odp"]);

export function OfficeEditorPage() {
 const language = useAppLanguage();
 const L = (ko: string, en: string) => language === "en" ? en : ko;



 const appPath = useLocalizedPath("/tools/office-editor/app/");
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("guide") !== "1") {
      navigate(appPath, { replace: true });
    }
  }, [navigate, appPath, location.search]);
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
 return <UtilityPage toolId="office-editor">
  <PageHeader eyebrow="OFFICE TOOL" title={L("브라우저 오피스 편집기", "Browser Office Editor")} description={L("LibreOffice 기반 편집 화면에서 문서·스프레드시트·프레젠테이션을 열고 저장하세요.", "Open and save documents, spreadsheets, and presentations in a LibreOffice-based editor.")}>
   <div className="inline-flex min-h-8 items-center gap-2 rounded-full bg-primary/10 px-3 text-xs font-bold text-primary dark:text-primary"><span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.12)]" /> {L("파일 업로드 없이 편집", "Edit without file uploads")}</div>
  </PageHeader>
  <PrivacyBanner compact />

  <UtilitySectionCard title={L("데스크톱형 오피스 화면", "Desktop-style office workspace")} description={L(`편집 화면에 진입하면 편집에 필요한 대용량 자산을 먼저 내려받습니다. 첫 준비에는 약 ${downloadSize}의 저장 공간과 안정적인 인터넷 연결이 필요합니다.`, `Large assets download automatically when you enter the workspace. Initial setup needs about ${downloadSize} of storage and a stable connection.`)}>
   <div className="mt-4 grid grid-cols-3 gap-2.5 max-[620px]:grid-cols-1" data-testid="office-format-grid">
    <FormatCard icon={<FileEdit size={23} />} name="Writer" extensions="DOCX · DOC · ODT" />
    <FormatCard icon={<FileSpreadsheet size={23} />} name="Calc" extensions="XLSX · XLS · ODS" />
    <FormatCard icon={<Presentation size={23} />} name="Impress" extensions="PPTX · PPT · ODP" />
   </div>
   <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[13px] rounded-2xl border border-primary/20 bg-primary/10 px-4 py-[15px] max-[820px]:grid-cols-[auto_minmax(0,1fr)]" data-testid="office-start-panel">
    <MonitorUp className="text-primary" size={25} />
    <div className="flex min-w-0 flex-col"><strong className="text-sm">{L("집중 편집용 별도 작업 화면에서 열립니다.", "The editor opens in a dedicated workspace for focused editing.")}</strong><small className="mt-[3px] text-[13px] leading-[1.45] text-muted-foreground">{L("페이지 진입 시 편집 환경 준비를 자동으로 시작합니다.", "Preparation starts automatically when entering the page.")}</small></div>
    <Button render={<Link to={appPath} />} size="lg" className="min-w-44 rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90 max-[820px]:col-span-full max-[820px]:w-full">{L("편집 화면 열기", "Open editor workspace")}</Button>
   </div>
   <div className="mt-3.5 grid gap-2" data-testid="office-landing-drop">
    <FileDropZone files={[]} onFiles={openDroppedFile} accept={OFFICE_ACCEPT} hint={L("파일을 놓으면 준비부터 문서 열기까지 자동으로 진행합니다.", "Drop a file to prepare the editor and open it automatically.")} accent="coral" disabled={handoffBusy} />
    <small className="text-center text-xs text-muted-foreground">{handoffBusy ? L("집중 편집 화면으로 이동하는 중…", "Opening the focused editor workspace…") : L("DOCX·DOC·ODT·XLSX·XLS·ODS·PPTX·PPT·ODP · 한 파일", "DOCX, DOC, ODT, XLSX, ODS, PPTX, PPT or ODP · one file")}</small>
    {handoffError && <UtilityNotice className="justify-center text-center" kind="error" role="alert">{handoffError}</UtilityNotice>}
   </div>
  </UtilitySectionCard>

  <Card className="flex items-start gap-2.5 rounded-2xl border-primary/20 bg-primary/10 p-3.5 text-primary shadow-none dark:text-primary"><ShieldCheck className="mt-0.5 shrink-0" size={16} /><span className="flex flex-col gap-0.5"><strong className="text-[13px] text-foreground">{L("문서는 현재 브라우저 안에서만 열고 저장합니다.", "Documents are opened and saved only in your current browser.")}</strong><small className="text-xs leading-relaxed text-muted-foreground">{L("매크로 실행과 외부 문서 갱신은 열 때 차단합니다. 중요한 문서는 저장한 파일을 원래 프로그램에서도 확인하세요.", "Macro execution and external document updates are blocked on open. Verify important saved files in their original application.")}</small></span></Card>

  <ToolGuideWrapper slug="officeEditor" />
 </UtilityPage>;
}

function FormatCard({ icon, name, extensions }: { icon: ReactNode; name: string; extensions: string }) {
 return <Card className="flex min-h-28 flex-col items-start justify-center gap-1 rounded-[15px] bg-muted p-[17px] text-primary shadow-none max-[620px]:min-h-21 dark:text-primary">{icon}<strong className="text-base text-foreground">{name}</strong><span className="text-[13px] text-muted-foreground">{extensions}</span></Card>;
}
