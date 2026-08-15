import { ArrowRightLeft, Copy, Download, FileJson, Table2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader, PrimaryButton, SectionCard } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";

type Kind = "csv" | "json" | "html";
type TextEncoding = "auto" | "utf-8" | "euc-kr";

export function DataConverterPage() {
  const { t, i18n } = useTranslation(["features", "common"]);
  const [source, setSource] = useState<Kind>("csv");
  const [target, setTarget] = useState<Kind>("json");
  const [encoding, setEncoding] = useState<TextEncoding>("auto");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const workerRef = useRef<Worker | undefined>(undefined);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const convert = () => {
    workerRef.current?.terminate();
    setBusy(true);
    setError("");
    const worker = new Worker(new URL("./data-converter.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    const finish = () => { setBusy(false); worker.terminate(); if (workerRef.current === worker) workerRef.current = undefined; };
    worker.onmessage = (event) => {
      if (event.data.type === "error") setError(event.data.message);
      else {
        setOutput(event.data.result);
        const base = t("features:converter.summary", { rows: event.data.rows.toLocaleString(i18n.language), columns: event.data.columns.toLocaleString(i18n.language) });
        setSummary([base, ...(event.data.warnings || [])].join(" · "));
      }
      finish();
    };
    worker.onerror = (event) => { setError(event.message || t("features:converter.workerError")); finish(); };
    worker.postMessage({ source, target, text: input, language: i18n.language });
  };

  const loadFile = async (file: File) => {
    try { setInput(decodeText(await file.arrayBuffer(), encoding)); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("features:converter.readError")); }
  };

  const download = () => {
    const mime = target === "json" ? "application/json" : target === "html" ? "text/html" : "text/csv";
    const url = URL.createObjectURL(new Blob([target === "csv" ? `\uFEFF${output}` : output], { type: `${mime};charset=utf-8` }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `worklazy-table.${target}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
  };

  return <div className="page tool-page page-enter utility-page data-converter-page">
    <PageHeader eyebrow="DATA CONVERTER" title={t("features:converter.title")} description={t("features:converter.description")} />
    <SectionCard title={t("features:converter.formats")}>
      <div className="converter-route"><FormatSelect label={t("features:converter.source")} value={source} onChange={(value) => { setSource(value); if (value === target) setTarget(value === "csv" ? "json" : "csv"); }} htmlLabel={t("features:converter.html")} /><ArrowRightLeft size={22} /><FormatSelect label={t("features:converter.target")} value={target} onChange={setTarget} htmlLabel={t("features:converter.html")} /></div>
      <label className="file-control converter-file"><span>{t("features:converter.loadFile")}</span><input type="file" accept=".csv,.json,.html,.htm,text/csv,application/json,text/html" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); }} /></label>
      {source === "csv" && <label className="converter-encoding"><span>{t("features:converter.encoding")}</span><select value={encoding} onChange={(event) => setEncoding(event.target.value as TextEncoding)}><option value="auto">{t("features:converter.encodingAuto")}</option><option value="utf-8">UTF-8</option><option value="euc-kr">CP949 / EUC-KR</option></select></label>}
    </SectionCard>
    <div className="utility-editor-grid">
      <SectionCard title={t("features:converter.input")} description={t("common:format.characters", { count: input.length })}><textarea className="utility-textarea code-textarea" value={input} onChange={(event) => setInput(event.target.value)} placeholder={t("features:converter.placeholder")} /><div className="utility-inline-actions utility-inline-actions-spacer" aria-hidden="true" /></SectionCard>
      <SectionCard title={t("features:converter.result")} description={error || summary}><textarea className={`utility-textarea code-textarea${error ? " has-error" : ""}`} readOnly value={error || output} /><div className="utility-inline-actions"><button className="secondary-button" type="button" disabled={!output || Boolean(error)} onClick={() => void navigator.clipboard.writeText(output)}><Copy size={16} /> {t("features:converter.copy")}</button><button className="secondary-button" type="button" disabled={!output || Boolean(error)} onClick={download}><Download size={16} /> {t("features:converter.save")}</button></div></SectionCard>
    </div>
    <PrimaryButton accent="green" disabled={!input || source === target} loading={busy} onClick={convert}><Table2 size={18} /> {t("features:converter.convert")}</PrimaryButton>
    <ToolGuide title={t("features:converter.guide.title")} description={t("features:converter.guide.description")} blocks={(t("features:converter.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))} faq={(t("features:converter.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))} />
  </div>;
}

function FormatSelect({ label, value, onChange, htmlLabel }: { label: string; value: Kind; onChange: (value: Kind) => void; htmlLabel: string }) { return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as Kind)}><option value="csv">CSV</option><option value="json">JSON</option><option value="html">{htmlLabel}</option></select>{value === "json" ? <FileJson size={18} /> : <Table2 size={18} />}</label>; }

function decodeText(buffer: ArrayBuffer, encoding: TextEncoding) {
  if (encoding !== "auto") return new TextDecoder(encoding, { fatal: true }).decode(buffer);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch { return new TextDecoder("euc-kr", { fatal: true }).decode(buffer); }
}
