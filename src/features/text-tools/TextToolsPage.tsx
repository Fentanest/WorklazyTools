import { CheckCheck, Copy, Eraser, LetterText, ScanText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { PageHeader, PrimaryButton, SectionCard } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";

type TextAction = "trim-lines" | "collapse-spaces" | "remove-linebreaks" | "dedupe-lines" | "camel" | "snake" | "kebab" | "title";
interface Finding { id: string; label: string; before: string; after: string; count: number }

const ACTIONS: TextAction[] = ["trim-lines", "collapse-spaces", "remove-linebreaks", "dedupe-lines", "camel", "snake", "kebab", "title"];

export function TextToolsPage() {
  const { t, i18n } = useTranslation(["features", "common"]);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [ruleCount, setRuleCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const workerRef = useRef<Worker | undefined>(undefined);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = (message: object) => {
    workerRef.current?.terminate();
    const worker = new Worker(new URL("./text-tools.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    setBusy(true);
    worker.onmessage = (event) => {
      if (event.data.type === "result") setOutput(event.data.text);
      if (event.data.type === "inspection") { setFindings(event.data.findings); setRuleCount(event.data.ruleCount); }
      if (event.data.type === "error") window.alert(event.data.message);
      setBusy(false);
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = undefined;
    };
    worker.onerror = () => { setBusy(false); worker.terminate(); if (workerRef.current === worker) workerRef.current = undefined; };
    worker.postMessage({ ...message, language: i18n.language });
  };

  return (
    <div className="page tool-page page-enter utility-page text-tools-page">
      <PageHeader eyebrow="TEXT TOOLS" title={t("features:textTools.title")} description={t("features:textTools.description")}><PrivacyBanner compact /></PageHeader>
      <div className="utility-editor-grid">
        <SectionCard title={t("features:textTools.original")} description={t("features:textTools.originalDescription")}><textarea className="utility-textarea" value={input} onChange={(event) => setInput(event.target.value)} placeholder={t("features:textTools.inputPlaceholder")} /><div className="utility-inline-actions utility-inline-actions-spacer" aria-hidden="true" /></SectionCard>
        <SectionCard title={t("features:textTools.result")} description={t("common:format.characters", { count: output.length })}><textarea className="utility-textarea" value={output} onChange={(event) => setOutput(event.target.value)} placeholder={t("features:textTools.resultPlaceholder")} /><div className="utility-inline-actions"><button className="secondary-button" type="button" disabled={!output} onClick={() => void navigator.clipboard.writeText(output)}><Copy size={16} /> {t("common:actions.copy")}</button><button className="secondary-button" type="button" onClick={() => { setInput(""); setOutput(""); setFindings([]); }}><Eraser size={16} /> {t("features:textTools.clear")}</button></div></SectionCard>
      </div>
      <SectionCard title={t("features:textTools.actionsTitle")} description={t("features:textTools.actionsDescription")}><div className="utility-action-grid">{ACTIONS.map((action) => <button type="button" key={action} disabled={!input || busy} onClick={() => run({ type: "transform", text: input, action })}><LetterText size={17} /><span>{t(`features:textTools.actions.${action}` as never)}</span></button>)}</div><p className="term-note">{t("features:textTools.caseHelp")}</p></SectionCard>
      <SectionCard title={t("features:textTools.koreanTitle")} description={t("features:textTools.koreanDescription")}>
        <PrimaryButton accent="blue" disabled={!input} loading={busy} onClick={() => run({ type: "inspect", text: input })}><ScanText size={18} /> {t("features:textTools.inspect")}</PrimaryButton>
        {ruleCount > 0 && <p className="utility-summary"><CheckCheck size={16} /> {t("features:textTools.summary", { rules: ruleCount, findings: findings.length })}</p>}
        <div className="finding-list">{findings.map((finding) => <article key={finding.id}><div><strong>{finding.before}</strong><span>→</span><b>{finding.after}</b></div><p>{finding.label} · {t("features:textTools.places", { count: finding.count })}</p></article>)}{ruleCount > 0 && !findings.length && <p className="utility-empty">{t("features:textTools.empty")}</p>}</div>
      </SectionCard>
      <ToolGuide title={t("features:textTools.guide.title")} description={t("features:textTools.guide.description")} blocks={(t("features:textTools.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))} faq={(t("features:textTools.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))} />
    </div>
  );
}
