import {
  AlertTriangle,
  Bot,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  Download,
  FileAudio2,
  Headphones,
  LoaderCircle,
  Pause,
  Play,
  Redo2,
  Repeat2,
  Scissors,
  SlidersHorizontal,
  SkipBack,
  Trash2,
  Undo2,
  VolumeX,
  WandSparkles,
  Waves,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/dist/plugins/regions.esm.js";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline.esm.js";

import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { FileDropZone, PageHeader, PrimaryButton, SectionCard, SegmentedControl, ToggleRow, formatBytes } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { audioBufferToDocument, audioHistoryLimit, createAudioFileName, formatAudioTime, sniffAudioSampleRate } from "./audioHelpers";
import { runAudioProcessor, terminateAudioProcessorSession } from "./audioProcessorClient";
import type { AudioClipboardData, AudioDocumentData, AudioEditCommand, AudioProcessorResult, AudioVoiceEffectSettings } from "./types";

type ExportFormat = "wav" | "mp3";
type VoicePreset = "low" | "high" | "child" | "robot" | "custom";

interface AudioSelection {
  start: number;
  end: number;
}

const MIN_SELECTION_SECONDS = 0.01;
const ZOOM_LEVELS = [12, 24, 48, 96, 180, 300] as const;
const VOICE_PRESET_PITCH: Record<Exclude<VoicePreset, "robot" | "custom">, number> = { low: -4, high: 4, child: 7 };

export function AudioStudioPage() {
  const { t, i18n } = useTranslation("features");
  const language = i18n.language === "en" ? "en" : "ko";
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
  const [gain, setGain] = useState(1);
  const [exportSelection, setExportSelection] = useState(false);
  const [voicePreset, setVoicePreset] = useState<VoicePreset>("low");
  const [customPitch, setCustomPitch] = useState(0);
  const [effectPreviewUrl, setEffectPreviewUrl] = useState("");
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
  const effectPreviewUrlRef = useRef("");
  const effectPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const decodeContextRef = useRef<AudioContext | undefined>(undefined);
  const activeControllerRef = useRef<AbortController | undefined>(undefined);
  const loadGenerationRef = useRef(0);
  const handleFilesRef = useRef<((files: File[]) => Promise<void>) | undefined>(undefined);
  const restoreHistoryRef = useRef<(direction: "undo" | "redo") => Promise<void>>(async () => undefined);
  const togglePlaybackRef = useRef<() => Promise<void>>(async () => undefined);
  const applyEditRef = useRef<(command: AudioEditCommand) => Promise<void>>(async () => undefined);

  useEffect(() => { documentRef.current = document; }, [document]);
  useEffect(() => { selectionRef.current = selection; }, [selection]);
  useEffect(() => { loopRef.current = loop; }, [loop]);

  const clearEffectPreview = useCallback(() => {
    effectPreviewAudioRef.current?.pause();
    effectPreviewAudioRef.current = null;
    const previousUrl = effectPreviewUrlRef.current;
    effectPreviewUrlRef.current = "";
    setEffectPreviewUrl("");
    if (previousUrl) URL.revokeObjectURL(previousUrl);
  }, []);

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
      if (isExpectedMediaAbort(error)) return;
      failProgress(t("audio.status.waveOpen", { error: error.message }));
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
  }, [commitSelection, documentReady, failProgress, showSelectionRegion, t]);

  useEffect(() => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !previewUrl) return;
    void wavesurfer.load(previewUrl).catch((error) => {
      if (isExpectedMediaAbort(error)) return;
      failProgress(t("audio.status.waveDisplay", { error: error instanceof Error ? error.message : String(error) }));
    });
  }, [failProgress, previewUrl, t]);

  useEffect(() => () => {
    loadGenerationRef.current += 1;
    activeControllerRef.current?.abort();
    terminateAudioProcessorSession();
    void decodeContextRef.current?.close().catch(() => undefined);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    if (effectPreviewUrlRef.current) URL.revokeObjectURL(effectPreviewUrlRef.current);
    documentRef.current = undefined;
    selectionRef.current = undefined;
  }, []);

  useEffect(() => {
    clearEffectPreview();
  }, [clearEffectPreview, customPitch, selection?.end, selection?.start, voicePreset]);

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
      progress.start(t("audio.status.checking"));
      progress.fail(t("audio.status.unsupported"));
      return;
    }
    const generation = ++loadGenerationRef.current;
    activeControllerRef.current?.abort();
    await decodeContextRef.current?.close().catch(() => undefined);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreviewUrl("");
    wavesurferRef.current?.empty();
    const controller = new AbortController();
    activeControllerRef.current = controller;
    setFiles([file]);
    setDocument(undefined);
    documentRef.current = undefined;
    setClipboard(undefined);
    setUndoHistory([]);
    setRedoHistory([]);
    setLastResult("");
    clearEffectPreview();
    commitSelection(undefined);
    regionsRef.current?.clearRegions();
    progress.start(t("audio.status.decoding", { name: file.name }));
    let context: AudioContext | undefined;
    try {
      const sourceBytes = await file.arrayBuffer();
      if (controller.signal.aborted || generation !== loadGenerationRef.current) return;
      const sourceSampleRate = sniffAudioSampleRate(sourceBytes, file.name);
      context = new AudioContext(sourceSampleRate ? { sampleRate: sourceSampleRate } : undefined);
      decodeContextRef.current = context;
      progress.update(22, t("audio.status.webAudio"));
      const decoded = await context.decodeAudioData(sourceBytes);
      if (controller.signal.aborted || generation !== loadGenerationRef.current) return;
      const nextDocument = audioBufferToDocument(decoded, file.name);
      const preview = await runAudioProcessor({ command: "PREVIEW", document: nextDocument, language }, (value, message) => progress.update(30 + value * 0.65, message), controller.signal);
      if (generation !== loadGenerationRef.current) return;
      if (!preview.previewBlob) throw new Error(t("audio.status.previewRestore"));
      documentRef.current = nextDocument;
      setDocument(nextDocument);
      const initialSelection = defaultSelection(nextDocument.duration);
      commitSelection(initialSelection);
      replacePreview(preview.previewBlob);
      progress.succeed(t("audio.status.ready", { name: file.name }));
      setLastResult(`${formatAudioTime(nextDocument.duration)} · ${t("audio.channels", { count: nextDocument.channels.length })} · ${nextDocument.sampleRate.toLocaleString(i18n.language)}Hz`);
    } catch (error) {
      if (generation === loadGenerationRef.current) progress.fail(error instanceof DOMException && error.name === "AbortError" ? t("audio.status.cancelled") : toAudioError(error, t));
    } finally {
      if (decodeContextRef.current === context) decodeContextRef.current = undefined;
      await context?.close().catch(() => undefined);
      if (activeControllerRef.current === controller) activeControllerRef.current = undefined;
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
      progress.start(t("audio.status.selecting"));
      progress.fail(t("audio.status.selectRegion"));
      return;
    }
    if (command === "PASTE" && !clipboard) {
      progress.start(t("audio.status.checkingClipboard"));
      progress.fail(t("audio.status.copyFirst"));
      return;
    }
    const controller = new AbortController();
    activeControllerRef.current = controller;
    const editCursor = wavesurferRef.current?.getCurrentTime() || 0;
    if (command === "PASTE") wavesurferRef.current?.pause();
    progress.start(editLabel(command, t));
    setLastResult("");
    try {
      const result = await runAudioProcessor({
        command,
        document: currentDocument,
        start: currentSelection?.start,
        end: currentSelection?.end,
        cursor: editCursor,
        clipboard,
        gain,
        language,
      }, progress.update, controller.signal);
      if (command === "COPY") {
        if (result.clipboard) setClipboard(result.clipboard);
        progress.succeed(t("audio.status.copied", { duration: formatAudioTime(result.clipboard?.duration || 0) }));
        return;
      }
      if (!result.channels || !result.previewBlob) throw new Error(t("audio.status.missingResult"));
      const nextDocument = resultDocument(currentDocument, result);
      const limit = audioHistoryLimit(currentDocument);
      setUndoHistory((history) => [...history, { ...currentDocument, selection: currentSelection }].slice(-limit));
      setRedoHistory([]);
      if (result.clipboard) setClipboard(result.clipboard);
      documentRef.current = nextDocument;
      setDocument(nextDocument);
      const nextSelection = selectionAfterEdit(command, currentSelection, clipboard, nextDocument.duration, editCursor);
      commitSelection(nextSelection);
      replacePreview(result.previewBlob);
      progress.succeed(t("audio.status.done", { action: editLabel(command, t).replace("…", "") }));
      setLastResult(t("audio.status.edited", { duration: formatAudioTime(nextDocument.duration), count: Math.min(undoHistory.length + 1, limit) }));
    } catch (error) {
      progress.fail(error instanceof DOMException && error.name === "AbortError" ? t("audio.status.cancelled") : toAudioError(error, t));
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
    progress.start(direction === "undo" ? t("audio.status.restoringUndo") : t("audio.status.restoringRedo"));
    try {
      const result = await runAudioProcessor({ command: "PREVIEW", document: target, language }, progress.update, controller.signal);
      if (!result.previewBlob) throw new Error(t("audio.status.previewRestore"));
      if (direction === "undo") {
        setUndoHistory((history) => history.slice(0, -1));
        setRedoHistory((history) => [...history, currentDocument].slice(-audioHistoryLimit(currentDocument)));
      } else {
        setRedoHistory((history) => history.slice(0, -1));
        setUndoHistory((history) => [...history, currentDocument].slice(-audioHistoryLimit(currentDocument)));
      }
      documentRef.current = target;
      setDocument(target);
      commitSelection(clampSelection(target.selection, target.duration) || defaultSelection(target.duration));
      replacePreview(result.previewBlob);
      progress.succeed(direction === "undo" ? t("audio.status.undoDone") : t("audio.status.redoDone"));
      setLastResult(t("audio.status.state", { direction: direction === "undo" ? t("audio.status.previous") : t("audio.status.next"), duration: formatAudioTime(target.duration) }));
    } catch (error) {
      progress.fail(toAudioError(error, t));
    } finally {
      if (activeControllerRef.current === controller) activeControllerRef.current = undefined;
    }
  };

  const voiceEffectSettings = (): AudioVoiceEffectSettings => voicePreset === "robot"
    ? { mode: "robot", semitones: 0 }
    : { mode: "pitch", semitones: voicePreset === "custom" ? customPitch : VOICE_PRESET_PITCH[voicePreset] };

  const runVoiceEffect = async (previewOnly: boolean) => {
    const currentDocument = documentRef.current;
    const currentSelection = selectionRef.current;
    if (!currentDocument) return;
    if (!currentSelection || currentSelection.end - currentSelection.start < MIN_SELECTION_SECONDS) {
      progress.start(t("audio.status.selecting"));
      progress.fail(t("audio.status.selectRegion"));
      return;
    }
    clearEffectPreview();
    wavesurferRef.current?.pause();
    const controller = new AbortController();
    activeControllerRef.current = controller;
    progress.start(previewOnly ? t("audio.voice.status.previewing") : t("audio.voice.status.applying"));
    setLastResult("");
    try {
      const result = await runAudioProcessor({
        command: previewOnly ? "PREVIEW_VOICE_EFFECT" : "APPLY_VOICE_EFFECT",
        document: currentDocument,
        start: currentSelection.start,
        end: currentSelection.end,
        voiceEffect: voiceEffectSettings(),
        language,
      }, progress.update, controller.signal);
      if (previewOnly) {
        if (!result.previewBlob) throw new Error(t("audio.voice.status.previewMissing"));
        const url = URL.createObjectURL(result.previewBlob);
        effectPreviewUrlRef.current = url;
        setEffectPreviewUrl(url);
        progress.succeed(t("audio.voice.status.previewReady"));
        setLastResult(t("audio.voice.status.previewLength", { duration: formatAudioTime(result.duration) }));
        window.requestAnimationFrame(() => void effectPreviewAudioRef.current?.play().catch(() => undefined));
        return;
      }
      if (!result.channels || !result.previewBlob) throw new Error(t("audio.status.missingResult"));
      const nextDocument = resultDocument(currentDocument, result);
      const limit = audioHistoryLimit(currentDocument);
      setUndoHistory((history) => [...history, currentDocument].slice(-limit));
      setRedoHistory([]);
      documentRef.current = nextDocument;
      setDocument(nextDocument);
      commitSelection(clampSelection(currentSelection, nextDocument.duration));
      replacePreview(result.previewBlob);
      progress.succeed(t("audio.voice.status.applied"));
      setLastResult(t("audio.voice.status.appliedResult", { duration: formatAudioTime(currentSelection.end - currentSelection.start), count: Math.min(undoHistory.length + 1, limit) }));
    } catch (error) {
      progress.fail(error instanceof DOMException && error.name === "AbortError" ? t("audio.status.cancelled") : toAudioError(error, t));
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
    const fileName = createAudioFileName(currentDocument.sourceName, extension, language);
    progress.start(t("audio.status.exportPrepare", { format: extension.toUpperCase() }));
    setLastResult("");
    try {
      const result = await runAudioProcessor({
        command: exportFormat === "wav" ? "EXPORT_WAV" : "EXPORT_MP3",
        document: currentDocument,
        fileName,
        bitrate: mp3Bitrate,
        start: selectionRef.current?.start,
        end: selectionRef.current?.end,
        exportSelection,
        language,
      }, progress.update, controller.signal);
      if (!result.output) throw new Error(t("audio.status.missingFile"));
      downloadAudio(result.output.buffer, result.output.mimeType, result.output.fileName);
      progress.succeed(t("audio.status.created", { name: result.output.fileName }));
      setLastResult(t("audio.status.downloaded", { name: result.output.fileName }));
    } catch (error) {
      progress.fail(error instanceof DOMException && error.name === "AbortError" ? t("audio.status.exportCancelled") : toAudioError(error, t));
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

  restoreHistoryRef.current = restoreHistory;
  togglePlaybackRef.current = togglePlayback;
  applyEditRef.current = applyEdit;

  const busy = progress.status === "running";
  const selectionDuration = selection ? Math.max(0, selection.end - selection.start) : 0;
  const effectivePitch = voicePreset === "custom" ? customPitch : voicePreset === "robot" ? 0 : VOICE_PRESET_PITCH[voicePreset];
  const pcmSize = useMemo(() => document?.channels.reduce((sum, channel) => sum + channel.byteLength, 0) || 0, [document]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) return;
      if (event.code === "Space" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        if (!documentRef.current || event.repeat) return;
        event.preventDefault();
        void togglePlaybackRef.current();
        return;
      }
      if (event.key === "Delete" && !busy && selectionRef.current) {
        event.preventDefault();
        void applyEditRef.current("DELETE");
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey || busy) return;
      const key = event.key.toLowerCase();
      if (key === "c" && selectionRef.current) { event.preventDefault(); void applyEditRef.current("COPY"); return; }
      if (key === "x" && selectionRef.current) { event.preventDefault(); void applyEditRef.current("CUT"); return; }
      if (key === "v" && clipboard) { event.preventDefault(); void applyEditRef.current("PASTE"); return; }
      const direction = key === "y" || (key === "z" && event.shiftKey) ? "redo" : key === "z" ? "undo" : undefined;
      if (!direction) return;
      const available = direction === "undo" ? undoHistory.length > 0 : redoHistory.length > 0;
      if (!available) return;
      event.preventDefault();
      void restoreHistoryRef.current(direction);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [busy, clipboard, redoHistory.length, undoHistory.length]);

  return (
    <div className="page tool-page page-enter audio-studio-page">
      <PageHeader eyebrow="AUDIO WAVEFORM STUDIO" title={t("audio.title")} description={t("audio.description")}>
        <PrivacyBanner compact />
      </PageHeader>

      <SectionCard step={1} title={t("audio.select")} description={t("audio.selectHelp")}>
        <FileDropZone files={files} onFiles={handleFiles} accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" hint={t("audio.hint")} accent="violet" />
        <div className="inline-notice"><AlertTriangle size={16} /><span>{t("audio.compatibility")}</span></div>
        {document && (
          <div className="audio-file-summary">
            <FileAudio2 size={21} />
            <span><strong>{document.sourceName}</strong><small>{formatAudioTime(document.duration)} · {t("audio.channels", { count: document.channels.length })} · {document.sampleRate.toLocaleString(i18n.language)}Hz · {t("audio.memory", { size: formatBytes(pcmSize) })}</small></span>
          </div>
        )}
      </SectionCard>

      {document && (
        <SectionCard step={2} title={t("audio.waveTitle")} description={t("audio.waveHelp")}>
          <div className="audio-waveform-toolbar">
            <span><Waves size={18} /><strong>{t("audio.highResolution")}</strong><small>{t("audio.pxSecond", { count: ZOOM_LEVELS[zoomIndex] })}</small></span>
            <div>
              <button type="button" aria-label={t("audio.zoomOut")} disabled={zoomIndex === 0} onClick={() => updateZoom(-1)}><ZoomOut size={18} /></button>
              <button type="button" aria-label={t("audio.zoomIn")} disabled={zoomIndex === ZOOM_LEVELS.length - 1} onClick={() => updateZoom(1)}><ZoomIn size={18} /></button>
            </div>
          </div>
          <div className="audio-waveform-shell">
            <div className="audio-waveform" ref={waveformContainerRef} />
          </div>

          <div className="audio-selection-panel">
            <label><span>{t("audio.start")}</span><AudioSelectionInput value={selection?.start || 0} min={0} max={(selection?.end || document.duration) - MIN_SELECTION_SECONDS} onCommit={(value) => updateSelectionNumber("start", value)} /></label>
            <div><small>{t("audio.duration")}</small><strong>{formatAudioTime(selectionDuration)}</strong></div>
            <label><span>{t("audio.end")}</span><AudioSelectionInput value={selection?.end || 0} min={(selection?.start || 0) + MIN_SELECTION_SECONDS} max={document.duration} onCommit={(value) => updateSelectionNumber("end", value)} /></label>
          </div>

          <div className="audio-transport">
            <button type="button" aria-label={t("audio.rewind")} onClick={() => wavesurferRef.current?.setTime(0)}><SkipBack size={20} /></button>
            <button type="button" className="audio-play-button" aria-label={isPlaying ? t("audio.pause") : t("audio.play")} aria-keyshortcuts="Space" onClick={() => void togglePlayback()}>{isPlaying ? <Pause size={22} /> : <Play size={22} />}</button>
            <div className="audio-timecode"><strong>{formatAudioTime(currentTime)}</strong><span>/</span><small>{formatAudioTime(document.duration)}</small></div>
            <div className="audio-loop-control"><Repeat2 size={17} /><ToggleRow label={t("audio.loop")} checked={loop} onChange={setLoop} /></div>
          </div>

          <div className="audio-edit-toolbar" aria-label={t("audio.toolbar")}>
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("MUTE")}><VolumeX size={18} /><span>{t("audio.mute")}</span></button>
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("CUT")}><Scissors size={18} /><span>{t("audio.cut")}</span></button>
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("COPY")}><Copy size={18} /><span>{t("audio.copy")}</span></button>
            <button type="button" disabled={busy || !clipboard} onClick={() => void applyEdit("PASTE")}><ClipboardPaste size={18} /><span>{t("audio.paste")}</span></button>
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("DELETE")}><Trash2 size={18} /><span>{t("audio.delete")}</span></button>
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("FADE_IN")}><Waves size={18} /><span>{language === "ko" ? "페이드 인" : "Fade in"}</span></button>
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("FADE_OUT")}><Waves size={18} /><span>{language === "ko" ? "페이드 아웃" : "Fade out"}</span></button>
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("NORMALIZE")}><SlidersHorizontal size={18} /><span>{language === "ko" ? "피크 정규화" : "Normalize peak"}</span></button>
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("TRIM")}><Scissors size={18} /><span>{language === "ko" ? "선택만 남기기" : "Trim to selection"}</span></button>
            <button type="button" aria-keyshortcuts="Control+Z Meta+Z" disabled={busy || !undoHistory.length} onClick={() => void restoreHistory("undo")}><Undo2 size={18} /><span>{t("audio.undo")}</span><small>{undoHistory.length}</small></button>
            <button type="button" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y" disabled={busy || !redoHistory.length} onClick={() => void restoreHistory("redo")}><Redo2 size={18} /><span>{t("audio.redo")}</span><small>{redoHistory.length}</small></button>
          </div>
          <div className="audio-gain-control"><label><span>{language === "ko" ? "선택 구간 음량" : "Selection gain"}</span><input type="range" min={0} max={2} step={0.05} value={gain} onChange={(event) => setGain(Number(event.target.value))} /><b>{gain.toFixed(2)}×</b></label><button type="button" className="secondary-button" disabled={busy || !selection} onClick={() => void applyEdit("GAIN")}>{language === "ko" ? "음량 적용" : "Apply gain"}</button></div>

          <div className="audio-voice-effect-panel">
            <div className="audio-voice-effect-heading">
              <span><WandSparkles size={19} /><span><strong>{t("audio.voice.title")}</strong><small>{t("audio.voice.description")}</small></span></span>
              <b>{voicePreset === "robot" ? t("audio.voice.robotValue") : t("audio.voice.semitones", { count: effectivePitch })}</b>
            </div>
            <div className="audio-voice-presets" role="radiogroup" aria-label={t("audio.voice.presetsLabel")}>
              {(["low", "high", "child", "robot", "custom"] as const).map((preset) => (
                <button key={preset} type="button" role="radio" aria-checked={voicePreset === preset} className={voicePreset === preset ? "active" : ""} disabled={busy} onClick={() => setVoicePreset(preset)}>
                  {preset === "robot" && <Bot size={17} />}{t(`audio.voice.presets.${preset}`)}
                </button>
              ))}
            </div>
            <label className={`audio-pitch-control${voicePreset === "robot" ? " is-disabled" : ""}`}>
              <span><SlidersHorizontal size={17} /> {t("audio.voice.pitch")}</span>
              <input type="range" min={-12} max={12} step={1} disabled={busy || voicePreset === "robot"} value={effectivePitch} onChange={(event) => { setVoicePreset("custom"); setCustomPitch(Number(event.target.value)); }} />
              <output>{voicePreset === "robot" ? "—" : `${effectivePitch > 0 ? "+" : ""}${effectivePitch}`}</output>
            </label>
            <div className="inline-notice"><AlertTriangle size={16} /><span>{t("audio.voice.notice")}</span></div>
            <div className="audio-voice-effect-actions">
              <button type="button" className="secondary-button" disabled={busy || !selection} onClick={() => void runVoiceEffect(true)}><Headphones size={17} /> {t("audio.voice.preview")}</button>
              <PrimaryButton accent="violet" disabled={busy || !selection} loading={busy} onClick={() => void runVoiceEffect(false)}><WandSparkles size={17} /> {t("audio.voice.apply")}</PrimaryButton>
            </div>
            {effectPreviewUrl && <div className="audio-effect-preview"><span>{t("audio.voice.previewPlayer")}</span><audio ref={effectPreviewAudioRef} src={effectPreviewUrl} controls preload="auto" /></div>}
          </div>
          <div className={`audio-clipboard-status${clipboard ? " has-clip" : ""}`}><ClipboardCopy size={17} /><span>{clipboard ? t("audio.clipboard", { duration: formatAudioTime(clipboard.duration), channels: clipboard.channels.length }) : t("audio.clipboardEmpty")}</span></div>
        </SectionCard>
      )}

      {document && (
        <SectionCard step={3} title={t("audio.exportTitle")} description={t("audio.exportHelp")}>
          <div className="audio-export-settings">
            <SegmentedControl value={exportFormat} options={[{ value: "wav", label: t("audio.wav") }, { value: "mp3", label: t("audio.mp3") }]} onChange={setExportFormat} label={t("audio.format")} />
            {exportFormat === "mp3" && <label><span>{t("audio.bitrate")}</span><select value={mp3Bitrate} onChange={(event) => setMp3Bitrate(Number(event.target.value) as 128 | 192 | 256 | 320)}><option value={128}>128 kbps</option><option value={192}>192 kbps · {t("audio.recommended")}</option><option value={256}>256 kbps</option><option value={320}>320 kbps</option></select></label>}
          </div>
          <ToggleRow label={language === "ko" ? "선택 구간만 내보내기" : "Export selection only"} description={selection ? formatAudioTime(selectionDuration) : undefined} checked={exportSelection} onChange={setExportSelection} disabled={!selection} />
          {exportFormat === "mp3" && <div className="inline-notice warning"><AlertTriangle size={16} /><span>{t("audio.offline")}</span></div>}
          <div className="section-actions"><PrimaryButton accent="violet" disabled={busy} loading={busy} onClick={() => void exportAudio()}><Download size={18} /> {t("audio.export", { format: exportFormat.toUpperCase() })}</PrimaryButton></div>
        </SectionCard>
      )}

      <OperationProgress {...progress} accent="violet" title={t("audio.log")} />
      {busy && <div className="cancel-operation"><button type="button" className="secondary-button" onClick={() => { loadGenerationRef.current += 1; activeControllerRef.current?.abort(); void decodeContextRef.current?.close().catch(() => undefined); progress.fail(t("audio.status.cancelled")); }}><LoaderCircle size={16} /> {t("audio.cancel")}</button></div>}
      {lastResult && <div className="inline-success"><FileAudio2 size={18} /><span>{lastResult}</span></div>}

      <ToolGuide
        title={t("audio.guide.title")}
        description={t("audio.guide.description")}
        blocks={(t("audio.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))}
        faq={(t("audio.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))}
      />
    </div>
  );
}

function regionSelection(region: Region): AudioSelection {
  return { start: region.start, end: region.end };
}

function AudioSelectionInput({ value, min, max, onCommit }: { value: number; min: number; max: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(() => value.toFixed(3));
  useEffect(() => setDraft(value.toFixed(3)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value;
    setDraft(next.toFixed(3));
    onCommit(next);
  };
  return <input type="number" min={min} max={max} step="0.001" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(value.toFixed(3)); event.currentTarget.blur(); } }} />;
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
  if (!result.channels) throw new Error("Edited audio channels are missing.");
  return { ...current, channels: result.channels, length: result.length, duration: result.duration };
}

function selectionAfterEdit(
  command: AudioEditCommand,
  selection: AudioSelection | undefined,
  clipboard: AudioClipboardData | undefined,
  duration: number,
  cursor: number,
) {
  if (["MUTE", "FADE_IN", "FADE_OUT", "GAIN", "NORMALIZE"].includes(command)) return clampSelection(selection, duration);
  if (command === "TRIM") return duration >= MIN_SELECTION_SECONDS ? { start: 0, end: duration } : undefined;
  if (command === "PASTE") return clampSelection({ start: cursor, end: cursor + (clipboard?.duration || 0) }, duration);
  const start = Math.min(selection?.start || 0, Math.max(0, duration - MIN_SELECTION_SECONDS));
  return clampSelection({ start, end: Math.min(duration, start + 1) }, duration);
}

function editLabel(command: AudioEditCommand, t: TFunction<"features">) {
  const keys = {
    MUTE: "audio.edit.MUTE", CUT: "audio.edit.CUT", COPY: "audio.edit.COPY", PASTE: "audio.edit.PASTE", DELETE: "audio.edit.DELETE", PREVIEW: "audio.edit.PREVIEW",
    FADE_IN: "audio.edit.FADE_IN", FADE_OUT: "audio.edit.FADE_OUT", GAIN: "audio.edit.GAIN", NORMALIZE: "audio.edit.NORMALIZE", TRIM: "audio.edit.TRIM",
  } as const satisfies Record<AudioEditCommand, string>;
  return t(keys[command]);
}

function isSupportedAudio(file: File) {
  return file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name);
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"));
}

function isExpectedMediaAbort(error: unknown) {
  return (error instanceof DOMException && error.name === "AbortError") || /(?:user aborted|request was aborted)/i.test(error instanceof Error ? error.message : String(error));
}

function formatTimelineLabel(seconds: number) {
  if (seconds >= 3600) return formatAudioTime(seconds).slice(0, 8);
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function toAudioError(error: unknown, t: (key: never) => string) {
  const message = error instanceof Error ? error.message : String(error);
  if (/decodeAudioData|Unable to decode|EncodingError/i.test(message)) return t("audio.errors.decode" as never);
  if (/memory|allocation|out of bounds|Array buffer/i.test(message)) return t("audio.errors.memory" as never);
  return message || t("audio.errors.generic" as never);
}

function downloadAudio(buffer: ArrayBuffer, mimeType: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
