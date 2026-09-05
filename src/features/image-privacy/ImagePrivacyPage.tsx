import { AlertTriangle, Camera, Download, MapPin, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { FileShareButton } from "../../components/FileShareButton";
import { FileDropZone, PageHeader, PrimaryButton } from "../../components/ui";
import { buttonVariants } from "../../components/ui/button";
import { ToolGuide } from "../../components/ToolGuide";
import { UtilityNotice, UtilityPage, UtilitySectionCard } from "../../components/UtilitySurface";

interface PrivacyMetadata { make: string; model: string; software: string; dateTime: string; latitude: string; longitude: string; orientation: string; foundCount: number }
interface PrivacyResult { url: string; fileName: string; mimeType: string; metadata: PrivacyMetadata; items: Array<{ sourceName: string; metadata: PrivacyMetadata }> }

export function ImagePrivacyPage() {
  const { t, i18n } = useTranslation("features");
  const [files, setFiles] = useState<File[]>([]); const [result, setResult] = useState<PrivacyResult>(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const workerRef = useRef<Worker | undefined>(undefined);
  useEffect(() => () => { workerRef.current?.terminate(); if (result) URL.revokeObjectURL(result.url); }, [result]);
  const selectFiles = (next: File[]) => { setFiles(next.filter((file) => /image\/(?:jpeg|png|webp)/.test(file.type) || /\.(?:jpe?g|png|webp)$/i.test(file.name))); setError(""); if (result) { URL.revokeObjectURL(result.url); setResult(undefined); } };
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
  return <UtilityPage toolId="image-privacy">
    <PageHeader eyebrow="IMAGE PRIVACY" title={t("imagePrivacy.title")} description={t("imagePrivacy.description")}><PrivacyBanner compact /></PageHeader>
    <UtilitySectionCard title={t("imagePrivacy.select")} description={t("imagePrivacy.selectHelp")}><FileDropZone files={files} onFiles={selectFiles} accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple hint={t("imagePrivacy.hint")} accent="sky" /><div className="mt-3"><UtilityNotice><AlertTriangle className="mt-0.5 shrink-0" size={16} /><span>{t("imagePrivacy.compatibility")}</span></UtilityNotice></div><div className="mt-4 flex justify-end max-[620px]:[&_[data-ui-component=primary-button]]:w-full"><PrimaryButton accent="sky" disabled={!files.length} loading={busy} onClick={() => void execute()}><ShieldCheck size={18} /> {t("imagePrivacy.execute")}</PrimaryButton></div></UtilitySectionCard>
    {error && <UtilityNotice className="mb-3.5" tone="error" role="alert">{error}</UtilityNotice>}
    {result && <UtilitySectionCard
      title={t("imagePrivacy.result")}
      description={t("imagePrivacy.found", { count: result.items.reduce<number>((sum, item) => sum + item.metadata.foundCount, 0) })}
    >
      {result.items.length === 1
        ? <div className="grid grid-cols-3 gap-2.5 max-[620px]:grid-cols-1"><Meta icon={<MapPin />} label={t("imagePrivacy.gps")} value={result.metadata.latitude || result.metadata.longitude ? `${result.metadata.latitude}, ${result.metadata.longitude}` : t("imagePrivacy.noLocation")} /><Meta icon={<Smartphone />} label={t("imagePrivacy.device")} value={[result.metadata.make, result.metadata.model].filter(Boolean).join(" ") || t("imagePrivacy.noDevice")} /><Meta icon={<Camera />} label={t("imagePrivacy.date")} value={result.metadata.dateTime || t("imagePrivacy.noDate")} /></div>
        : <div className="my-2.5 grid gap-2">{result.items.map((item) => <div className="flex justify-between gap-3 rounded-xl border border-border bg-muted p-3" key={item.sourceName}><strong className="overflow-hidden text-ellipsis whitespace-nowrap">{item.sourceName}</strong><span className="shrink-0 text-muted-foreground">{t("imagePrivacy.fileFound", { count: item.metadata.foundCount })}</span></div>)}</div>}
      <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-green-500/10 p-3 text-green-700 dark:text-green-300" data-testid="image-privacy-result"><ShieldCheck className="shrink-0" size={22} /><div><strong className="text-sm text-foreground">{t("imagePrivacy.cleanTitle")}</strong><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("imagePrivacy.cleanDescription")}</p></div></div>
      <div className="mt-3 flex flex-wrap items-stretch gap-2"><a className={buttonVariants({ size: "lg", className: "h-10 flex-1 basis-[260px] rounded-xl bg-blue-700 font-bold text-white hover:bg-blue-800" })} href={result.url} download={result.fileName}><Download size={17} /> {result.items.length > 1 ? t("imagePrivacy.downloadZip") : t("imagePrivacy.download")}</a>{result.items.length === 1 && <FileShareButton shadcn className="rounded-xl font-bold" url={result.url} fileName={result.fileName} mimeType={result.mimeType} />}</div>
    </UtilitySectionCard>}
    <ToolGuide title={t("imagePrivacy.guide.title")} description={t("imagePrivacy.guide.description")} blocks={(t("imagePrivacy.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))} faq={(t("imagePrivacy.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))} />
  </UtilityPage>;
}
function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article className="min-w-0 rounded-xl bg-muted p-3.5 text-pink-600 dark:text-pink-300">{icon}<span className="mt-2.5 block text-xs text-muted-foreground">{label}</span><strong className="mt-1 block [overflow-wrap:anywhere] text-sm text-foreground">{value}</strong></article>; }
