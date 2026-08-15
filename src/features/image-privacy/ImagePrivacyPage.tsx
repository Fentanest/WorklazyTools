import { AlertTriangle, Camera, Download, MapPin, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { FileShareButton } from "../../components/FileShareButton";
import { FileDropZone, PageHeader, PrimaryButton, SectionCard } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";

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
      worker.onerror = (event) => { setBusy(false); setError(event.message); worker.terminate(); if (workerRef.current === worker) workerRef.current = undefined; };
      worker.postMessage({ files: inputs, language: i18n.language }, inputs.map((input) => input.buffer));
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof Error ? reason.message : t("imagePrivacy.readError", { defaultValue: "사진 파일을 읽지 못했습니다." }));
    }
  };
  return <div className="page tool-page page-enter utility-page image-privacy-page">
    <PageHeader eyebrow="IMAGE PRIVACY" title={t("imagePrivacy.title")} description={t("imagePrivacy.description")}><PrivacyBanner compact /></PageHeader>
    <SectionCard title={t("imagePrivacy.select")} description={t("imagePrivacy.selectHelp")}><FileDropZone files={files} onFiles={selectFiles} accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple hint={t("imagePrivacy.hint")} accent="sky" /><div className="inline-notice warning"><AlertTriangle size={16} /><span>{t("imagePrivacy.compatibility")}</span></div><div className="section-actions"><PrimaryButton accent="sky" disabled={!files.length} loading={busy} onClick={() => void execute()}><ShieldCheck size={18} /> {t("imagePrivacy.execute")}</PrimaryButton></div></SectionCard>
    {error && <p className="utility-error">{error}</p>}
    {result && <SectionCard
      title={t("imagePrivacy.result")}
      description={t("imagePrivacy.found", { count: result.items.reduce<number>((sum, item) => sum + item.metadata.foundCount, 0) })}
    >
      {result.items.length === 1
        ? <div className="metadata-grid"><Meta icon={<MapPin />} label={t("imagePrivacy.gps")} value={result.metadata.latitude || result.metadata.longitude ? `${result.metadata.latitude}, ${result.metadata.longitude}` : t("imagePrivacy.noLocation")} /><Meta icon={<Smartphone />} label={t("imagePrivacy.device")} value={[result.metadata.make, result.metadata.model].filter(Boolean).join(" ") || t("imagePrivacy.noDevice")} /><Meta icon={<Camera />} label={t("imagePrivacy.date")} value={result.metadata.dateTime || t("imagePrivacy.noDate")} /></div>
        : <div className="privacy-batch-summary">{result.items.map((item) => <div key={item.sourceName}><strong>{item.sourceName}</strong><span>{t("imagePrivacy.fileFound", { count: item.metadata.foundCount })}</span></div>)}</div>}
      <div className="clean-result"><ShieldCheck size={22} /><div><strong>{t("imagePrivacy.cleanTitle")}</strong><p>{t("imagePrivacy.cleanDescription")}</p></div></div>
      <div className="result-file-actions"><a className="result-download blue-download" href={result.url} download={result.fileName}><Download size={17} /> {result.items.length > 1 ? t("imagePrivacy.downloadZip") : t("imagePrivacy.download")}</a>{result.items.length === 1 && <FileShareButton url={result.url} fileName={result.fileName} mimeType={result.mimeType} />}</div>
    </SectionCard>}
    <ToolGuide title={t("imagePrivacy.guide.title")} description={t("imagePrivacy.guide.description")} blocks={(t("imagePrivacy.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))} faq={(t("imagePrivacy.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))} />
  </div>;
}
function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article>{icon}<span>{label}</span><strong>{value}</strong></article>; }
