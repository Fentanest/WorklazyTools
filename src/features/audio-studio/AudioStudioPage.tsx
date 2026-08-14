import {
  AlertTriangle,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  Download,
  FileAudio2,
  LoaderCircle,
  Pause,
  Play,
  Redo2,
  Repeat2,
  Scissors,
  SkipBack,
  Trash2,
  Undo2,
  VolumeX,
  Waves,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/dist/plugins/regions.esm.js";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline.esm.js";

import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { FileDropZone, PageHeader, PrimaryButton, SectionCard, SegmentedControl, ToggleRow, formatBytes } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { audioBufferToDocument, audioHistoryLimit, createAudioFileName, formatAudioTime } from "./audioHelpers";
import { runAudioProcessor } from "./audioProcessorClient";
import type { AudioClipboardData, AudioDocumentData, AudioEditCommand, AudioProcessorResult } from "./types";

type ExportFormat = "wav" | "mp3";

interface AudioSelection {
  start: number;
  end: number;
}

const MIN_SELECTION_SECONDS = 0.01;
const ZOOM_LEVELS = [12, 24, 48, 96, 180, 300] as const;

export function AudioStudioPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [document, setDocument] = useState<AudioDocumentData>();
  const [selection, setSelection] = useState<AudioSelection>();
  const [clipboard, setClipboard] = useState<AudioClipboardData>();
  const [undoHistory, setUndoHistory] = useState<AudioDocumentData[]>([]);
  const [redoHistory, setRedoHistory] = useState<AudioDocumentData[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("wav");
  const [mp3Bitrate, setMp3Bitrate] = useState<128 | 192 | 256 | 320>(192);
  const [lastResult, setLastResult] = useState("");
  const progress = useOperationProgress();
  const failProgress = progress.fail;
  const documentReady = Boolean(document);

  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | undefined>(undefined);
  const regionsRef = useRef<RegionsPlugin | undefined>(undefined);
  const documentRef = useRef<AudioDocumentData | undefined>(undefined);
  const selectionRef = useRef<AudioSelection | undefined>(undefined);
  const loopRef = useRef(false);
  const previewUrlRef = useRef("");
  const decodeContextRef = useRef<AudioContext | undefined>(undefined);
  const activeControllerRef = useRef<AbortController | undefined>(undefined);
  const loadGenerationRef = useRef(0);
  const handleFilesRef = useRef<((files: File[]) => Promise<void>) | undefined>(undefined);

  useEffect(() => { documentRef.current = document; }, [document]);
  useEffect(() => { selectionRef.current = selection; }, [selection]);
  useEffect(() => { loopRef.current = loop; }, [loop]);

  const commitSelection = useCallback((next: AudioSelection | undefined) => {
    selectionRef.current = next;
    setSelection(next);
  }, []);

  const showSelectionRegion = useCallback((next: AudioSelection | undefined) => {
    commitSelection(next);
    const regions = regionsRef.current;
    if (!regions) return;
    regions.clearRegions();
    if (next && next.end - next.start >= MIN_SELECTION_SECONDS) {
      regions.addRegion({
        start: next.start,
        end: next.end,
        color: "rgba(139, 92, 246, 0.22)",
        drag: true,
        resize: true,
        minLength: MIN_SELECTION_SECONDS,
      });
    }
  }, [commitSelection]);

  useEffect(() => {
    const container = waveformContainerRef.current;
    if (!container) return;
    const regions = RegionsPlugin.create();
    const timeline = TimelinePlugin.create({
      height: 28,
      style: { color: "#777783", fontSize: "12px" },
      formatTimeCallback: (seconds) => formatTimelineLabel(seconds),
    });
    const wavesurfer = WaveSurfer.create({
      container,
      height: 190,
      waveColor: "#b7a5f8",
      progressColor: "#7c4dff",
      cursorColor: "#ff375f",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      minPxPerSec: ZOOM_LEVELS[zoomIndex],
      normalize: true,
      autoScroll: true,
      autoCenter: true,
      dragToSeek: true,
      plugins: [regions, timeline],
    });
    wavesurferRef.current = wavesurfer;
    regionsRef.current = regions;
    const disableDragSelection = regions.enableDragSelection({
      color: "rgba(139, 92, 246, 0.22)",
      drag: true,
      resize: true,
      minLength: MIN_SELECTION_SECONDS,
    }, 4);
    const unsubscribeCreated = regions.on("region-created", (region) => {
      regions.getRegions().filter((candidate) => candidate.id !== region.id).forEach((candidate) => candidate.remove());
      commitSelection(regionSelection(region));
    });
    const unsubscribeUpdated = regions.on("region-updated", (region) => commitSelection(regionSelection(region)));
    const unsubscribeRegionOut = regions.on("region-out", (region) => {
      if (loopRef.current && wavesurfer.isPlaying() && selectionRef.current?.end === region.end) region.play(true);
    });
    const unsubscribeReady = wavesurfer.on("ready", (duration) => {
      setCurrentTime(0);
      const desired = clampSelection(selectionRef.current || defaultSelection(duration), duration);
      showSelectionRegion(desired);
    });
    const unsubscribeTime = wavesurfer.on("timeupdate", setCurrentTime);
    const unsubscribePlay = wavesurfer.on("play", () => setIsPlaying(true));
    const unsubscribePause = wavesurfer.on("pause", () => setIsPlaying(false));
    const unsubscribeFinish = wavesurfer.on("finish", () => {
      setIsPlaying(false);
      if (!loopRef.current || selectionRef.current) return;
      wavesurfer.setTime(0);
      void wavesurfer.play();
    });
    const unsubscribeError = wavesurfer.on("error", (error) => {
      failProgress(`파형 재생 데이터를 열지 못했습니다: ${error.message}`);
    });
    return () => {
      disableDragSelection();
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeRegionOut();
      unsubscribeReady();
      unsubscribeTime();
      unsubscribePlay();
      unsubscribePause();
      unsubscribeFinish();
      unsubscribeError();
      regionsRef.current = undefined;
      wavesurferRef.current = undefined;
      wavesurfer.destroy();
    };
  }, [commitSelection, documentReady, failProgress, showSelectionRegion]);

  useEffect(() => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !previewUrl) return;
    void wavesurfer.load(previewUrl).catch((error) => {
      failProgress(`파형을 표시하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, [failProgress, previewUrl]);

  useEffect(() => () => {
    loadGenerationRef.current += 1;
    activeControllerRef.current?.abort();
    void decodeContextRef.current?.close().catch(() => undefined);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    documentRef.current = undefined;
    selectionRef.current = undefined;
  }, []);

  const replacePreview = (blob: Blob) => {
    const nextUrl = URL.createObjectURL(blob);
    const previousUrl = previewUrlRef.current;
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
    if (previousUrl) window.setTimeout(() => URL.revokeObjectURL(previousUrl), 1_000);
  };

  const handleFiles = async (nextFiles: File[]) => {
    const file = nextFiles.at(-1);
    if (!file) return;
    if (!isSupportedAudio(file)) {
      progress.start("오디오 형식을 확인하는 중…");
      progress.fail("MP3, WAV, M4A, AAC 또는 OGG 파일을 선택해 주세요.");
      return;
    }
    const generation = ++loadGenerationRef.current;
    activeControllerRef.current?.abort();
    await decodeContextRef.current?.close().catch(() => undefined);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreviewUrl("");
    wavesurferRef.current?.empty();
    const context = new AudioContext();
    decodeContextRef.current = context;
    setFiles([file]);
    setDocument(undefined);
    documentRef.current = undefined;
    setClipboard(undefined);
    setUndoHistory([]);
    setRedoHistory([]);
    setLastResult("");
    commitSelection(undefined);
    regionsRef.current?.clearRegions();
    progress.start(`${file.name} 오디오 샘플을 해석하는 중…`);
    try {
      const sourceBytes = await file.arrayBuffer();
      progress.update(22, "Web Audio API로 채널과 샘플레이트를 해석하는 중…");
      const decoded = await context.decodeAudioData(sourceBytes);
      if (generation !== loadGenerationRef.current) return;
      const nextDocument = audioBufferToDocument(decoded, file.name);
      const controller = new AbortController();
      activeControllerRef.current = controller;
      const preview = await runAudioProcessor({ command: "PREVIEW", document: nextDocument }, (value, message) => progress.update(30 + value * 0.65, message), controller.signal);
      if (generation !== loadGenerationRef.current || !preview.previewBlob) return;
      documentRef.current = nextDocument;
      setDocument(nextDocument);
      const initialSelection = defaultSelection(nextDocument.duration);
      commitSelection(initialSelection);
      replacePreview(preview.previewBlob);
      progress.succeed(`${file.name} 파형 준비 완료`);
      setLastResult(`${formatAudioTime(nextDocument.duration)} · ${nextDocument.channels.length}채널 · ${nextDocument.sampleRate.toLocaleString()}Hz`);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) progress.fail(toAudioError(error));
    } finally {
      if (decodeContextRef.current === context) decodeContextRef.current = undefined;
      await context.close().catch(() => undefined);
      if (activeControllerRef.current?.signal.aborted || generation === loadGenerationRef.current) activeControllerRef.current = undefined;
    }
  };
  handleFilesRef.current = handleFiles;

  useEffect(() => {
    const handoffId = new URLSearchParams(window.location.search).get("handoff");
    if (!handoffId || !/^[a-zA-Z0-9-]{8,100}$/.test(handoffId) || !("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(`worklazy-audio-handoff-${handoffId}`);
    let received = false;
    const announceReady = () => {
      if (!received) channel.postMessage({ type: "ready" });
    };
    channel.onmessage = async (event: MessageEvent<{ type?: string; blob?: unknown; fileName?: unknown; mimeType?: unknown; lastModified?: unknown }>) => {
      if (received || event.data?.type !== "audio-file" || !(event.data.blob instanceof Blob)) return;
      received = true;
      const fileName = typeof event.data.fileName === "string" && event.data.fileName ? event.data.fileName : "video-studio-audio.mp3";
      const mimeType = typeof event.data.mimeType === "string" ? event.data.mimeType : event.data.blob.type;
      const lastModified = typeof event.data.lastModified === "number" ? event.data.lastModified : Date.now();
      const file = new File([event.data.blob], fileName, { type: mimeType, lastModified });
      window.clearInterval(readyInterval);
      await handleFilesRef.current?.([file]);
      channel.postMessage({ type: "received" });
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.hash}`);
      channel.close();
    };
    const readyInterval = window.setInterval(announceReady, 500);
    announceReady();
    return () => {
      received = true;
      window.clearInterval(readyInterval);
      channel.close();
    };
  }, []);

  const applyEdit = async (command: AudioEditCommand) => {
    const currentDocument = documentRef.current;
    const currentSelection = selectionRef.current;
    if (!currentDocument) return;
    if (command !== "PASTE" && (!currentSelection || currentSelection.end - currentSelection.start < MIN_SELECTION_SECONDS)) {
      progress.start("편집 구간을 확인하는 중…");
      progress.fail("파형에서 편집할 구간을 드래그해 선택해 주세요.");
      return;
    }
    if (command === "PASTE" && !clipboard) {
      progress.start("오디오 클립보드를 확인하는 중…");
      progress.fail("먼저 선택 구간을 복사하거나 잘라내 주세요.");
      return;
    }
    const controller = new AbortController();
    activeControllerRef.current = controller;
    progress.start(editLabel(command));
    setLastResult("");
    try {
      const result = await runAudioProcessor({
        command,
        document: currentDocument,
        start: currentSelection?.start,
        end: currentSelection?.end,
        cursor: wavesurferRef.current?.getCurrentTime() || 0,
        clipboard,
      }, progress.update, controller.signal);
      if (command === "COPY") {
        if (result.clipboard) setClipboard(result.clipboard);
        progress.succeed(`선택한 ${formatAudioTime(result.clipboard?.duration || 0)} 구간을 복사했습니다.`);
        return;
      }
      if (!result.channels || !result.previewBlob) throw new Error("편집 결과 샘플을 받지 못했습니다.");
      const nextDocument = resultDocument(currentDocument, result);
      const limit = audioHistoryLimit(currentDocument);
      setUndoHistory((history) => [...history, currentDocument].slice(-limit));
      setRedoHistory([]);
      if (result.clipboard) setClipboard(result.clipboard);
      documentRef.current = nextDocument;
      setDocument(nextDocument);
      const nextSelection = selectionAfterEdit(command, currentSelection, clipboard, nextDocument.duration, wavesurferRef.current?.getCurrentTime() || 0);
      commitSelection(nextSelection);
      replacePreview(result.previewBlob);
      progress.succeed(`${editLabel(command).replace("…", "")} 완료`);
      setLastResult(`편집 후 길이 ${formatAudioTime(nextDocument.duration)} · 실행 취소 기록 ${Math.min(undoHistory.length + 1, limit)}개`);
    } catch (error) {
      progress.fail(error instanceof DOMException && error.name === "AbortError" ? "오디오 작업을 취소했습니다." : toAudioError(error));
    } finally {
      if (activeControllerRef.current === controller) activeControllerRef.current = undefined;
    }
  };

  const restoreHistory = async (direction: "undo" | "redo") => {
    const currentDocument = documentRef.current;
    const source = direction === "undo" ? undoHistory : redoHistory;
    const target = source.at(-1);
    if (!currentDocument || !target) return;
    const controller = new AbortController();
    activeControllerRef.current = controller;
    progress.start(direction === "undo" ? "이전 편집 상태를 복원하는 중…" : "다음 편집 상태를 복원하는 중…");
    try {
      const result = await runAudioProcessor({ command: "PREVIEW", document: target }, progress.update, controller.signal);
      if (!result.previewBlob) throw new Error("복원할 파형 미리보기를 만들지 못했습니다.");
      if (direction === "undo") {
        setUndoHistory((history) => history.slice(0, -1));
        setRedoHistory((history) => [...history, currentDocument].slice(-audioHistoryLimit(currentDocument)));
      } else {
        setRedoHistory((history) => history.slice(0, -1));
        setUndoHistory((history) => [...history, currentDocument].slice(-audioHistoryLimit(currentDocument)));
      }
      documentRef.current = target;
      setDocument(target);
      commitSelection(defaultSelection(target.duration));
      replacePreview(result.previewBlob);
      progress.succeed(direction === "undo" ? "실행 취소 완료" : "다시 실행 완료");
      setLastResult(`${direction === "undo" ? "이전" : "다음"} 상태 · ${formatAudioTime(target.duration)}`);
    } catch (error) {
      progress.fail(toAudioError(error));
    } finally {
      if (activeControllerRef.current === controller) activeControllerRef.current = undefined;
    }
  };

  const exportAudio = async () => {
    const currentDocument = documentRef.current;
    if (!currentDocument) return;
    const controller = new AbortController();
    activeControllerRef.current = controller;
    const extension = exportFormat;
    const fileName = createAudioFileName(currentDocument.sourceName, extension);
    progress.start(`${extension.toUpperCase()} 내보내기를 준비하는 중…`);
    setLastResult("");
    try {
      const result = await runAudioProcessor({
        command: exportFormat === "wav" ? "EXPORT_WAV" : "EXPORT_MP3",
        document: currentDocument,
        fileName,
        bitrate: mp3Bitrate,
      }, progress.update, controller.signal);
      if (!result.output) throw new Error("오디오 결과 파일을 받지 못했습니다.");
      downloadAudio(result.output.buffer, result.output.mimeType, result.output.fileName);
      progress.succeed(`${result.output.fileName} 생성 완료`);
      setLastResult(`${result.output.fileName}을 내려받았습니다.`);
    } catch (error) {
      progress.fail(error instanceof DOMException && error.name === "AbortError" ? "오디오 내보내기를 취소했습니다." : toAudioError(error));
    } finally {
      if (activeControllerRef.current === controller) activeControllerRef.current = undefined;
    }
  };

  const updateZoom = (direction: -1 | 1) => {
    const next = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, zoomIndex + direction));
    setZoomIndex(next);
    wavesurferRef.current?.zoom(ZOOM_LEVELS[next]);
  };

  const togglePlayback = async () => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer) return;
    if (wavesurfer.isPlaying()) {
      wavesurfer.pause();
      return;
    }
    const selected = selectionRef.current;
    if (loop && selected) {
      const position = wavesurfer.getCurrentTime();
      if (position < selected.start || position >= selected.end) wavesurfer.setTime(selected.start);
      await wavesurfer.play(undefined, selected.end);
      return;
    }
    await wavesurfer.play();
  };

  const updateSelectionNumber = (field: "start" | "end", value: number) => {
    if (!document || !selection || !Number.isFinite(value)) return;
    const next = field === "start"
      ? { start: Math.max(0, Math.min(value, selection.end - MIN_SELECTION_SECONDS)), end: selection.end }
      : { start: selection.start, end: Math.min(document.duration, Math.max(value, selection.start + MIN_SELECTION_SECONDS)) };
    showSelectionRegion(next);
  };

  const busy = progress.status === "running";
  const selectionDuration = selection ? Math.max(0, selection.end - selection.start) : 0;
  const pcmSize = useMemo(() => document?.channels.reduce((sum, channel) => sum + channel.byteLength, 0) || 0, [document]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) return;
      if (event.code === "Space" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        if (!documentRef.current || event.repeat) return;
        event.preventDefault();
        void togglePlayback();
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey || busy) return;
      const key = event.key.toLowerCase();
      const direction = key === "y" || (key === "z" && event.shiftKey) ? "redo" : key === "z" ? "undo" : undefined;
      if (!direction) return;
      const available = direction === "undo" ? undoHistory.length > 0 : redoHistory.length > 0;
      if (!available) return;
      event.preventDefault();
      void restoreHistory(direction);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [busy, redoHistory.length, restoreHistory, togglePlayback, undoHistory.length]);

  return (
    <div className="page tool-page page-enter audio-studio-page">
      <PageHeader eyebrow="AUDIO WAVEFORM STUDIO" title="오디오 파형 편집기" description="파형에서 구간을 선택해 음소거·잘라내기·복사·붙여넣기하고 WAV 또는 MP3로 저장하세요.">
        <PrivacyBanner compact />
      </PageHeader>

      <SectionCard step={1} title="오디오 파일 선택" description="한 번에 한 파일을 편집합니다. 새 파일을 선택하면 이전 파형·Undo 기록·오디오 클립보드를 정리합니다.">
        <FileDropZone files={files} onFiles={handleFiles} accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" hint="MP3·WAV·M4A·AAC·OGG · 브라우저 지원 코덱" accent="violet" />
        <div className="inline-notice"><AlertTriangle size={16} /><span>M4A·AAC·OGG는 브라우저와 내부 코덱에 따라 열리지 않을 수 있습니다. 긴 무압축 오디오는 PCM 편집 데이터와 Undo 기록 때문에 메모리를 많이 사용하므로 필요한 길이의 파일부터 작업하세요.</span></div>
        {document && (
          <div className="audio-file-summary">
            <FileAudio2 size={21} />
            <span><strong>{document.sourceName}</strong><small>{formatAudioTime(document.duration)} · {document.channels.length}채널 · {document.sampleRate.toLocaleString()}Hz · 편집 PCM {formatBytes(pcmSize)}</small></span>
          </div>
        )}
      </SectionCard>

      {document && (
        <SectionCard step={2} title="파형 선택과 편집" description="파형의 빈 영역을 드래그해 한 구간을 만들고, 양쪽 손잡이로 시작과 끝을 정밀하게 조절하세요.">
          <div className="audio-waveform-toolbar">
            <span><Waves size={18} /><strong>고해상도 파형</strong><small>{ZOOM_LEVELS[zoomIndex]} px/초</small></span>
            <div>
              <button type="button" aria-label="파형 축소" disabled={zoomIndex === 0} onClick={() => updateZoom(-1)}><ZoomOut size={18} /></button>
              <button type="button" aria-label="파형 확대" disabled={zoomIndex === ZOOM_LEVELS.length - 1} onClick={() => updateZoom(1)}><ZoomIn size={18} /></button>
            </div>
          </div>
          <div className="audio-waveform-shell">
            <div className="audio-waveform" ref={waveformContainerRef} />
          </div>

          <div className="audio-selection-panel">
            <label><span>선택 시작 (초)</span><input type="number" min={0} max={selection?.end || document.duration} step="0.001" value={(selection?.start || 0).toFixed(3)} onChange={(event) => updateSelectionNumber("start", Number(event.target.value))} /></label>
            <div><small>선택 길이</small><strong>{formatAudioTime(selectionDuration)}</strong></div>
            <label><span>선택 종료 (초)</span><input type="number" min={selection?.start || 0} max={document.duration} step="0.001" value={(selection?.end || 0).toFixed(3)} onChange={(event) => updateSelectionNumber("end", Number(event.target.value))} /></label>
          </div>

          <div className="audio-transport">
            <button type="button" aria-label="처음으로 이동" onClick={() => wavesurferRef.current?.setTime(0)}><SkipBack size={20} /></button>
            <button type="button" className="audio-play-button" aria-label={isPlaying ? "일시정지" : "재생"} aria-keyshortcuts="Space" onClick={() => void togglePlayback()}>{isPlaying ? <Pause size={22} /> : <Play size={22} />}</button>
            <div className="audio-timecode"><strong>{formatAudioTime(currentTime)}</strong><span>/</span><small>{formatAudioTime(document.duration)}</small></div>
            <div className="audio-loop-control"><Repeat2 size={17} /><ToggleRow label="선택 구간 반복" checked={loop} onChange={setLoop} /></div>
          </div>

          <div className="audio-edit-toolbar" aria-label="오디오 편집 도구">
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("MUTE")}><VolumeX size={18} /><span>구간 음소거</span></button>
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("CUT")}><Scissors size={18} /><span>잘라내기</span></button>
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("COPY")}><Copy size={18} /><span>복사</span></button>
            <button type="button" disabled={busy || !clipboard} onClick={() => void applyEdit("PASTE")}><ClipboardPaste size={18} /><span>커서에 붙여넣기</span></button>
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("DELETE")}><Trash2 size={18} /><span>구간 삭제</span></button>
            <button type="button" aria-keyshortcuts="Control+Z Meta+Z" disabled={busy || !undoHistory.length} onClick={() => void restoreHistory("undo")}><Undo2 size={18} /><span>실행 취소</span><small>{undoHistory.length}</small></button>
            <button type="button" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y" disabled={busy || !redoHistory.length} onClick={() => void restoreHistory("redo")}><Redo2 size={18} /><span>다시 실행</span><small>{redoHistory.length}</small></button>
          </div>
          <div className={`audio-clipboard-status${clipboard ? " has-clip" : ""}`}><ClipboardCopy size={17} /><span>{clipboard ? `오디오 클립보드: ${formatAudioTime(clipboard.duration)} · ${clipboard.channels.length}채널` : "복사하거나 잘라낸 구간은 이 페이지의 메모리에만 보관됩니다."}</span></div>
        </SectionCard>
      )}

      {document && (
        <SectionCard step={3} title="오디오 내보내기" description="WAV는 편집 샘플을 바로 저장하고, MP3는 자체 호스팅 FFmpeg 인코더를 필요할 때만 불러옵니다.">
          <div className="audio-export-settings">
            <SegmentedControl value={exportFormat} options={[{ value: "wav", label: "WAV · 무손실" }, { value: "mp3", label: "MP3 · 작은 용량" }]} onChange={setExportFormat} label="오디오 출력 형식" />
            {exportFormat === "mp3" && <label><span>MP3 비트레이트</span><select value={mp3Bitrate} onChange={(event) => setMp3Bitrate(Number(event.target.value) as 128 | 192 | 256 | 320)}><option value={128}>128 kbps</option><option value={192}>192 kbps · 권장</option><option value={256}>256 kbps</option><option value={320}>320 kbps</option></select></label>}
          </div>
          {exportFormat === "mp3" && <div className="inline-notice warning"><AlertTriangle size={16} /><span>MP3를 처음 만들 때 같은 사이트의 FFmpeg 실행 파일을 내려받습니다. 실행 파일이 브라우저 캐시에 없는 완전한 오프라인 상태에서는 MP3 내보내기를 시작할 수 없으며, WAV 내보내기는 별도 인코더 없이 동작합니다.</span></div>}
          <div className="section-actions"><PrimaryButton accent="violet" disabled={busy} loading={busy} onClick={() => void exportAudio()}><Download size={18} /> {exportFormat.toUpperCase()}로 내보내기</PrimaryButton></div>
        </SectionCard>
      )}

      <OperationProgress {...progress} accent="violet" title="오디오 처리 로그" />
      {busy && <div className="cancel-operation"><button type="button" className="secondary-button" onClick={() => { activeControllerRef.current?.abort(); void decodeContextRef.current?.close().catch(() => undefined); }}><LoaderCircle size={16} /> 작업 취소</button></div>}
      {lastResult && <div className="inline-success"><FileAudio2 size={18} /><span>{lastResult}</span></div>}

      <ToolGuide
        title="오디오 파형 편집 안내"
        description="선택한 오디오와 편집 샘플은 외부 서버로 전송하지 않고 현재 브라우저의 Web Audio API와 작업별 Worker에서만 처리합니다."
        blocks={[
          { title: "파형 구간 선택", paragraphs: ["파형을 드래그하면 보라색 선택 영역이 생깁니다. 영역 전체를 옮기거나 양쪽 손잡이를 조절하고, 시작·종료 초 입력으로 1ms 단위 값을 지정할 수 있습니다."] },
          { title: "샘플 단위 편집", paragraphs: ["음소거는 선택 샘플을 0으로 바꾸고, 잘라내기와 삭제는 뒤 샘플을 앞으로 당깁니다. 붙여넣기는 현재 빨간 재생 커서 위치에 메모리 클립을 삽입합니다."] },
          { title: "키보드 단축키", paragraphs: ["입력 칸 밖에서는 Space로 재생·일시정지하고, Ctrl+Z 또는 macOS의 Cmd+Z로 실행 취소합니다. Ctrl+Shift+Z·Cmd+Shift+Z·Ctrl+Y·Cmd+Y는 다시 실행입니다."] },
          { title: "Undo와 메모리", paragraphs: ["편집 상태는 PCM 채널별 Float32Array로 보관합니다. Undo 기록은 파일 크기에 맞춰 최대 12단계, 약 256MB 예산 안에서 자동 제한하며 새 파일을 열면 모두 해제합니다."] },
          { title: "WAV와 MP3", paragraphs: ["WAV는 16-bit PCM으로 빠르게 생성합니다. MP3는 Worklazy Tools에 함께 배포한 FFmpeg WebAssembly를 Worker에서 실행하며 인코딩 후 즉시 종료합니다."] },
          { title: "브라우저 코덱 지원", paragraphs: ["MP3와 WAV는 일반적인 최신 브라우저에서 열 수 있습니다. M4A·AAC·OGG는 운영체제와 브라우저가 내부 코덱을 해석할 수 있을 때 편집할 수 있습니다."] },
        ]}
        faq={[
          { question: "오디오가 서버로 업로드되나요?", answer: "아니요. 파일 디코딩, PCM 편집, 파형 미리보기와 결과 인코딩은 현재 브라우저에서만 실행됩니다." },
          { question: "붙여넣기는 어디에 들어가나요?", answer: "파형을 클릭하거나 재생해 이동한 빨간 재생 커서의 현재 시각에 삽입됩니다. 선택 영역의 시작점이 아니라 재생 커서가 기준입니다." },
          { question: "왜 긴 파일은 메모리를 많이 사용하나요?", answer: "압축 오디오도 편집할 때는 채널별 비압축 PCM 샘플로 풀어야 하고, 파형 재생용 WAV와 Undo 상태도 브라우저 메모리를 사용하기 때문입니다." },
          { question: "MP3가 오프라인에서 바로 만들어지나요?", answer: "이전에 인코더가 캐시되었다면 가능할 수 있습니다. 처음 방문한 완전한 오프라인 상태에서는 실행 파일을 받을 수 없으므로 WAV를 사용해 주세요." },
          { question: "편집 결과가 원본을 덮어쓰나요?", answer: "아니요. 원본 파일은 수정하지 않으며 WAV 또는 MP3 새 파일로 내려받습니다." },
        ]}
      />
    </div>
  );
}

