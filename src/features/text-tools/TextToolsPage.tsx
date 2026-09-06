import { CheckCheck, Copy, Eraser, LetterText, ScanText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { PageHeader, PrimaryButton } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { ToolGuide } from "../../components/ToolGuide";
import {
  pairedEditorClassName,
  UtilityNotice,
  UtilityPage,
  UtilitySectionCard,
  UtilityTextarea,
} from "../../components/UtilitySurface";

type TextAction = "trim-lines" | "collapse-spaces" | "remove-linebreaks" | "dedupe-lines" | "camel" | "snake" | "kebab" | "title";
interface Finding { id: string; label: string; before: string; after: string; count: number }

const ACTIONS: TextAction[] = ["trim-lines", "collapse-spaces", "remove-linebreaks", "dedupe-lines", "camel", "snake", "kebab", "title"];

export function TextToolsPage() {
  const { t, i18n } = useTranslation(["features", "common"]);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [ruleCount, setRuleCount] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [initializationError, setInitializationError] = useState<unknown>();
  const workerRef = useRef<Worker | undefined>(undefined);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = (message: object) => {
    setError("");
    workerRef.current?.terminate();
    let worker: Worker;
    try {
      worker = new Worker(new URL("./text-tools.worker.ts", import.meta.url), { type: "module" });
    } catch (reason) {
      setBusy(false);
      setInitializationError(reason);
      return;
    }
    workerRef.current = worker;
    setBusy(true);
    worker.onmessage = (event) => {
      if (event.data.type === "result") setOutput(event.data.text);
      if (event.data.type === "inspection") { setFindings(event.data.findings); setRuleCount(event.data.ruleCount); }
      if (event.data.type === "error") setError(t("common:recovery.operationFailed"));
      setBusy(false);
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = undefined;
    };
    worker.onerror = worker.onmessageerror = () => { setError(t("common:recovery.operationFailed")); setBusy(false); worker.terminate(); if (workerRef.current === worker) workerRef.current = undefined; };
    try { worker.postMessage({ ...message, language: i18n.language }); } catch (reason) {
      worker.terminate(); workerRef.current = undefined; setBusy(false); setInitializationError(reason);
    }
  };

  if (initializationError !== undefined) throw initializationError;

  return (
    <UtilityPage toolId="text-tools">
      <PageHeader eyebrow="TEXT TOOLS" title={t("features:textTools.title")} description={t("features:textTools.description")}><PrivacyBanner compact /></PageHeader>
      {error && <UtilityNotice tone="error" role="alert">{error}</UtilityNotice>}
      <div className="grid grid-cols-2 items-stretch gap-[15px] max-[620px]:grid-cols-1" data-testid="text-tools-editors">
        <UtilitySectionCard title={t("features:textTools.original")} description={t("features:textTools.originalDescription")} className="flex min-w-0 flex-col"><UtilityTextarea data-testid="text-tools-input" className={pairedEditorClassName} aria-label={t("features:textTools.original")} value={input} onChange={(event) => setInput(event.target.value)} placeholder={t("features:textTools.inputPlaceholder")} /><div className="invisible mt-[11px] min-h-[38px]" aria-hidden="true" /></UtilitySectionCard>
        <UtilitySectionCard title={t("features:textTools.result")} description={t("common:format.characters", { count: output.length })} className="flex min-w-0 flex-col"><UtilityTextarea data-testid="text-tools-output" className={pairedEditorClassName} aria-label={t("features:textTools.result")} value={output} onChange={(event) => setOutput(event.target.value)} placeholder={t("features:textTools.resultPlaceholder")} /><div className="mt-[11px] flex min-h-[38px] flex-wrap items-center gap-2"><Button variant="secondary" size="lg" className="rounded-xl font-bold" type="button" disabled={!output} onClick={() => void navigator.clipboard.writeText(output)}><Copy size={16} /> {t("common:actions.copy")}</Button><Button variant="secondary" size="lg" className="rounded-xl font-bold" type="button" onClick={() => { setInput(""); setOutput(""); setFindings([]); setRuleCount(0); }}><Eraser size={16} /> {t("features:textTools.clear")}</Button></div></UtilitySectionCard>
      </div>
      <UtilitySectionCard title={t("features:textTools.actionsTitle")} description={t("features:textTools.actionsDescription")}><div className="grid grid-cols-4 gap-2 max-[620px]:grid-cols-2" data-testid="text-actions">{ACTIONS.map((action) => <Button variant="secondary" className="h-auto min-h-[58px] justify-start whitespace-normal rounded-xl p-2.5 text-left font-bold text-blue-700 hover:-translate-y-px dark:text-blue-300" type="button" key={action} disabled={!input || busy} onClick={() => run({ type: "transform", text: input, action })}><LetterText size={17} /><span>{t(`features:textTools.actions.${action}` as never)}</span></Button>)}</div><p className="mt-3 text-[13px] font-medium leading-relaxed text-muted-foreground">{t("features:textTools.caseHelp")}</p></UtilitySectionCard>
      <UtilitySectionCard title={t("features:textTools.koreanTitle")} description={t("features:textTools.koreanDescription")}>
        <PrimaryButton accent="blue" disabled={!input} loading={busy} onClick={() => run({ type: "inspect", text: input })}><ScanText size={18} /> {t("features:textTools.inspect")}</PrimaryButton>
        {ruleCount > 0 && <p className="mt-3.5 flex items-center gap-2 text-sm font-bold text-green-700 dark:text-green-300" data-testid="text-inspection-summary"><CheckCheck size={16} /> {t("features:textTools.summary", { rules: ruleCount, findings: findings.length })}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2 max-[620px]:grid-cols-1" data-testid="text-findings">{findings.map((finding) => <article className="rounded-xl border border-border bg-muted p-3" key={finding.id}><div className="flex items-center gap-2 text-sm"><strong className="text-red-700 line-through dark:text-red-300">{finding.before}</strong><span>→</span><b className="text-green-700 dark:text-green-300">{finding.after}</b></div><p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{finding.label} · {t("features:textTools.places", { count: finding.count })}</p></article>)}{ruleCount > 0 && !findings.length && <p className="col-span-full rounded-xl bg-muted p-5 text-center text-sm text-muted-foreground">{t("features:textTools.empty")}</p>}</div>
      </UtilitySectionCard>
      <ToolGuide title={t("features:textTools.guide.title")} description={t("features:textTools.guide.description")} blocks={(t("features:textTools.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))} faq={(t("features:textTools.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))} />
    </UtilityPage>
  );
}
