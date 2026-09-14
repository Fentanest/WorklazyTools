import { useEffect, useRef } from "react";
import { useAppLanguage } from "../i18n/routing";
import { Button } from "./ui/button";
export function DirectEntryConfirmation({ open, onAccept, onReject }: { open: boolean; onAccept: () => void; onReject: () => void }) {
  const language = useAppLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  return <dialog ref={dialog} data-testid="direct-entry-confirm" aria-labelledby="direct-entry-confirm-title" onCancel={event => { event.preventDefault(); onReject(); }} className="m-auto max-w-[min(440px,calc(100%-32px))] rounded-2xl border border-border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/40">
    <h2 id="direct-entry-confirm-title" className="mb-3 text-lg font-bold">{language === "ko" ? "작업 목적을 바꿀까요?" : "Change the task?"}</h2>
    <p className="mb-5 text-sm">{language === "ko" ? "진행 중인 처리를 취소하고 이전 결과를 지웁니다. 입력 파일과 편집 내용은 유지하며 새 목적의 설정을 적용합니다." : "Cancel processing and clear previous results. Keep your input files and edits, and apply the new task settings."}</p>
    <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onReject} data-testid="direct-entry-reject">{language === "ko" ? "기존 작업 유지" : "Keep current task"}</Button><Button onClick={onAccept} data-testid="direct-entry-accept">{language === "ko" ? "목적 변경" : "Change task"}</Button></div>
  </dialog>;
}
export function DirectEntryNotice({ purpose, title, description }: { purpose: string; title: string; description: string }) {
  return <section data-direct-purpose={purpose} className="mb-4 rounded-xl border border-border bg-muted p-4"><h2 className="font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></section>;
}