function regionSelection(region: Region): AudioSelection {
  return { start: region.start, end: region.end };
}

function defaultSelection(duration: number): AudioSelection | undefined {
  if (duration < MIN_SELECTION_SECONDS) return undefined;
  return { start: 0, end: Math.min(duration, Math.max(0.1, Math.min(5, duration / 4))) };
}

function clampSelection(selection: AudioSelection | undefined, duration: number) {
  if (!selection || duration < MIN_SELECTION_SECONDS) return undefined;
  const start = Math.max(0, Math.min(selection.start, duration - MIN_SELECTION_SECONDS));
  const end = Math.max(start + MIN_SELECTION_SECONDS, Math.min(selection.end, duration));
  return { start, end };
}

function resultDocument(current: AudioDocumentData, result: AudioProcessorResult): AudioDocumentData {
  if (!result.channels) throw new Error("편집된 오디오 채널이 없습니다.");
  return { ...current, channels: result.channels, length: result.length, duration: result.duration };
}

function selectionAfterEdit(
  command: AudioEditCommand,
  selection: AudioSelection | undefined,
  clipboard: AudioClipboardData | undefined,
  duration: number,
  cursor: number,
) {
  if (command === "MUTE") return clampSelection(selection, duration);
  if (command === "PASTE") return clampSelection({ start: cursor, end: cursor + (clipboard?.duration || 0) }, duration);
  const start = Math.min(selection?.start || 0, Math.max(0, duration - MIN_SELECTION_SECONDS));
  return clampSelection({ start, end: Math.min(duration, start + 1) }, duration);
}

function editLabel(command: AudioEditCommand) {
  return ({ MUTE: "선택 구간 음소거 중…", CUT: "선택 구간 잘라내는 중…", COPY: "선택 구간 복사 중…", PASTE: "재생 커서에 붙여넣는 중…", DELETE: "선택 구간 삭제 중…", PREVIEW: "파형 미리보기 생성 중…" } satisfies Record<AudioEditCommand, string>)[command];
}

function isSupportedAudio(file: File) {
  return file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name);
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"));
}

function formatTimelineLabel(seconds: number) {
  if (seconds >= 3600) return formatAudioTime(seconds).slice(0, 8);
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function toAudioError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/decodeAudioData|Unable to decode|EncodingError/i.test(message)) return "이 브라우저가 오디오 형식 또는 내부 코덱을 해석하지 못했습니다. MP3나 WAV 파일로 변환한 뒤 다시 시도해 주세요.";
  if (/memory|allocation|out of bounds|Array buffer/i.test(message)) return "브라우저 메모리가 부족합니다. 더 짧거나 채널 수가 적은 오디오로 다시 시도해 주세요.";
  return message || "오디오 작업에 실패했습니다.";
}

function downloadAudio(buffer: ArrayBuffer, mimeType: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
