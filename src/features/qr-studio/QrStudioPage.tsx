import { AlertTriangle, Camera, CameraOff, Copy, Download, ExternalLink, FileArchive, FileSpreadsheet, FileText, ImagePlus, QrCode, ScanLine, Share2, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { lazy, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader, PrimaryButton, SectionCard, SegmentedControl } from "../../components/ui";
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
    <div className="page tool-page page-enter utility-page qr-page">
      <PageHeader eyebrow="QR STUDIO" title={t("qr.title")} description={t("qr.description")} />
      <div className="mode-switch"><SegmentedControl value={mode} onChange={changeMode} label={t("qr.modeLabel")} options={[{ value: "create", label: t("qr.create") }, { value: "bulk", label: t("qr.bulk.mode") }, { value: "scan", label: t("qr.scan") }]} /></div>

      {mode === "create" ? (
        <div className="qr-layout">
          <SectionCard title={t("qr.contentStyle")}>
            <label className="block-field"><span>{t("qr.content")}</span><textarea value={text} onChange={(event) => setText(event.target.value)} /></label>
            <div className="utility-form-grid">
              <label><span>{t("qr.size")}</span><select value={size} onChange={(event) => setSize(Number(event.target.value))}><option value={320}>320px</option><option value={640}>640px</option><option value={1024}>1024px</option></select></label>
              <label><span>{t("qr.color")}</span><input type="color" value={dark} onChange={(event) => setDark(event.target.value)} /></label>
              <label className="span-2 file-control"><span>{t("qr.logo")}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogo(event.target.files?.[0])} /></label>
            </div>
          </SectionCard>
          <SectionCard title={t("qr.preview")}><div className="qr-preview"><canvas ref={canvasRef} /></div>{error && <p className="utility-error" role="alert">{error}</p>}<div className="result-file-actions"><PrimaryButton accent="blue" disabled={!qrReady} onClick={download}><Download size={18} /> {t("qr.download")}</PrimaryButton>{typeof navigator.share === "function" && <button type="button" className="secondary-button" disabled={!qrReady} onClick={shareQr}><Share2 size={17} /> {t("qr.share")}</button>}</div></SectionCard>
        </div>
      ) : mode === "scan" ? (
        <>
          <div className="qr-scan-layout">
            <SectionCard className="qr-camera-scan-card" title={t("qr.scanTitle")} description={t("qr.scanHelp")}>
              <div className={`qr-camera-stage${cameraActive ? " active" : ""}`}>
                <video ref={videoRef} autoPlay muted playsInline aria-label={t("qr.cameraLabel")} />
                {!cameraActive && <div className="qr-camera-placeholder"><Camera size={30} /><strong>{t("qr.cameraOffTitle")}</strong><span>{t("qr.cameraPrivate")}</span></div>}
                {cameraActive && <div className="qr-camera-guide" aria-hidden="true" />}
              </div>
              <canvas ref={captureCanvasRef} className="visually-hidden" aria-hidden="true" />
              <div className="section-actions qr-scan-actions">
                {cameraActive
                  ? <PrimaryButton accent="blue" onClick={stopCamera}><CameraOff size={18} /> {t("qr.turnOff")}</PrimaryButton>
                  : <PrimaryButton accent="blue" loading={cameraStarting} onClick={() => void startCamera()}><Camera size={18} /> {t("qr.cameraScan")}</PrimaryButton>}
                <label className={`secondary-button qr-photo-picker${busy ? " disabled" : ""}`} aria-disabled={busy}>
                  {busy ? <><ScanLine size={18} /> {t("qr.analyzing")}</> : <><ImagePlus size={18} /> {t("qr.choosePhoto")}</>}
                  <input
                    className="visually-hidden"
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
              {scanFiles[0] && <p className="qr-selected-photo"><ImagePlus size={15} /><span>{scanFiles[0].name}</span><small>{t("qr.instant")}</small></p>}
            </SectionCard>
            {(scanned || error) && (
              <div className="qr-scan-result-slot" ref={scanResultRef} role="status" aria-live="polite">
                <SectionCard title={t("qr.scanResult")}>
                  <div className={`scan-result${error ? " error" : ""}`}>
                    <QrCode size={21} />
                    <p>{error || scanned}</p>
                    {scanned && <button type="button" aria-label={t("qr.copyResult")} onClick={() => void navigator.clipboard.writeText(scanned).then(() => setCopyFeedback(t("qr.copied"))).catch(() => setCopyFeedback(t("qr.copyFailed")))}><Copy size={17} /></button>}
                    {scanned && safeHttpUrl(scanned) && <a className="secondary-button" href={safeHttpUrl(scanned)} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> {t("qr.openLink")}</a>}
                  </div>
                  {copyFeedback && <small role="status">{copyFeedback}</small>}
                </SectionCard>
              </div>
            )}
          </div>
          <div className="inline-notice warning qr-compatibility-notice"><AlertTriangle size={16} /><span>{t("qr.compatibility")}</span></div>
        </>
      ) : <QrBulkPanel />}

      {mode === "bulk"
        ? <div className="flex flex-wrap gap-2">{[
          { Icon: FileSpreadsheet, label: t("qr.bulkCapabilities.table") },
          { Icon: ShieldCheck, label: t("qr.bulkCapabilities.verify") },
          { Icon: FileArchive, label: t("qr.bulkCapabilities.zip") },
          { Icon: FileText, label: t("qr.bulkCapabilities.labels") },
        ].map(({ Icon, label }) => <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground" key={label}><Icon size={17} />{label}</span>)}</div>
        : <div className="format-capabilities"><span><QrCode size={17} /> {t("qr.capabilities.recovery")}</span><span><ImagePlus size={17} /> {t("qr.capabilities.logo")}</span><span><Camera size={17} /> {t("qr.capabilities.camera")}</span><span><ScanLine size={17} /> {t("qr.capabilities.photo")}</span></div>}
      <ToolGuide
        title={t(mode === "bulk" ? "qr.bulkGuide.title" : "qr.guide.title")}
        description={t(mode === "bulk" ? "qr.bulkGuide.description" : "qr.guide.description")}
        blocks={(t(mode === "bulk" ? "qr.bulkGuide.blocks" : "qr.guide.blocks", { returnObjects: true, Header: "{{Header}}" }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))}
        faq={(t(mode === "bulk" ? "qr.bulkGuide.faq" : "qr.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))}
      />
    </div>
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
