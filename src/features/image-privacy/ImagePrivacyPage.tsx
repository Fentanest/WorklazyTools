import { acceptsFile } from "../../app/fileAccepts";
import { useHandoffReceiver } from "../../app/useHandoffReceiver";
import { setUnsavedWork, useUnsavedWorkGuard } from "../../app/toolState";
import { AlertTriangle, Camera, Download, MapPin, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { FileShareButton } from "../../components/FileShareButton";
import { FileDropZone, PageHeader, PrimaryButton } from "../../components/ui";
import { Button, buttonVariants } from "../../components/ui/button";
import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";
import { UtilityNotice, UtilityPage, UtilitySectionCard } from "../../components/UtilitySurface";

interface PrivacyMetadata { make: string; model: string; software: string; dateTime: string; latitude: string; longitude: string; orientation: string; foundCount: number }
interface PrivacyResult { url: string; fileName: string; mimeType: string; metadata: PrivacyMetadata; items: Array<{ sourceName: string; metadata: PrivacyMetadata }> }

export function ImagePrivacyPage() {
  const { t: ht } = useTranslation("common");
  const intakeRoot = useRef<HTMLDivElement>(null);
  const intakeGeneration = useRef(0);
  const intakeMount = useRef(0);
  useEffect(() => { const mount = ++intakeMount.current; return () => { queueMicrotask(() => { if (mount === intakeMount.current) intakeGeneration.current++; }); }; }, []);
  const { t, i18n } = useTranslation("features");
  const [files, setFiles] = useState<File[]>([]); const [result, setResult] = useState<PrivacyResult>(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const workerRef = useRef<Worker | undefined>(undefined);
  useEffect(() => () => { workerRef.current?.terminate(); if (result) URL.revokeObjectURL(result.url); }, [result]);
  const selectFiles = (next: File[], received = false) => { setFiles(next.filter(file => acceptsFile("image-privacy", file)).slice(0, 50)); setError(""); if (!received && next.some(file => acceptsFile("image-privacy", file))) handoff.dismiss(); if (result) { URL.revokeObjectURL(result.url); setResult(undefined); } };
  useUnsavedWorkGuard("image-privacy", files.length > 0 || !!result, { kind: "files", scopePath: "/tools/image-privacy" });
  const handoff = useHandoffReceiver("image-privacy", { kind: "selection", receive: entry => {
    const accepted = entry.files.filter(file => acceptsFile("image-privacy", file)).slice(0, 50);
    selectFiles(accepted, true);
    if (accepted.length) setUnsavedWork("image-privacy", { hasWork: true, kind: "files", scopePath: "/tools/image-privacy" });
    return { status: accepted.length === entry.files.length ? "accepted" : accepted.length ? "partial" : "rejected", accepted, rejected: entry.files.filter(file => !accepted.includes(file)).map(file => ({ file, reasonCode: "format" })) };
  } });
  const execute = async () => {
    if (!files.length) return;
    workerRef.current?.terminate(); setBusy(true); setError("");
    try {
      const inputs = await Promise.all(files.map(async (file) => ({ name: file.name, type: file.type, buffer: await file.arrayBuffer() })));
      const worker = new Worker(new URL("./image-privacy.worker.ts", import.meta.url), { type: "module" }); workerRef.current = worker;
      worker.onmessage = (event) => { setBusy(false); if (event.data.type === "error") setError(event.data.message); else { if (result) URL.revokeObjectURL(result.url); setResult({ ...event.data, url: URL.createObjectURL(new Blob([event.data.buffer], { type: event.data.mimeType })) }); } worker.terminate(); if (workerRef.current === worker) workerRef.current = undefined; };
      worker.onerror = () => { setBusy(false); setError(t("imagePrivacy.readError")); worker.terminate(); if (workerRef.current === worker) workerRef.current = undefined; };
      worker.postMessage({ files: inputs, language: i18n.language }, inputs.map((input) => input.buffer));
    } catch {
      setBusy(false);
      setError(t("imagePrivacy.readError"));
    }
  };
  return <UtilityPage toolId="image-privacy"><div ref={intakeRoot} className="contents">
      {(handoff.notReceived || (handoff.result && handoff.recoveryFiles.length > 0)) && <UtilityNotice kind="warning" role="status" className="mb-4 flex-col items-start gap-2" data-handoff-recovery>
        <p>{ht(handoff.recoveryFiles.length ? "handoff.partial" : "handoff.notReceived", { count: handoff.recoveryFiles.length })}</p>
        <ul className="max-w-full break-all">{handoff.recoveryFiles.map((file, index) => <li key={index}>{file.name}</li>)}</ul>
        <div className="flex flex-wrap gap-2">
          {!!handoff.recoveryFiles.length && <Button type="button" variant="outline" onClick={() => {
            for (const file of handoff.recoveryFiles) { const url = URL.createObjectURL(file); const a = document.createElement("a"); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
            setTimeout(() => handoff.dismiss(), 0);
          }}>{ht("handoff.downloadReceived")}</Button>}
          <Button type="button" variant="outline" disabled={busy} onClick={() => intakeRoot.current?.querySelector<HTMLInputElement>('input[type="file"]')?.click()}>{ht("handoff.selectAgain")}</Button>
          <Button type="button" variant="ghost" onClick={() => handoff.dismiss()}>{ht("handoff.close")}</Button>
        </div>
      </UtilityNotice>}

    <PageHeader eyebrow="IMAGE PRIVACY" title={t("imagePrivacy.title")} description={t("imagePrivacy.description")}><PrivacyBanner compact /></PageHeader>
    <UtilitySectionCard title={t("imagePrivacy.select")} description={t("imagePrivacy.selectHelp")}><FileDropZone disabled={busy} files={files} onFiles={next => selectFiles(next)} accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple hint={t("imagePrivacy.hint")} accent="sky" /><div className="mt-3"><UtilityNotice>{t("imagePrivacy.compatibility")}</UtilityNotice></div><div className="mt-4 flex justify-end max-[620px]:[&_[data-ui-component=primary-button]]:w-full"><PrimaryButton accent="sky" disabled={!files.length} loading={busy} onClick={() => void execute()}><ShieldCheck size={18} /> {t("imagePrivacy.execute")}</PrimaryButton></div></UtilitySectionCard>
    {error && <UtilityNotice className="mb-3.5" kind="error" role="alert">{error}</UtilityNotice>}
    {result && <UtilitySectionCard
      title={t("imagePrivacy.result")}
      description={t("imagePrivacy.found", { count: result.items.reduce<number>((sum, item) => sum + item.metadata.foundCount, 0) })}
    >
      {result.items.length === 1
        ? <div className="grid grid-cols-3 gap-2.5 max-[620px]:grid-cols-1"><Meta icon={<MapPin />} label={t("imagePrivacy.gps")} value={result.metadata.latitude || result.metadata.longitude ? `${result.metadata.latitude}, ${result.metadata.longitude}` : t("imagePrivacy.noLocation")} /><Meta icon={<Smartphone />} label={t("imagePrivacy.device")} value={[result.metadata.make, result.metadata.model].filter(Boolean).join(" ") || t("imagePrivacy.noDevice")} /><Meta icon={<Camera />} label={t("imagePrivacy.date")} value={result.metadata.dateTime || t("imagePrivacy.noDate")} /></div>
        : <div className="my-2.5 grid gap-2">{result.items.map((item) => <div className="flex justify-between gap-3 rounded-xl border border-border bg-muted p-3" key={item.sourceName}><strong className="overflow-hidden text-ellipsis whitespace-nowrap">{item.sourceName}</strong><span className="shrink-0 text-muted-foreground">{t("imagePrivacy.fileFound", { count: item.metadata.foundCount })}</span></div>)}</div>}
      <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-green-500/10 p-3 text-green-700 dark:text-green-300" data-testid="image-privacy-result"><ShieldCheck className="shrink-0" size={22} /><div><strong className="text-sm text-foreground">{t("imagePrivacy.cleanTitle")}</strong><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("imagePrivacy.cleanDescription")} <a href="#tool-guide-title" className="inline-block text-sm font-medium text-[var(--brand,theme(colors.blue.600))] hover:underline dark:text-[var(--brand,theme(colors.blue.400))]">처음 사용하시나요? 사용 안내 보기 &darr;</a></p></div></div>
      <div className="mt-3 flex flex-wrap items-stretch gap-2"><a className={buttonVariants({ size: "lg", className: "h-10 flex-1 basis-[260px] rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90" })} href={result.url} download={result.fileName}><Download size={17} /> {result.items.length > 1 ? t("imagePrivacy.downloadZip") : t("imagePrivacy.download")}</a>{result.items.length === 1 && <FileShareButton shadcn className="rounded-xl font-bold" url={result.url} fileName={result.fileName} mimeType={result.mimeType} />}</div>
    </UtilitySectionCard>}
    <ToolGuideWrapper slug="imagePrivacy" />
  </div></UtilityPage>;
}
function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article className="min-w-0 rounded-xl bg-muted p-3.5 text-primary">{icon}<span className="mt-2.5 block text-xs text-muted-foreground">{label}</span><strong className="mt-1 block [overflow-wrap:anywhere] text-sm text-foreground">{value}</strong></article>; }
