import { Braces, CodeXml, Copy, Database, Minimize2, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SqlLanguage } from "sql-formatter";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { PageHeader, PrimaryButton, SegmentedControl } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { ToolGuide } from "../../components/ToolGuide";
import {
  pairedEditorClassName,
  UtilityField,
  UtilityNotice,
  UtilityPage,
  UtilitySectionCard,
  UtilitySelect,
  UtilityTextarea,
} from "../../components/UtilitySurface";

type FormatKind = "json" | "sql" | "xml";

export function TextFormatterPage() {
  const { t, i18n } = useTranslation(["features", "common"]);
  const [kind, setKind] = useState<FormatKind>("json");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [indent, setIndent] = useState(2);
  const [dialect, setDialect] = useState<SqlLanguage>("sql");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [initializationError, setInitializationError] = useState<unknown>();
  const workerRef = useRef<Worker | undefined>(undefined);
  useEffect(() => () => workerRef.current?.terminate(), []);

  const execute = (mode: "pretty" | "minify") => {
    workerRef.current?.terminate(); setBusy(true); setError(""); setWarning("");
    let worker: Worker;
    try {
      worker = new Worker(new URL("./text-formatter.worker.ts", import.meta.url), { type: "module" });
    } catch (reason) {
      setBusy(false);
      setInitializationError(reason);
      return;
    }
    workerRef.current = worker;
    worker.onmessage = (event) => {
      if (event.data.type === "result") { setOutput(event.data.result); setWarning(event.data.warning || ""); }
      else setError(event.data.message);
      setBusy(false); worker.terminate(); if (workerRef.current === worker) workerRef.current = undefined;
    };
    worker.onerror = worker.onmessageerror = () => { setBusy(false); setError(t("common:recovery.operationFailed")); worker.terminate(); if (workerRef.current === worker) workerRef.current = undefined; };
    try { worker.postMessage({ kind, mode, text: input, indent, dialect, language: i18n.language }); } catch (reason) {
      worker.terminate(); workerRef.current = undefined; setBusy(false); setInitializationError(reason);
    }
  };

  if (initializationError !== undefined) throw initializationError;

  return (
    <UtilityPage toolId="text-formatter">
      <PageHeader eyebrow="FORMATTER" title={t("features:formatter.title")} description={t("features:formatter.description")}><PrivacyBanner compact /></PageHeader>
      <UtilitySectionCard title={t("features:formatter.settings")}>
        <div className="flex items-end justify-between gap-3 max-[620px]:flex-col max-[620px]:items-stretch" data-testid="formatter-settings">
          <div className="w-full max-w-[500px] flex-1"><SegmentedControl value={kind} onChange={(value) => { setKind(value); setError(""); setWarning(""); }} label={t("features:formatter.formatLabel")} options={[{ value: "json", label: "JSON" }, { value: "sql", label: "SQL" }, { value: "xml", label: "XML" }]} /></div>
          {kind === "sql" && <UtilityField><span>{t("features:formatter.dialect")}</span><UtilitySelect value={dialect} onChange={(event) => setDialect(event.target.value as SqlLanguage)}><option value="sql">Standard SQL</option><option value="mysql">MySQL</option><option value="postgresql">PostgreSQL</option><option value="transactsql">SQL Server (T-SQL)</option><option value="sqlite">SQLite</option><option value="bigquery">BigQuery</option></UtilitySelect></UtilityField>}
          <UtilityField><span>{t("features:formatter.indent")}</span><UtilitySelect value={indent} onChange={(event) => setIndent(Number(event.target.value))}><option value={2}>{t("features:formatter.spaces", { count: 2 })}</option><option value={4}>{t("features:formatter.spaces", { count: 4 })}</option></UtilitySelect></UtilityField>
        </div>
      </UtilitySectionCard>
      {warning && <UtilityNotice className="mb-3.5"><span>{warning}</span></UtilityNotice>}
      <div className="grid grid-cols-2 items-stretch gap-[15px] max-[620px]:grid-cols-1" data-testid="formatter-editors">
        <UtilitySectionCard title={t("features:formatter.input")} description={t("common:format.characters", { count: input.length })} className="flex min-w-0 flex-col">
          <UtilityTextarea data-testid="formatter-input" className={`${pairedEditorClassName} font-mono text-sm [tab-size:2]`} aria-label={t("features:formatter.input")} spellCheck={false} value={input} onChange={(event) => setInput(event.target.value)} placeholder={kind === "json" ? '{"name":"Worklazy"}' : kind === "sql" ? "select * from tools where enabled = true" : '<tools><tool id="1" /></tools>'} />
          <div className="invisible mt-[11px] min-h-[38px]" aria-hidden="true" />
        </UtilitySectionCard>
        <UtilitySectionCard title={t("features:formatter.result")} description={error ? t("features:formatter.syntaxError") : t("common:format.characters", { count: output.length })} className="flex min-w-0 flex-col">
          <UtilityTextarea data-testid="formatter-output" className={`${pairedEditorClassName} font-mono text-sm [tab-size:2]`} aria-label={t("features:formatter.result")} aria-invalid={Boolean(error)} readOnly value={error || output} placeholder={t("features:formatter.resultPlaceholder")} />
          <div className="mt-[11px] flex min-h-[38px] flex-wrap items-center gap-2"><Button type="button" variant="secondary" size="lg" className="rounded-xl font-bold" disabled={!output || Boolean(error)} onClick={() => void navigator.clipboard.writeText(output)}><Copy size={16} /> {t("common:actions.copy")}</Button></div>
        </UtilitySectionCard>
      </div>
      <div className="mt-[11px] flex flex-wrap items-center gap-2" data-testid="formatter-actions"><PrimaryButton accent="violet" loading={busy} disabled={!input} onClick={() => execute("pretty")}><WandSparkles size={18} /> {t("features:formatter.pretty")}</PrimaryButton><Button variant="secondary" size="lg" className="rounded-xl font-bold" type="button" disabled={!input || busy} onClick={() => execute("minify")}><Minimize2 size={17} /> {t("features:formatter.minify")}</Button></div>
      <div className="my-3.5 flex flex-wrap items-center gap-2" aria-label={t("features:formatter.settings")}><span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-2 text-[13px] font-bold text-muted-foreground"><Braces size={17} /> {t("features:formatter.jsonCheck")}</span><span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-2 text-[13px] font-bold text-muted-foreground"><Database size={17} /> {t("features:formatter.sqlSort")}</span><span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-2 text-[13px] font-bold text-muted-foreground"><CodeXml size={17} /> {t("features:formatter.xmlCheck")}</span></div>
      <ToolGuide title={t("features:formatter.guide.title")} description={t("features:formatter.guide.description")} blocks={(t("features:formatter.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))} faq={(t("features:formatter.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))} />
    </UtilityPage>
  );
}
