import { useState } from "react";
import { SectionCard } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { UtilityField, UtilityInput, UtilityTextarea } from "../../components/UtilitySurface";
import { BANNER_URL_PREVIEW_SANDBOX, bannerDimension, bannerUrlMessages, exportBannerUrl, parseBannerUrl } from "./bannerUrl";

export function BannerUrlPanel({ language }: { language: "ko" | "en" }) {
  const text = bannerUrlMessages[language];
  const [raw, setRaw] = useState("");
  const [width, setWidth] = useState(""), [height, setHeight] = useState("");
  const [disclosure, setDisclosure] = useState(true), [loaded, setLoaded] = useState(false), [message, setMessage] = useState("");
  const parsed = parseBannerUrl(raw), w = bannerDimension(width), h = bannerDimension(height);
  const output = parsed.ok && w && h ? exportBannerUrl(parsed.src, w, h, language, disclosure) : null;
  function changeUrl(value: string) {
    setRaw(value); setLoaded(false); setMessage("");
    const next = parseBannerUrl(value);
    setWidth(next.ok && next.size ? String(next.size.width) : "");
    setHeight(next.ok && next.size ? String(next.size.height) : "");
  }
  async function copy() {
    if (!output) return;
    try { await navigator.clipboard.writeText(output.code); setMessage(text.copied); }
    catch { setMessage(text.copyFailed); }
  }
  return <div className="mt-5 grid items-start gap-5 xl:grid-cols-2" data-testid="banner-url-panel">
    <div className="min-w-0 space-y-5">
      <SectionCard title={text.url}>
        <UtilityField>{text.input}<UtilityInput type="text" inputMode="url" autoComplete="off" spellCheck={false} value={raw} onChange={(e) => changeUrl(e.target.value)} aria-invalid={!!raw && !parsed.ok} aria-describedby="banner-url-feedback" /></UtilityField>
        <p id="banner-url-feedback" role="status" className="mt-3 text-sm text-muted-foreground">{!parsed.ok ? text[parsed.error] : !parsed.size ? text.size : ""}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <UtilityField>{text.width}<UtilityInput inputMode="numeric" value={width} onChange={(e) => { setWidth(e.target.value); setMessage(""); }} aria-invalid={!!width && !w} /></UtilityField>
          <UtilityField>{text.height}<UtilityInput inputMode="numeric" value={height} onChange={(e) => { setHeight(e.target.value); setMessage(""); }} aria-invalid={!!height && !h} /></UtilityField>
        </div>
        {parsed.ok && (!w || !h) && <p role="status" className="mt-3 text-sm">{text.sizeRange}</p>}
        <p className="mt-3 text-sm text-muted-foreground">{text.viewport}</p>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={disclosure} onChange={(e) => { setDisclosure(e.target.checked); setMessage(""); }} />{text.notice}</label>
        <p className="mt-3 text-sm text-muted-foreground">{text.session}</p>
      </SectionCard>
      {output && <SectionCard title={text.export}>
        <Button onClick={() => void copy()}>{text.copy}</Button>
        <p role="status" className="mt-3 text-sm">{message}</p>
        <p className="my-3 text-sm text-muted-foreground">{output.bytes.toLocaleString(language)} bytes</p>
        <UtilityTextarea aria-label={text.export} readOnly value={output.code} className="h-40" onFocus={(e) => e.target.select()} />
      </SectionCard>}
    </div>
    <SectionCard title={text.preview}>
      <p className="mb-4 text-sm text-muted-foreground">{text.previewHelp}</p>
      {output && parsed.ok ? <>
        <Button variant="secondary" onClick={() => setLoaded((previous) => !previous)}>{loaded ? text.unload : text.load}</Button>
        <div className="mt-4 max-h-[70vh] overflow-auto">
          {loaded ? <iframe data-testid="banner-url-preview" src={parsed.src} width={w!} height={h!} title={text.title} sandbox={BANNER_URL_PREVIEW_SANDBOX} referrerPolicy="strict-origin-when-cross-origin" scrolling="no" style={{ border: 0 }} />
            : <div data-testid="banner-url-placeholder" className="grid place-items-center border border-dashed border-border bg-muted p-4 text-center text-sm text-muted-foreground" style={{ width: w!, height: h! }}>{text.placeholder}</div>}
        </div>
      </> : <p className="text-sm text-muted-foreground">{parsed.ok ? text.sizeRange : text[parsed.error]}</p>}
    </SectionCard>
  </div>;
}
