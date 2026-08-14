import { AlertTriangle, Camera, CameraOff, Copy, Download, ImagePlus, QrCode, ScanLine, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

import { PageHeader, PrimaryButton, SectionCard, SegmentedControl } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";

type QrMode = "create" | "scan";

export function QrStudioPage() {
  const [mode, setMode] = useState<QrMode>("create");
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
    void drawQr(canvasRef.current, text, size, dark, logo).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "QR 코드를 만들지 못했습니다.");
    });
  }, [text, size, dark, logo]);

  useEffect(() => {
    if (mode !== "scan" || (!scanned && !error) || !window.matchMedia("(max-width: 620px)").matches) return;
    const frame = window.requestAnimationFrame(() => scanResultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    return () => window.cancelAnimationFrame(frame);
  }, [mode, scanned, error]);

  const download = () => canvasRef.current?.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "worklazy-qr.png";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, "image/png");

  const shareQr = () => {
    const canvas = canvasRef.current;
    if (!canvas || typeof navigator.share !== "function") return download();
    const blob = dataUrlToBlob(canvas.toDataURL("image/png"));
    const file = new File([blob], "worklazy-qr.png", { type: "image/png" });
    if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) return download();
    void navigator.share({ title: "Worklazy QR 코드", files: [file] }).catch((reason) => {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) download();
    });
  };

  const scanFile = async (file: File) => {
    stopCamera();
    fileWorkerRef.current?.terminate();
    setBusy(true);
    setError("");
    setScanned("");
    const worker = new Worker(new URL("./qr-scan.worker.ts", import.meta.url), { type: "module" });
    fileWorkerRef.current = worker;
    worker.onmessage = (event) => {
      setBusy(false);
      if (event.data.type === "error") setError(event.data.message);
      else if (!event.data.data) setError("사진에서 QR 코드를 찾지 못했습니다.");
      else setScanned(event.data.data);
      worker.terminate();
      if (fileWorkerRef.current === worker) fileWorkerRef.current = undefined;
    };
    worker.onerror = (event) => {
      setBusy(false);
      setError(event.message || "QR 사진을 분석하지 못했습니다.");
      worker.terminate();
      if (fileWorkerRef.current === worker) fileWorkerRef.current = undefined;
    };
    const buffer = await file.arrayBuffer();
    worker.postMessage({ buffer, type: file.type }, [buffer]);
  };

  const startCamera = async () => {
    releaseCameraResources();
    setCameraStarting(true);
    setCameraActive(false);
    setError("");
    setScanned("");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("이 브라우저에서는 보안 연결(HTTPS) 카메라 접근을 지원하지 않습니다.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      cameraStreamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("카메라 미리보기 화면을 준비하지 못했습니다.");
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
          if (!context) throw new Error("카메라 프레임을 읽을 수 없습니다.");
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const blob = await canvasToBlob(canvas, "image/jpeg", 0.86);
          const buffer = await blob.arrayBuffer();
          if (cameraWorkerRef.current === worker) worker.postMessage({ buffer, type: blob.type }, [buffer]);
        } catch (reason) {
          captureInFlightRef.current = false;
          setError(reason instanceof Error ? reason.message : "카메라 QR 스캔 중 오류가 발생했습니다.");
          stopCamera();
        }
      };
      captureFrameRef.current = () => { void captureFrame(); };
      worker.onmessage = (event) => {
        captureInFlightRef.current = false;
        if (event.data.type === "error") {
          setError(event.data.message || "카메라 프레임에서 QR 코드를 읽지 못했습니다.");
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
      worker.onerror = (event) => {
        setError(event.message || "카메라 QR 스캐너를 실행하지 못했습니다.");
        stopCamera();
      };
      setCameraActive(true);
      scheduleNext(80);
    } catch (reason) {
      releaseCameraResources();
      setCameraActive(false);
      setError(cameraErrorMessage(reason));
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
      <PageHeader eyebrow="QR STUDIO" title="QR 코드 생성·스캔" description="텍스트와 URL을 로고가 포함된 QR 코드로 만들거나 카메라·사진 속 QR 데이터를 브라우저에서 읽으세요." />
      <div className="mode-switch"><SegmentedControl value={mode} onChange={changeMode} label="QR 기능" options={[{ value: "create", label: "QR 생성" }, { value: "scan", label: "QR 스캔" }]} /></div>

      {mode === "create" ? (
        <div className="qr-layout">
          <SectionCard title="내용과 스타일">
            <label className="block-field"><span>URL 또는 텍스트</span><textarea value={text} onChange={(event) => setText(event.target.value)} /></label>
            <div className="utility-form-grid">
              <label><span>크기</span><select value={size} onChange={(event) => setSize(Number(event.target.value))}><option value={320}>320px</option><option value={640}>640px</option><option value={1024}>1024px</option></select></label>
              <label><span>QR 색상</span><input type="color" value={dark} onChange={(event) => setDark(event.target.value)} /></label>
              <label className="span-2 file-control"><span>중앙 로고(선택)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogo(event.target.files?.[0])} /></label>
            </div>
          </SectionCard>
          <SectionCard title="미리보기"><div className="qr-preview"><canvas ref={canvasRef} /></div><div className="result-file-actions"><PrimaryButton accent="blue" disabled={!text} onClick={download}><Download size={18} /> PNG 다운로드</PrimaryButton>{typeof navigator.share === "function" && <button type="button" className="secondary-button" disabled={!text} onClick={shareQr}><Share2 size={17} /> 공유·기기에 저장</button>}</div></SectionCard>
        </div>
      ) : (
        <>
          <div className="qr-scan-layout">
            <SectionCard className="qr-camera-scan-card" title="QR 스캔" description="카메라를 켜거나 저장된 QR 사진을 바로 선택하세요.">
              <div className={`qr-camera-stage${cameraActive ? " active" : ""}`}>
                <video ref={videoRef} autoPlay muted playsInline aria-label="QR 스캔 카메라 미리보기" />
                {!cameraActive && <div className="qr-camera-placeholder"><Camera size={30} /><strong>카메라는 버튼을 누른 뒤에만 켜집니다.</strong><span>영상과 QR 데이터는 외부 서버로 전송되지 않습니다.</span></div>}
                {cameraActive && <div className="qr-camera-guide" aria-hidden="true" />}
              </div>
              <canvas ref={captureCanvasRef} className="visually-hidden" aria-hidden="true" />
              <div className="section-actions qr-scan-actions">
                {cameraActive
                  ? <PrimaryButton accent="blue" onClick={stopCamera}><CameraOff size={18} /> 카메라 끄기</PrimaryButton>
                  : <PrimaryButton accent="blue" loading={cameraStarting} onClick={() => void startCamera()}><Camera size={18} /> 카메라로 스캔</PrimaryButton>}
                <label className={`secondary-button qr-photo-picker${busy ? " disabled" : ""}`} aria-disabled={busy}>
                  {busy ? <><ScanLine size={18} /> 사진 분석 중…</> : <><ImagePlus size={18} /> QR 사진 선택</>}
                  <input
                    className="visually-hidden"
                    type="file"
                    accept="image/*"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      setScanFiles([file]);
                      void scanFile(file);
                    }}
                  />
                </label>
              </div>
              {scanFiles[0] && <p className="qr-selected-photo"><ImagePlus size={15} /><span>{scanFiles[0].name}</span><small>선택 즉시 분석</small></p>}
            </SectionCard>
            {(scanned || error) && (
              <div className="qr-scan-result-slot" ref={scanResultRef} role="status" aria-live="polite">
                <SectionCard title="스캔 결과">
                  <div className={`scan-result${error ? " error" : ""}`}>
                    <QrCode size={21} />
                    <p>{error || scanned}</p>
                    {scanned && <button type="button" aria-label="스캔 결과 복사" onClick={() => void navigator.clipboard.writeText(scanned)}><Copy size={17} /></button>}
                  </div>
                </SectionCard>
              </div>
            )}
          </div>
          <div className="inline-notice warning qr-compatibility-notice"><AlertTriangle size={16} /><span>카메라·사진 분석은 OffscreenCanvas를 사용하므로 iOS 16.3 이하에서는 사용할 수 없습니다. iOS 16.4 이상 또는 최신 Android 브라우저를 사용해 주세요.</span></div>
        </>
      )}

      <div className="format-capabilities"><span><QrCode size={17} /> 오류 복원 H</span><span><ImagePlus size={17} /> 중앙 로고</span><span><Camera size={17} /> 실시간 카메라</span><span><ScanLine size={17} /> 로컬 사진 스캔</span></div>
      <ToolGuide
        title="QR 코드 사용 안내"
        description="생성 내용, 카메라 프레임과 스캔 이미지는 외부 서버에 전송되지 않습니다."
        blocks={[
          { title: "중앙 로고", paragraphs: ["높은 오류 복원 수준을 사용하고 로고 뒤에 흰 여백을 넣습니다. 로고가 너무 복잡하면 일부 카메라에서 인식률이 떨어질 수 있습니다."] },
          { title: "실시간 카메라", paragraphs: ["HTTPS에서 사용자 허용을 받은 뒤 후면 카메라를 우선 사용합니다. 프레임을 브라우저 내부 Worker에서 반복 분석하며 QR을 찾으면 즉시 카메라 트랙과 Worker를 종료합니다."] },
          { title: "사진 스캔", paragraphs: ["큰 이미지는 Worker에서 최대 2200px로 축소한 뒤 명암 반전을 포함해 분석합니다."] },
        ]}
        faq={[
          { question: "QR URL의 안전성도 검사하나요?", answer: "아니요. QR 데이터를 표시할 뿐 연결된 사이트의 안전성을 보증하지 않습니다." },
          { question: "카메라 권한은 언제 사용하나요?", answer: "카메라로 스캔 버튼을 누른 경우에만 권한을 요청합니다. 스캔 완료, 카메라 끄기, 탭 전환 또는 페이지 종료 시 카메라 트랙을 즉시 중지합니다." },
        ]}
      />
    </div>
  );
}

