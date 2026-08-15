import {
  AlertTriangle,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  FileAudio2,
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
import { FileDropZone, PageHeader, SectionCard, ToggleRow, formatBytes } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { audioHistoryLimit, createAudioFileName, formatAudioTime } from "./audioHelpers";
import { AudioExportPanel, VoiceEffectPanel, type AudioExportFormat, type VoicePreset } from "./AudioStudioPanels";
import { runAudioProcessor, terminateAudioProcessorSession } from "./audioProcessorClient";
import type { AudioClipboardData, AudioDocumentData, AudioEditCommand, AudioProcessorResult, AudioVoiceEffectSettings } from "./types";
import { useAudioDocument } from "./useAudioDocument";

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
  const { document, documentRef, replaceDocument, prepareDecode, decodeFile, isCurrentDecode, cancelDecode } = useAudioDocument();
  const [selection, setSelection] = useState<AudioSelection>();
  const [clipboard, setClipboard] = useState<AudioClipboardData>();
  const [undoHistory, setUndoHistory] = useState<AudioDocumentData[]>([]);
  const [redoHistory, setRedoHistory] = useState<AudioDocumentData[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [exportFormat, setExportFormat] = useState<AudioExportFormat>("wav");
  const [mp3Bitrate, setMp3Bitrate] = useState<128 | 192 | 256 | 320>(192);
  const [gain, setGain] = useState(1);
  const [exportSelection, setExportSelection] = useState(false);
  const [voicePreset, setVoicePreset] = useState<VoicePreset>("low");
  const [customPitch, setCustomPitch] = useState(0);
  const voicePresetRef = useRef<VoicePreset>("low");
  const customPitchRef = useRef(0);
  const [effectPreviewUrl, setEffectPreviewUrl] = useState("");
  const [lastResult, setLastResult] = useState("");
  const progress = useOperationProgress();
  const failProgress = progress.fail;
  const documentReady = Boolean(document);

  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | undefined>(undefined);
  const regionsRef = useRef<RegionsPlugin | undefined>(undefined);
  const selectionRef = useRef<AudioSelection | undefined>(undefined);
  const loopRef = useRef(false);
  const previewUrlRef = useRef("");
  const effectPreviewUrlRef = useRef("");
  const effectPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeControllerRef = useRef<AbortController | undefined>(undefined);
  const handleFilesRef = useRef<((files: File[]) => Promise<void>) | undefined>(undefined);
  const restoreHistoryRef = useRef<(direction: "undo" | "redo") => Promise<void>>(async () => undefined);
  const togglePlaybackRef = useRef<() => Promise<void>>(async () => undefined);
  const applyEditRef = useRef<(command: AudioEditCommand) => Promise<void>>(async () => undefined);

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
    activeControllerRef.current?.abort();
    terminateAudioProcessorSession();
    cancelDecode();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    if (effectPreviewUrlRef.current) URL.revokeObjectURL(effectPreviewUrlRef.current);
    selectionRef.current = undefined;
  }, [cancelDecode]);

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
    activeControllerRef.current?.abort();
    terminateAudioProcessorSession();
    const generation = await prepareDecode();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreviewUrl("");
    wavesurferRef.current?.empty();
    const controller = new AbortController();
    activeControllerRef.current = controller;
    setFiles([file]);
    setClipboard(undefined);
    setUndoHistory([]);
    setRedoHistory([]);
    setLastResult("");
    clearEffectPreview();
    commitSelection(undefined);
    regionsRef.current?.clearRegions();
    progress.start(t("audio.status.decoding", { name: file.name }));
    try {
      const nextDocument = await decodeFile(file, generation, controller.signal, () => progress.update(22, t("audio.status.webAudio")));
      if (!nextDocument) return;
      const preview = await runAudioProcessor({ command: "PREVIEW", document: nextDocument, language }, (value, message) => progress.update(30 + value * 0.65, message), controller.signal);
      if (!isCurrentDecode(generation)) return;
      if (!preview.previewBlob) throw new Error(t("audio.status.previewRestore"));
      replaceDocument(nextDocument);
      const initialSelection = defaultSelection(nextDocument.duration);
      commitSelection(initialSelection);
      replacePreview(preview.previewBlob);
      progress.succeed(t("audio.status.ready", { name: file.name }));
      setLastResult(`${formatAudioTime(nextDocument.duration)} · ${t("audio.channels", { count: nextDocument.channels.length })} · ${nextDocument.sampleRate.toLocaleString(i18n.language)}Hz`);
    } catch (error) {
      if (isCurrentDecode(generation)) progress.fail(error instanceof DOMException && error.name === "AbortError" ? t("audio.status.cancelled") : toAudioError(error, t));
    } finally {
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
      replaceDocument(nextDocument);
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
      replaceDocument(target);
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

  const voiceEffectSettings = (): AudioVoiceEffectSettings => {
    const preset = voicePresetRef.current;
    return preset === "robot"
      ? { mode: "robot", semitones: 0 }
      : { mode: "pitch", semitones: preset === "custom" ? customPitchRef.current : VOICE_PRESET_PITCH[preset] };
  };

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
      replaceDocument(nextDocument);
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
    const currentSelection = selectionRef.current;
    const shouldExportSelection = exportSelection && Boolean(currentSelection);
    if (exportSelection && !currentSelection) setExportSelection(false);
    const controller = new AbortController();
    activeControllerRef.current = controller;
    const extension = exportFormat;
    const fileName = createAudioFileName(currentDocument.sourceName, extension, t("audio.fileSuffix"));
    progress.start(t("audio.status.exportPrepare", { format: extension.toUpperCase() }));
    setLastResult("");
    try {
      const result = await runAudioProcessor({
        command: exportFormat === "wav" ? "EXPORT_WAV" : "EXPORT_MP3",
        document: currentDocument,
        fileName,
        bitrate: mp3Bitrate,
        start: currentSelection?.start,
        end: currentSelection?.end,
        exportSelection: shouldExportSelection,
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
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("FADE_IN")}><Waves size={18} /><span>{t("audio.edit.FADE_IN")}</span></button>
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("FADE_OUT")}><Waves size={18} /><span>{t("audio.edit.FADE_OUT")}</span></button>
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("NORMALIZE")}><SlidersHorizontal size={18} /><span>{t("audio.edit.NORMALIZE")}</span></button>
            <button type="button" disabled={busy || !selection} onClick={() => void applyEdit("TRIM")}><Scissors size={18} /><span>{t("audio.edit.TRIM")}</span></button>
            <button type="button" aria-keyshortcuts="Control+Z Meta+Z" disabled={busy || !undoHistory.length} onClick={() => void restoreHistory("undo")}><Undo2 size={18} /><span>{t("audio.undo")}</span><small>{undoHistory.length}</small></button>
            <button type="button" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y" disabled={busy || !redoHistory.length} onClick={() => void restoreHistory("redo")}><Redo2 size={18} /><span>{t("audio.redo")}</span><small>{redoHistory.length}</small></button>
          </div>
          <div className="audio-gain-control"><label><span>{t("audio.selectionGain")}</span><input type="range" min={0} max={2} step={0.05} value={gain} onChange={(event) => setGain(Number(event.target.value))} /><b>{gain.toFixed(2)}×</b></label><button type="button" className="secondary-button" disabled={busy || !selection} onClick={() => void applyEdit("GAIN")}>{t("audio.edit.GAIN")}</button></div>

          <VoiceEffectPanel
            busy={busy}
            selectionAvailable={Boolean(selection)}
            voicePreset={voicePreset}
            effectivePitch={effectivePitch}
            onPreset={(preset) => { voicePresetRef.current = preset; setVoicePreset(preset); }}
            onPitch={(value) => { voicePresetRef.current = "custom"; customPitchRef.current = value; setVoicePreset("custom"); setCustomPitch(value); }}
            onPreview={() => void runVoiceEffect(true)}
            onApply={() => void runVoiceEffect(false)}
            previewUrl={effectPreviewUrl}
            audioRef={effectPreviewAudioRef}
          />
          <div className={`audio-clipboard-status${clipboard ? " has-clip" : ""}`}><ClipboardCopy size={17} /><span>{clipboard ? t("audio.clipboard", { duration: formatAudioTime(clipboard.duration), channels: clipboard.channels.length }) : t("audio.clipboardEmpty")}</span></div>
        </SectionCard>
      )}

      {document && <AudioExportPanel format={exportFormat} bitrate={mp3Bitrate} busy={busy} selectionDuration={selection ? selectionDuration : undefined} exportSelection={exportSelection} onFormat={setExportFormat} onBitrate={setMp3Bitrate} onExportSelection={setExportSelection} onExport={() => void exportAudio()} />}

      <OperationProgress {...progress} accent="violet" title={t("audio.log")} />
      {busy && <div className="cancel-operation"><button type="button" className="secondary-button" onClick={() => { cancelDecode(); activeControllerRef.current?.abort(); progress.fail(t("audio.status.cancelled")); }}><LoaderCircle size={16} /> {t("audio.cancel")}</button></div>}
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

function toAudioError(error: unknown, t: TFunction<"features">) {
  const message = error instanceof Error ? error.message : String(error);
  if (/decodeAudioData|Unable to decode|EncodingError/i.test(message)) return t("audio.errors.decode");
  if (/memory|allocation|out of bounds|Array buffer/i.test(message)) return t("audio.errors.memory");
  return message || t("audio.errors.generic");
}

function downloadAudio(buffer: ArrayBuffer, mimeType: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
