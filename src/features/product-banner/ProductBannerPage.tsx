import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUnsavedWorkGuard } from "../../app/toolState";
import { PageHeader, SectionCard } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { UtilityPage, UtilitySelect, UtilityTextarea } from "../../components/UtilitySurface";
import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";
import runtime from "virtual:product-banner-runtime";
import heightParent from "virtual:product-banner-height-parent";
import { BANNER_SANDBOX, exportBanner, exportHelp } from "./exporter";
import { inputErrorMessages } from "./inputErrorMessages";
import type { InputErrorCode } from "./inputTypes";
import { ImportSelection } from "./ImportSelection";
import { loadProjectJson, saveProjectJson } from "./projectJson";
import { createEditorState, hasBannerWork, reduceEditorState, type EditorAction } from "./state";
import { PROJECT_LIMITS } from "./stateTypes";
import { uiMessages } from "./uiMessages";
import { ProductReview } from "./ProductReview";
import { BannerAppearance } from "./BannerAppearance";
import { samplePreview } from "./samplePreview";
import { createDefaultSettings, updateSettings } from "./settings";

export function ProductBannerPage() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith("en") ? "en" : "ko", text = uiMessages[language];
  const help = exportHelp[language];
  const [state, setState] = useState(() => createEditorState(language));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false), [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [format, setFormat] = useState<"html" | "iframe">("html");
  const [showSample, setShowSample] = useState(false);
  const [sampleSettings, setSampleSettings] = useState(() => createDefaultSettings(language));
  const editorRef = useRef(state); editorRef.current = state;
  const jsonInput = useRef<HTMLInputElement>(null);
  useUnsavedWorkGuard("product-banner", hasBannerWork(state) || busy || pending, { kind: "edits", scopePath: "/tools/product-banner" });
  const dispatch = (action: EditorAction) => {
    try { const next = reduceEditorState(editorRef.current, action); editorRef.current = next; setState(next); setMessage(""); return true; }
    catch { setMessage(text.limitError); return false; }
  };
  const output = useMemo(() => {
    try { return { value: exportBanner(state.project, { banner: runtime, heightParent }), error: false }; }
    catch { return { value: null, error: true }; }
  }, [state.project]);
  const sample = useMemo(() => showSample ? samplePreview(sampleSettings, runtime) : null, [showSample, sampleSettings]);
  // Insert the chosen real export into a sandboxed host document, including the nested iframe/helper for iframe mode.
  const preview = output.value ? `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body>${output.value[format]}</body></html>` : "";
  const errorText = (code: InputErrorCode) => inputErrorMessages[language][code];
  async function importJson(file?: File) {
    if (!file || busy) return;
    if (hasBannerWork(state) && !window.confirm(text.confirm)) return;
    if (file.size > PROJECT_LIMITS.bytes) { setMessage(text.limitError); return; }
    try { dispatch({ type: "load", project: loadProjectJson(await file.text()), confirmDiscard: true }); }
    catch { setMessage(text.jsonError); }
  }
  async function copy(which: "html" | "iframe") {
    setFormat(which);
    if (!output.value || showSample) return;
    try { await navigator.clipboard.writeText(output.value[which]); setMessage(text.copied); }
    catch { setMessage(text.copyFailed); }
  }
  function save(content: string, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type })), anchor = document.createElement("a");
    anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); setMessage(text.saved);
  }
  return <UtilityPage toolId="product-banner">
    <PageHeader eyebrow={text.title} title={text.title} description={text.description} />
    <p className="mb-5 max-w-3xl text-sm text-muted-foreground">{text.privacy}</p>
    <div role="status" aria-live="polite" className="mb-4">{message === text.copyFailed ? "" : message}</div>
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <div className="min-w-0 space-y-5">
        <SectionCard step={1} title={text.import}>
          <UtilitySelect aria-label={text.import} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="append">{text.add}</option><option value="replace">{text.replace}</option></UtilitySelect>
          <ImportSelection text={text} errorText={errorText} onBusy={setBusy} onPending={setPending} onImport={(products) => {
            if (mode === "replace" && hasBannerWork(state) && !window.confirm(text.confirm)) return false;
            return dispatch({ type: mode, products, importedAt: new Date().toISOString(), confirmDiscard: true });
          }} />
        </SectionCard>
        <SectionCard step={2} title={text.products}>{!state.project.products.length && <p className="mb-4 text-muted-foreground">{text.empty}</p>}<ProductReview state={state} dispatch={dispatch} text={text} /></SectionCard>
        <SectionCard step={3} title={text.settings}><BannerAppearance settings={showSample ? sampleSettings : state.project.settings} update={(patch) => showSample ? setSampleSettings((previous) => updateSettings(previous, patch)) : dispatch({ type: "settings", patch })} text={text} /></SectionCard>
      </div>
      <div className="min-w-0 space-y-5 xl:sticky xl:top-24">
        <SectionCard title={text.preview}>
          <div className="mb-3 flex flex-wrap gap-2"><Button variant="secondary" aria-pressed={showSample} onClick={() => { if (!showSample) setSampleSettings(state.project.settings); setShowSample(true); }}>{text.sample}</Button><Button variant="secondary" aria-pressed={!showSample} onClick={() => setShowSample(false)}>{text.realData}</Button></div>
          <p className="mb-3 rounded-xl border border-border p-3 text-sm" data-testid="preview-data-label">{showSample ? text.sampleNotice : text.realNotice}</p>
          <p className="mb-3">{text.count}: {showSample ? 3 : state.project.products.filter((p) => p.included).length}</p>
          <UtilitySelect disabled={showSample} aria-label={text.preview} value={format} onChange={(e) => setFormat(e.target.value as typeof format)}><option value="html">{text.html}</option><option value="iframe">{text.iframe}</option></UtilitySelect>
          {/* Replace changed sandbox documents: srcdoc navigation would add joint history entries and obstruct the app's leave guard. */}
          {sample ? <div className="mt-4 overflow-auto"><iframe key={sample.document} title={text.sample} data-testid="sample-preview" sandbox={BANNER_SANDBOX} srcDoc={sample.document} style={{ width: sampleSettings.width, height: sample.height + 60, border: 0 }} /></div> : output.error ? <p role="alert" className="mt-4 text-destructive">{text.exportError}</p> : !state.project.products.length ? <p className="mt-4 text-muted-foreground">{text.empty}</p> : <div className="mt-4 overflow-auto"><iframe key={preview} title={text.preview} data-testid="banner-preview" sandbox={BANNER_SANDBOX} srcDoc={preview} style={{ width: state.project.settings.width, height: (output.value?.height ?? 420) + 60, border: 0 }} /></div>}
        </SectionCard>
        <SectionCard step={4} title={text.export}>
          {message === text.copyFailed && <p role="status" className="mb-3 text-sm">{text.copyFailed}</p>}
          {showSample && <p className="mb-3 text-sm text-muted-foreground">{text.sampleBlocked}</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={showSample || !output.value || !state.project.products.length} onClick={() => void copy("html")}>{text.copyHtml}</Button>
            <Button disabled={showSample || !output.value || !state.project.products.length} onClick={() => void copy("iframe")}>{text.copyIframe}</Button>
            <Button variant="secondary" disabled={showSample || !output.value || !state.project.products.length} onClick={() => output.value && save(output.value.standalone, "product-banner.html", "text/html")}>{text.saveHtml}</Button>
            <Button variant="secondary" disabled={showSample} onClick={() => { save(saveProjectJson(state.project), "product-banner.json", "application/json"); dispatch({ type: "mark-saved" }); setMessage(text.saved); }}>{text.saveJson}</Button>
            <Button variant="secondary" onClick={() => jsonInput.current?.click()}>{text.loadJson}</Button>
            <input ref={jsonInput} type="file" accept=".json" className="hidden" aria-label={text.loadJson} onChange={(e) => { void importJson(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          {!showSample && output.value && <div className="mt-4 space-y-3 text-sm text-muted-foreground"><p>{format === "html" ? help.direct : help.frame}</p>{state.project.settings.autoHeight && <p>{help.auto}</p>}<p>{help.images}</p><p>{output.value.bytes[format].toLocaleString(language)} bytes</p>{output.value.largeOutput && <p>{help.large}</p>}<UtilityTextarea aria-label={text.export} readOnly value={output.value[format]} className="h-40" onFocus={(e) => e.target.select()} /></div>}
        </SectionCard>
      </div>
    </div>
    <ToolGuideWrapper slug="productBanner" />
  </UtilityPage>;
}