async function drawQr(canvas: HTMLCanvasElement | null, text: string, size: number, dark: string, logo?: File) {
  if (!canvas || !text) return;
  await QRCode.toCanvas(canvas, text, { width: size, margin: 3, errorCorrectionLevel: "H", color: { dark, light: "#ffffff" } });
  if (!logo) return;
  const url = URL.createObjectURL(logo);
  try {
    const image = await loadImage(url);
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

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("로고 이미지를 읽지 못했습니다."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("카메라 프레임을 이미지로 만들지 못했습니다."));
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

function cameraErrorMessage(reason: unknown) {
  if (!(reason instanceof DOMException)) return reason instanceof Error ? reason.message : "카메라를 시작하지 못했습니다.";
  if (reason.name === "NotAllowedError" || reason.name === "SecurityError") return "카메라 권한이 거부되었습니다. 브라우저 사이트 설정에서 카메라를 허용해 주세요.";
  if (reason.name === "NotFoundError" || reason.name === "OverconstrainedError") return "사용할 수 있는 카메라를 찾지 못했습니다.";
  if (reason.name === "NotReadableError" || reason.name === "AbortError") return "다른 앱이 카메라를 사용 중이거나 카메라를 열 수 없습니다.";
  return reason.message || "카메라를 시작하지 못했습니다.";
}
