import { AlertTriangle, Camera, Download, MapPin, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { FileShareButton } from "../../components/FileShareButton";
import { FileDropZone, PageHeader, PrimaryButton, SectionCard } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";

interface PrivacyResult { url: string; fileName: string; mimeType: string; metadata: { make: string; model: string; software: string; dateTime: string; latitude: string; longitude: string; orientation: string; foundCount: number } }

export function ImagePrivacyPage() {
  const [files, setFiles] = useState<File[]>([]); const [result, setResult] = useState<PrivacyResult>(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const workerRef = useRef<Worker | undefined>(undefined);
  useEffect(() => () => { workerRef.current?.terminate(); if (result) URL.revokeObjectURL(result.url); }, [result]);
  const selectFiles = (next: File[]) => { setFiles(next.filter((file) => /image\/(?:jpeg|png)/.test(file.type)).slice(-1)); setError(""); if (result) { URL.revokeObjectURL(result.url); setResult(undefined); } };
  const execute = async () => {
    const file = files[0]; if (!file) return;
    workerRef.current?.terminate(); setBusy(true); setError("");
    const worker = new Worker(new URL("./image-privacy.worker.ts", import.meta.url), { type: "module" }); workerRef.current = worker;
    worker.onmessage = (event) => { setBusy(false); if (event.data.type === "error") setError(event.data.message); else { if (result) URL.revokeObjectURL(result.url); setResult({ ...event.data, url: URL.createObjectURL(new Blob([event.data.buffer], { type: event.data.mimeType })) }); } worker.terminate(); if (workerRef.current === worker) workerRef.current = undefined; };
    worker.onerror = (event) => { setBusy(false); setError(event.message); worker.terminate(); if (workerRef.current === worker) workerRef.current = undefined; };
    const buffer = await file.arrayBuffer(); worker.postMessage({ name: file.name, type: file.type, buffer }, [buffer]);
  };
  return <div className="page tool-page page-enter utility-page image-privacy-page">
    <PageHeader eyebrow="IMAGE PRIVACY" title="사진 EXIF 개인정보 제거" description="GPS 위치·촬영 기기·촬영 시각을 확인하고 픽셀만 다시 그린 깨끗한 사본을 내려받으세요."><PrivacyBanner compact /></PageHeader>
    <SectionCard title="사진 선택" description="JPG 또는 PNG 한 장을 선택하세요."><FileDropZone files={files} onFiles={selectFiles} accept=".jpg,.jpeg,.png,image/jpeg,image/png" hint="GPS·기기 정보가 걱정되는 JPG·PNG" accent="sky" /><div className="inline-notice warning"><AlertTriangle size={16} /><span>HEIC·HEIF는 현재 지원하지 않습니다. 또한 OffscreenCanvas가 없는 iOS 16.3 이하에서는 메타데이터 제거를 사용할 수 없습니다. iOS 16.4 이상 또는 최신 Android 브라우저를 사용해 주세요.</span></div><div className="section-actions"><PrimaryButton accent="sky" disabled={!files.length} loading={busy} onClick={() => void execute()}><ShieldCheck size={18} /> 메타데이터 확인·제거</PrimaryButton></div></SectionCard>
    {error && <p className="utility-error">{error}</p>}
    {result && <SectionCard title="확인 결과" description={`${result.metadata.foundCount}개 메타데이터 태그 감지`}><div className="metadata-grid"><Meta icon={<MapPin />} label="GPS" value={result.metadata.latitude || result.metadata.longitude ? `${result.metadata.latitude}, ${result.metadata.longitude}` : "위치 정보 없음"} /><Meta icon={<Smartphone />} label="촬영 기기" value={[result.metadata.make, result.metadata.model].filter(Boolean).join(" ") || "기기 정보 없음"} /><Meta icon={<Camera />} label="촬영 시각" value={result.metadata.dateTime || "촬영 시각 없음"} /></div><div className="clean-result"><ShieldCheck size={22} /><div><strong>새 파일은 픽셀 데이터만 다시 인코딩했습니다.</strong><p>원본 파일은 변경되지 않습니다. 다운로드한 사본의 EXIF·GPS·기기 태그를 제거했습니다.</p></div></div><div className="result-file-actions"><a className="result-download blue-download" href={result.url} download={result.fileName}><Download size={17} /> 정리된 사진 다운로드</a><FileShareButton url={result.url} fileName={result.fileName} mimeType={result.mimeType} /></div></SectionCard>}
    <ToolGuide title="사진 공유 전 개인정보 점검" description="원본과 결과는 현재 브라우저와 전용 Worker에서만 처리됩니다." blocks={[{ title: "제거 방식", paragraphs: ["원본 컨테이너를 복사하지 않고 이미지 픽셀을 OffscreenCanvas에 렌더링한 뒤 새 JPG 또는 PNG로 인코딩합니다."] }, { title: "화질", paragraphs: ["JPG는 재인코딩 과정에서 파일 크기와 화질이 소폭 달라질 수 있으며 PNG는 무손실로 다시 저장됩니다."] }]} faq={[{ question: "원본 사진도 수정되나요?", answer: "아니요. 메타데이터가 제거된 새 사본만 다운로드합니다." }, { question: "HEIC도 지원하나요?", answer: "아니요. 현재 JPG와 PNG만 지원하며 HEIC·HEIF는 지원하지 않습니다." }]} />
  </div>;
}
function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article>{icon}<span>{label}</span><strong>{value}</strong></article>; }
