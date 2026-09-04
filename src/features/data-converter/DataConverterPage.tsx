import { ArrowRightLeft, Copy, Download, FileJson, Table2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader, PrimaryButton } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { ToolGuide } from "../../components/ToolGuide";
import {
  pairedEditorClassName,
  UtilityField,
  UtilityInput,
  UtilityPage,
  UtilitySectionCard,
  UtilitySelect,
  UtilityTextarea,
} from "../../components/UtilitySurface";

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

  return <UtilityPage toolId="data-converter">
    <PageHeader eyebrow="DATA CONVERTER" title={t("features:converter.title")} description={t("features:converter.description")} />
    <UtilitySectionCard title={t("features:converter.formats")}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3 max-[620px]:grid-cols-1" data-testid="converter-route"><FormatSelect label={t("features:converter.source")} value={source} onChange={(value) => { setSource(value); if (value === target) setTarget(value === "csv" ? "json" : "csv"); }} htmlLabel={t("features:converter.html")} /><ArrowRightLeft className="max-[620px]:mx-auto max-[620px]:rotate-90" size={22} /><FormatSelect label={t("features:converter.target")} value={target} onChange={setTarget} htmlLabel={t("features:converter.html")} /></div>
      <UtilityField className="mt-3"><span>{t("features:converter.loadFile")}</span><UtilityInput className="h-auto bg-muted p-2 file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-secondary-foreground" type="file" accept=".csv,.json,.html,.htm,text/csv,application/json,text/html" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); }} /></UtilityField>
      {source === "csv" && <UtilityField className="mt-3"><span>{t("features:converter.encoding")}</span><UtilitySelect value={encoding} onChange={(event) => setEncoding(event.target.value as TextEncoding)}><option value="auto">{t("features:converter.encodingAuto")}</option><option value="utf-8">UTF-8</option><option value="euc-kr">CP949 / EUC-KR</option></UtilitySelect></UtilityField>}
    </UtilitySectionCard>
    <div className="grid grid-cols-2 items-stretch gap-[15px] max-[620px]:grid-cols-1" data-testid="data-converter-editors">
      <UtilitySectionCard title={t("features:converter.input")} description={t("common:format.characters", { count: input.length })} className="flex min-w-0 flex-col"><UtilityTextarea className={`${pairedEditorClassName} font-mono text-sm [tab-size:2]`} data-testid="data-converter-input" aria-label={t("features:converter.input")} value={input} onChange={(event) => setInput(event.target.value)} placeholder={t("features:converter.placeholder")} /><div className="invisible mt-[11px] min-h-[40px]" aria-hidden="true" /></UtilitySectionCard>
      <UtilitySectionCard title={t("features:converter.result")} description={error || summary} className="flex min-w-0 flex-col"><UtilityTextarea className={`${pairedEditorClassName} font-mono text-sm [tab-size:2]`} data-testid="data-converter-output" aria-label={t("features:converter.result")} aria-invalid={Boolean(error)} readOnly value={error || output} /><div className="mt-[11px] flex min-h-[40px] flex-wrap items-center gap-2"><Button variant="secondary" size="lg" className="rounded-xl font-bold" type="button" disabled={!output || Boolean(error)} onClick={() => void navigator.clipboard.writeText(output)}><Copy size={16} /> {t("features:converter.copy")}</Button><Button variant="secondary" size="lg" className="rounded-xl font-bold" type="button" disabled={!output || Boolean(error)} onClick={download}><Download size={16} /> {t("features:converter.save")}</Button></div></UtilitySectionCard>
    </div>
    <div className="mt-[11px]"><PrimaryButton accent="green" disabled={!input || source === target} loading={busy} onClick={convert}><Table2 size={18} /> {t("features:converter.convert")}</PrimaryButton></div>
    <ToolGuide title={t("features:converter.guide.title")} description={t("features:converter.guide.description")} blocks={(t("features:converter.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))} faq={(t("features:converter.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))} />
  </UtilityPage>;
}

function FormatSelect({ label, value, onChange, htmlLabel }: { label: string; value: Kind; onChange: (value: Kind) => void; htmlLabel: string }) { return <UtilityField className="relative"><span>{label}</span><UtilitySelect className="appearance-none pr-10" value={value} onChange={(event) => onChange(event.target.value as Kind)}><option value="csv">CSV</option><option value="json">JSON</option><option value="html">{htmlLabel}</option></UtilitySelect>{value === "json" ? <FileJson className="pointer-events-none absolute right-[11px] bottom-[11px] text-green-700 dark:text-green-400" size={18} /> : <Table2 className="pointer-events-none absolute right-[11px] bottom-[11px] text-green-700 dark:text-green-400" size={18} />}</UtilityField>; }

function decodeText(buffer: ArrayBuffer, encoding: TextEncoding) {
  if (encoding !== "auto") return new TextDecoder(encoding, { fatal: true }).decode(buffer);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch { return new TextDecoder("euc-kr", { fatal: true }).decode(buffer); }
}
