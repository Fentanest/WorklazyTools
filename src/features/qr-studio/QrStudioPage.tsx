import { AlertTriangle, Camera, CameraOff, Copy, Download, ExternalLink, FileArchive, FileSpreadsheet, FileText, ImagePlus, QrCode, ScanLine, Share2, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { lazy, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { UtilityField, UtilityInput, UtilityNotice, UtilityPage, UtilitySectionCard, UtilitySelect, UtilityTextarea } from "../../components/UtilitySurface";
import { PageHeader, PrimaryButton, SegmentedControl } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ToolGuide } from "../../components/ToolGuide";
import { resolveFeatureMessage } from "../../i18n/featureMessages";

const QrBulkPanel = lazy(() => import("./QrBulkPanel").then((module) => ({ default: module.QrBulkPanel })));

export type QrMode = "create" | "scan" | "bulk";

export function QrStudioPage({ initialMode = "create" }: { initialMode?: QrMode }) {
  const { t, i18n } = useTranslation("features");
  const [mode, setMode] = useState<QrMode>(initialMode);
  const [text, setText] = useState("https://worklazy.net/");
  const [size, setSize] = useState(640);
  const [dark, setDark] = useState("#111118");
  const [logo, setLogo] = useState<File>();
  const [scanFiles, setScanFiles] = useState<File[]>([]);
  const [scanned, setScanned] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [qrReady, setQrReady] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const scanResultRef = useRef<HTMLDivElement>(null);
  const fileWorkerRef = useRef<Worker | undefined>(undefined);
  const cameraWorkerRef = useRef<Worker | undefined>(undefined);
  const cameraStreamRef = useRef<MediaStream | undefined>(undefined);
  const cameraTimerRef = useRef<number | undefined>(undefined);
  const captureInFlightRef = useRef(false);
  const captureFrameRef = useRef<(() => void) | undefined>(undefined);
  const qrGenerationRef = useRef(0);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const releaseCameraResources = useCallback(() => {
    window.clearTimeout(cameraTimerRef.current);
    cameraTimerRef.current = undefined;
    captureFrameRef.current = undefined;
    captureInFlightRef.current = false;
    cameraWorkerRef.current?.terminate();
    cameraWorkerRef.current = undefined;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = undefined;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    releaseCameraResources();
    setCameraActive(false);
    setCameraStarting(false);
  }, [releaseCameraResources]);

  useEffect(() => () => {
    fileWorkerRef.current?.terminate();
    releaseCameraResources();
  }, [releaseCameraResources]);

  useEffect(() => {
    const generation = ++qrGenerationRef.current;
    setQrReady(false);
    setError("");
    clearCanvas(canvasRef.current);
    if (mode !== "create" || !text) return;
    void drawQr(canvasRef.current, text, size, dark, logo, t("qr.errors.logo")).then(() => {
      if (generation !== qrGenerationRef.current) return;
      setError("");
      setQrReady(true);
    }).catch((reason) => {
      if (generation !== qrGenerationRef.current) return;
      clearCanvas(canvasRef.current);
      setQrReady(false);
      setError(qrGenerationError(reason, t("qr.errors.tooLong"), t("qr.createError")));
    });
  }, [mode, text, size, dark, logo, i18n.language, t]);

  useEffect(() => {
    if (mode !== "scan" || (!scanned && !error) || !window.matchMedia("(max-width: 620px)").matches) return;
    const frame = window.requestAnimationFrame(() => scanResultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    return () => window.cancelAnimationFrame(frame);
  }, [mode, scanned, error]);

  const download = () => qrReady && canvasRef.current?.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "worklazy-qr.png";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
  }, "image/png");

  const shareQr = () => {
    const canvas = canvasRef.current;
    if (!qrReady || !canvas || typeof navigator.share !== "function") return download();
    const blob = dataUrlToBlob(canvas.toDataURL("image/png"));
    const file = new File([blob], "worklazy-qr.png", { type: "image/png" });
    if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) return download();
    void navigator.share({ title: t("qr.shareTitle"), files: [file] }).catch((reason) => {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) download();
    });
  };

  const scanFile = async (file: File) => {
    stopCamera();
    fileWorkerRef.current?.terminate();
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      setError("");
      setScanned("");
      const worker = new Worker(new URL("./qr-scan.worker.ts", import.meta.url), { type: "module" });
      fileWorkerRef.current = worker;
      worker.onmessage = (event) => {
        setBusy(false);
        if (event.data.type === "error") setError(resolveFeatureMessage(i18n.language === "en" ? "en" : "ko", event.data.message));
        else if (!event.data.data) setError(t("qr.notFound"));
        else { setError(""); setScanned(event.data.data); }
        worker.terminate();
        if (fileWorkerRef.current === worker) fileWorkerRef.current = undefined;
      };
      worker.onerror = (event) => {
        setBusy(false);
        setError(t("qr.fileError"));
        worker.terminate();
        if (fileWorkerRef.current === worker) fileWorkerRef.current = undefined;
      };
      worker.postMessage({ buffer, type: file.type }, [buffer]);
    } catch {
      setBusy(false);
      setError(t("qr.fileError"));
    }
  };

  const startCamera = async () => {
    releaseCameraResources();
    setCameraStarting(true);
    setCameraActive(false);
    setError("");
    setScanned("");
    setCopyFeedback("");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(t("qr.errors.secure"));
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      cameraStreamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error(t("qr.errors.preview"));
      video.srcObject = stream;
      await video.play();

      const worker = new Worker(new URL("./qr-scan.worker.ts", import.meta.url), { type: "module" });
      cameraWorkerRef.current = worker;
      const scheduleNext = (delay = 180) => {
        if (cameraWorkerRef.current !== worker) return;
        window.clearTimeout(cameraTimerRef.current);
        cameraTimerRef.current = window.setTimeout(() => captureFrameRef.current?.(), delay);
      };
      const captureFrame = async () => {
        if (cameraWorkerRef.current !== worker || captureInFlightRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          scheduleNext(120);
          return;
        }
        const canvas = captureCanvasRef.current;
        if (!canvas || !video.videoWidth || !video.videoHeight) {
          scheduleNext(120);
          return;
        }
        captureInFlightRef.current = true;
        try {
          const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
          canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error(t("qr.errors.frame"));
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const blob = await canvasToBlob(canvas, "image/jpeg", 0.86, t("qr.errors.image"));
          const buffer = await blob.arrayBuffer();
          if (cameraWorkerRef.current === worker) worker.postMessage({ buffer, type: blob.type }, [buffer]);
        } catch {
          captureInFlightRef.current = false;
          setError(t("qr.errors.scan"));
          stopCamera();
        }
      };
      captureFrameRef.current = () => { void captureFrame(); };
      worker.onmessage = (event) => {
        captureInFlightRef.current = false;
        if (event.data.type === "error") {
          setError(event.data.message ? resolveFeatureMessage(i18n.language === "en" ? "en" : "ko", event.data.message) : t("qr.errors.frameQr"));
          stopCamera();
          return;
        }
        if (event.data.data) {
          setScanned(event.data.data);
          setError("");
          stopCamera();
          return;
        }
        scheduleNext();
      };
      worker.onerror = () => {
        setError(t("qr.errors.scanner"));
        stopCamera();
      };
      setCameraActive(true);
      scheduleNext(80);
    } catch (reason) {
      releaseCameraResources();
      setCameraActive(false);
      setError(cameraErrorMessage(reason, {
        start: t("qr.errors.start"), permission: t("qr.errors.permission"), notFound: t("qr.errors.notFound"), busy: t("qr.errors.busy"),
      }));
    } finally {
      setCameraStarting(false);
    }
  };

  const changeMode = (next: QrMode) => {
    if (next !== "scan") stopCamera();
    setMode(next);
    setError("");
    setScanned("");
  };

  return (
    <UtilityPage toolId="qr-studio">
      <div className="contents" data-testid="qr-studio-page">
      <PageHeader eyebrow="QR STUDIO" title={t("qr.title")} description={t("qr.description")} />
      <div className="mb-4" data-testid="qr-mode"><SegmentedControl value={mode} onChange={changeMode} label={t("qr.modeLabel")} options={[{ value: "create", label: t("qr.create") }, { value: "bulk", label: t("qr.bulk.mode") }, { value: "scan", label: t("qr.scan") }]} /></div>

      {mode === "create" ? (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)] items-start gap-4 max-[820px]:grid-cols-1" data-testid="qr-create-layout">
          <UtilitySectionCard title={t("qr.contentStyle")}>
            <UtilityField><span>{t("qr.content")}</span><UtilityTextarea className="min-h-40 rounded-xl" data-testid="qr-content" value={text} onChange={(event) => setText(event.target.value)} /></UtilityField>
            <div className="mt-3 grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
              <UtilityField><span>{t("qr.size")}</span><UtilitySelect value={size} onChange={(event) => setSize(Number(event.target.value))}><option value={320}>320px</option><option value={640}>640px</option><option value={1024}>1024px</option></UtilitySelect></UtilityField>
              <UtilityField><span>{t("qr.color")}</span><UtilityInput className="cursor-pointer p-1" type="color" value={dark} onChange={(event) => setDark(event.target.value)} /></UtilityField>
              <UtilityField className="col-span-full"><span>{t("qr.logo")}</span><UtilityInput className="h-auto min-h-10 py-1.5 file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-bold" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogo(event.target.files?.[0])} /></UtilityField>
            </div>
          </UtilitySectionCard>
          <UtilitySectionCard title={t("qr.preview")}><div className="grid min-h-[300px] place-items-center rounded-2xl border border-border bg-muted/45 p-4" data-testid="qr-preview" data-ready={qrReady}><canvas className="block h-auto max-h-[360px] max-w-full rounded-xl bg-white shadow-sm" ref={canvasRef} /></div>{error && <p className="mt-2 text-sm font-bold text-destructive" data-testid="qr-error" role="alert">{error}</p>}<div className="mt-3 flex flex-wrap gap-2"><PrimaryButton accent="blue" disabled={!qrReady} onClick={download}><Download size={18} /> {t("qr.download")}</PrimaryButton>{typeof navigator.share === "function" && <Button className="min-h-11 rounded-xl" type="button" variant="secondary" disabled={!qrReady} onClick={shareQr}><Share2 size={17} /> {t("qr.share")}</Button>}</div></UtilitySectionCard>
        </div>
      ) : mode === "scan" ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)] items-start gap-4 max-[820px]:grid-cols-1" data-testid="qr-scan-layout">
            <UtilitySectionCard className="overflow-visible" data-testid="qr-camera-scan-card" title={t("qr.scanTitle")} description={t("qr.scanHelp")}>
              <div className="relative grid aspect-video min-h-[260px] place-items-center overflow-hidden rounded-2xl bg-slate-950 text-white max-[620px]:min-h-[220px]" data-testid="qr-camera-stage" data-active={cameraActive || undefined}>
                <video className="absolute inset-0 size-full object-cover" ref={videoRef} autoPlay muted playsInline aria-label={t("qr.cameraLabel")} />
                {!cameraActive && <div className="relative z-10 grid justify-items-center gap-2 px-4 text-center"><Camera size={30} /><strong className="text-sm">{t("qr.cameraOffTitle")}</strong><span className="text-xs text-slate-300">{t("qr.cameraPrivate")}</span></div>}
                {cameraActive && <div className="pointer-events-none relative z-10 aspect-square h-[68%] rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,.28)]" aria-hidden="true" />}
              </div>
              <canvas ref={captureCanvasRef} className="sr-only" aria-hidden="true" />
              <div className="mt-3 flex flex-wrap gap-2" data-testid="qr-scan-actions">
                {cameraActive
                  ? <PrimaryButton accent="blue" onClick={stopCamera}><CameraOff size={18} /> {t("qr.turnOff")}</PrimaryButton>
                  : <PrimaryButton accent="blue" loading={cameraStarting} onClick={() => void startCamera()}><Camera size={18} /> {t("qr.cameraScan")}</PrimaryButton>}
                <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-secondary px-4 text-sm font-bold text-secondary-foreground outline-none transition-colors hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 ${busy ? "pointer-events-none opacity-50" : ""}`} data-testid="qr-photo-picker" aria-disabled={busy}>
                  {busy ? <><ScanLine size={18} /> {t("qr.analyzing")}</> : <><ImagePlus size={18} /> {t("qr.choosePhoto")}</>}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (!file) return;
                      const input = event.currentTarget;
                      setScanFiles([file]);
                      void scanFile(file).finally(() => { input.value = ""; });
                    }}
                  />
                </label>
              </div>
              {scanFiles[0] && <p className="mt-2 flex min-w-0 items-center gap-1.5 text-sm" data-testid="qr-selected-photo"><ImagePlus className="shrink-0" size={15} /><span className="overflow-hidden text-ellipsis whitespace-nowrap">{scanFiles[0].name}</span><small className="ml-auto shrink-0 text-xs text-muted-foreground">{t("qr.instant")}</small></p>}
            </UtilitySectionCard>
            {(scanned || error) && (
              <div ref={scanResultRef} role="status" aria-live="polite" data-testid="qr-scan-result-slot">
                <UtilitySectionCard title={t("qr.scanResult")}>
                  <Card className={`flex-row items-center gap-2 overflow-visible rounded-2xl border p-3 shadow-sm ${error ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-green-700/30 bg-green-500/5"}`} data-testid="qr-scan-result" data-error={Boolean(error) || undefined}>
                    <QrCode className="shrink-0" size={21} />
                    <p className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">{error || scanned}</p>
                    {scanned && <Button variant="ghost" size="icon-sm" className="rounded-lg" type="button" aria-label={t("qr.copyResult")} onClick={() => void navigator.clipboard.writeText(scanned).then(() => setCopyFeedback(t("qr.copied"))).catch(() => setCopyFeedback(t("qr.copyFailed")))}><Copy size={17} /></Button>}
                    {scanned && safeHttpUrl(scanned) && <Button render={<a href={safeHttpUrl(scanned)} target="_blank" rel="noopener noreferrer" />} className="rounded-xl" variant="secondary"><ExternalLink size={16} /> {t("qr.openLink")}</Button>}
                  </Card>
                  {copyFeedback && <small className="mt-2 block text-xs text-muted-foreground" role="status">{copyFeedback}</small>}
                </UtilitySectionCard>
              </div>
            )}
          </div>
          <UtilityNotice className="mt-3"><AlertTriangle className="mt-0.5 shrink-0" size={16} /><span>{t("qr.compatibility")}</span></UtilityNotice>
        </>
      ) : <QrBulkPanel />}

      {mode === "bulk"
        ? <div className="flex flex-wrap gap-2">{[
          { Icon: FileSpreadsheet, label: t("qr.bulkCapabilities.table") },
          { Icon: ShieldCheck, label: t("qr.bulkCapabilities.verify") },
          { Icon: FileArchive, label: t("qr.bulkCapabilities.zip") },
          { Icon: FileText, label: t("qr.bulkCapabilities.labels") },
        ].map(({ Icon, label }) => <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground" key={label}><Icon size={17} />{label}</span>)}</div>
        : <div className="mt-4 flex flex-wrap gap-2">{[{ Icon: QrCode, label: t("qr.capabilities.recovery") }, { Icon: ImagePlus, label: t("qr.capabilities.logo") }, { Icon: Camera, label: t("qr.capabilities.camera") }, { Icon: ScanLine, label: t("qr.capabilities.photo") }].map(({ Icon, label }) => <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground" key={label}><Icon size={17} />{label}</span>)}</div>}
      <ToolGuide
        title={t(mode === "bulk" ? "qr.bulkGuide.title" : "qr.guide.title")}
        description={t(mode === "bulk" ? "qr.bulkGuide.description" : "qr.guide.description")}
        blocks={(t(mode === "bulk" ? "qr.bulkGuide.blocks" : "qr.guide.blocks", { returnObjects: true, Header: "{{Header}}" }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))}
        faq={(t(mode === "bulk" ? "qr.bulkGuide.faq" : "qr.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))}
      />
      </div>
    </UtilityPage>
  );
}

async function drawQr(canvas: HTMLCanvasElement | null, text: string, size: number, dark: string, logo: File | undefined, logoError: string) {
  if (!canvas || !text) return;
  await QRCode.toCanvas(canvas, text, { width: size, margin: 3, errorCorrectionLevel: "H", color: { dark, light: "#ffffff" } });
  if (!logo) return;
  const url = URL.createObjectURL(logo);
  try {
    const image = await loadImage(url, logoError);
    const context = canvas.getContext("2d");
    if (!context) return;
    const box = size * 0.22;
    const x = (size - box) / 2;
    const y = x;
    context.fillStyle = "white";
    context.beginPath();
    context.roundRect(x - 8, y - 8, box + 16, box + 16, size * 0.025);
    context.fill();
    context.drawImage(image, x, y, box, box);
  } finally { URL.revokeObjectURL(url); }
}

function clearCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  canvas.width = 1;
  canvas.height = 1;
  canvas.getContext("2d")?.clearRect(0, 0, 1, 1);
}

function qrGenerationError(reason: unknown, tooLong: string, fallback: string) {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (/too big|amount of data|code length|overflow/i.test(message)) return tooLong;
  return fallback;
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function loadImage(url: string, errorMessage: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(errorMessage));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number, errorMessage: string) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error(errorMessage));
  }, type, quality));
}

function dataUrlToBlob(dataUrl: string) {
  const [header, encoded] = dataUrl.split(",");
  const mimeType = header.match(/^data:([^;]+)/)?.[1] || "application/octet-stream";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function cameraErrorMessage(reason: unknown, messages: { start: string; permission: string; notFound: string; busy: string }) {
  if (!(reason instanceof DOMException)) return reason instanceof Error ? reason.message : messages.start;
  if (reason.name === "NotAllowedError" || reason.name === "SecurityError") return messages.permission;
  if (reason.name === "NotFoundError" || reason.name === "OverconstrainedError") return messages.notFound;
  if (reason.name === "NotReadableError" || reason.name === "AbortError") return messages.busy;
  return reason.message || messages.start;
}
