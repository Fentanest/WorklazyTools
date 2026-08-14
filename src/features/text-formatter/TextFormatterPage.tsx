import { Braces, CodeXml, Copy, Database, Minimize2, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { PageHeader, PrimaryButton, SectionCard, SegmentedControl } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";

type FormatKind = "json" | "sql" | "xml";

export function TextFormatterPage() {
  const { t, i18n } = useTranslation(["features", "common"]);
  const [kind, setKind] = useState<FormatKind>("json");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [indent, setIndent] = useState(2);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const workerRef = useRef<Worker | undefined>(undefined);
  useEffect(() => () => workerRef.current?.terminate(), []);

  const execute = (mode: "pretty" | "minify") => {
    workerRef.current?.terminate(); setBusy(true); setError("");
    const worker = new Worker(new URL("./text-formatter.worker.ts", import.meta.url), { type: "module" }); workerRef.current = worker;
    worker.onmessage = (event) => {
      if (event.data.type === "result") setOutput(event.data.result);
      else setError(event.data.message);
      setBusy(false); worker.terminate(); if (workerRef.current === worker) workerRef.current = undefined;
    };
    worker.onerror = (event) => { setBusy(false); setError(event.message || t("features:formatter.workerError")); worker.terminate(); if (workerRef.current === worker) workerRef.current = undefined; };
    worker.postMessage({ kind, mode, text: input, indent, language: i18n.language });
  };

  return <div className="page tool-page page-enter utility-page formatter-page">
    <PageHeader eyebrow="FORMATTER" title={t("features:formatter.title")} description={t("features:formatter.description")}><PrivacyBanner compact /></PageHeader>
    <SectionCard title={t("features:formatter.settings")}><div className="formatter-toolbar"><SegmentedControl value={kind} onChange={(value) => { setKind(value); setError(""); }} label={t("features:formatter.formatLabel")} options={[{ value: "json", label: "JSON" }, { value: "sql", label: "SQL" }, { value: "xml", label: "XML" }]} /><label><span>{t("features:formatter.indent")}</span><select value={indent} onChange={(event) => setIndent(Number(event.target.value))}><option value={2}>{t("features:formatter.spaces", { count: 2 })}</option><option value={4}>{t("features:formatter.spaces", { count: 4 })}</option></select></label></div></SectionCard>
    <div className="utility-editor-grid">
      <SectionCard title={t("features:formatter.input")} description={t("common:format.characters", { count: input.length })}><textarea className="utility-textarea code-textarea" spellCheck={false} value={input} onChange={(event) => setInput(event.target.value)} placeholder={kind === "json" ? '{"name":"Worklazy"}' : kind === "sql" ? "select * from tools where enabled = true" : '<tools><tool id="1" /></tools>'} /><div className="utility-inline-actions utility-inline-actions-spacer" aria-hidden="true" /></SectionCard>
      <SectionCard title={t("features:formatter.result")} description={error ? t("features:formatter.syntaxError") : t("common:format.characters", { count: output.length })}><textarea className={`utility-textarea code-textarea${error ? " has-error" : ""}`} readOnly value={error || output} placeholder={t("features:formatter.resultPlaceholder")} /><div className="utility-inline-actions"><button type="button" className="secondary-button" disabled={!output || Boolean(error)} onClick={() => void navigator.clipboard.writeText(output)}><Copy size={16} /> {t("common:actions.copy")}</button></div></SectionCard>
    </div>
    <div className="formatter-actions"><PrimaryButton accent="violet" loading={busy} disabled={!input} onClick={() => execute("pretty")}><WandSparkles size={18} /> {t("features:formatter.pretty")}</PrimaryButton><button className="secondary-button" type="button" disabled={!input || busy} onClick={() => execute("minify")}><Minimize2 size={17} /> {t("features:formatter.minify")}</button></div>
    <div className="format-capabilities"><span><Braces size={17} /> {t("features:formatter.jsonCheck")}</span><span><Database size={17} /> {t("features:formatter.sqlSort")}</span><span><CodeXml size={17} /> {t("features:formatter.xmlCheck")}</span></div>
    <ToolGuide title={t("features:formatter.guide.title")} description={t("features:formatter.guide.description")} blocks={(t("features:formatter.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))} faq={(t("features:formatter.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))} />
  </div>;
}
