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
    <PageHeader eyebrow="IMAGE PRIVACY" title="사진 속 숨은 정보(EXIF) 제거" description="사진 파일에 함께 저장될 수 있는 GPS 위치·촬영 기기·촬영 시각을 확인하고 제거하세요."><PrivacyBanner compact /></PageHeader>
    <SectionCard title="사진 선택" description="JPG 또는 PNG 한 장을 선택하세요."><FileDropZone files={files} onFiles={selectFiles} accept=".jpg,.jpeg,.png,image/jpeg,image/png" hint="GPS·기기 정보가 걱정되는 JPG·PNG" accent="sky" /><div className="inline-notice warning"><AlertTriangle size={16} /><span>HEIC·HEIF는 현재 지원하지 않습니다. 또한 브라우저의 고급 이미지 처리 기능(OffscreenCanvas)이 없는 iOS 16.3 이하에서는 숨은 정보 제거를 사용할 수 없습니다. iOS 16.4 이상 또는 최신 Android 브라우저를 사용해 주세요.</span></div><div className="section-actions"><PrimaryButton accent="sky" disabled={!files.length} loading={busy} onClick={() => void execute()}><ShieldCheck size={18} /> 숨은 정보 확인·제거</PrimaryButton></div></SectionCard>
    {error && <p className="utility-error">{error}</p>}
    {result && <SectionCard title="확인 결과" description={`${result.metadata.foundCount}개 숨은 정보 항목 감지`}><div className="metadata-grid"><Meta icon={<MapPin />} label="GPS" value={result.metadata.latitude || result.metadata.longitude ? `${result.metadata.latitude}, ${result.metadata.longitude}` : "위치 정보 없음"} /><Meta icon={<Smartphone />} label="촬영 기기" value={[result.metadata.make, result.metadata.model].filter(Boolean).join(" ") || "기기 정보 없음"} /><Meta icon={<Camera />} label="촬영 시각" value={result.metadata.dateTime || "촬영 시각 없음"} /></div><div className="clean-result"><ShieldCheck size={22} /><div><strong>사진 내용(픽셀)만 새 파일로 저장했습니다.</strong><p>원본 파일은 변경되지 않습니다. 다운로드한 사본에서 EXIF·GPS·기기 정보를 제거했습니다.</p></div></div><div className="result-file-actions"><a className="result-download blue-download" href={result.url} download={result.fileName}><Download size={17} /> 정리된 사진 다운로드</a><FileShareButton url={result.url} fileName={result.fileName} mimeType={result.mimeType} /></div></SectionCard>}
    <ToolGuide title="사진 공유 전 개인정보 점검" description="원본과 결과는 현재 브라우저의 별도 작업 공간에서만 처리됩니다." blocks={[{ title: "EXIF란?", paragraphs: ["카메라나 휴대폰이 사진 파일에 함께 저장할 수 있는 촬영 기기·날짜·GPS 위치 같은 부가 정보입니다. 사진 화면에는 보이지 않아도 파일 안에는 남아 있을 수 있습니다."] }, { title: "제거 방식", paragraphs: ["원본 파일 구조를 복사하지 않고 사진 내용만 새 화면에 다시 그린 뒤 JPG 또는 PNG 새 파일로 저장합니다. 이 과정에서 EXIF 같은 부가 정보가 빠집니다."] }, { title: "화질", paragraphs: ["JPG는 다시 저장하는 과정에서 파일 크기와 화질이 소폭 달라질 수 있으며 PNG는 화질 손실 없이 다시 저장됩니다."] }]} faq={[{ question: "원본 사진도 수정되나요?", answer: "아니요. 숨은 정보가 제거된 새 사본만 다운로드합니다." }, { question: "메타데이터가 무엇인가요?", answer: "사진 내용 외에 파일에 덧붙는 정보입니다. 이 도구는 그중 촬영 정보 형식인 EXIF와 GPS·기기·촬영 시각 항목을 확인합니다." }, { question: "HEIC도 지원하나요?", answer: "아니요. 현재 JPG와 PNG만 지원하며 HEIC·HEIF는 지원하지 않습니다." }]} />
  </div>;
}
function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article>{icon}<span>{label}</span><strong>{value}</strong></article>; }
