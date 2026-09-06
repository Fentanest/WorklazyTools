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
import { UtilityField, UtilityInput, UtilityNotice, UtilityPage, UtilitySectionCard } from "../../components/UtilitySurface";
import { FileDropZone, PageHeader, ToggleRow, formatBytes } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
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
  const [audioFailure, setAudioFailure] = useState("");
  const progress = useOperationProgress();
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
    let regions: RegionsPlugin | undefined;
    let timeline: TimelinePlugin | undefined;
    let wavesurfer: WaveSurfer;
    try {
      regions = RegionsPlugin.create();
      timeline = TimelinePlugin.create({
        height: 28,
        style: { color: "#777783", fontSize: "12px" },
        formatTimeCallback: (seconds) => formatTimelineLabel(seconds),
      });
      wavesurfer = WaveSurfer.create({
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
    } catch (error) {
      // React catches effect errors at the route boundary. Release partial setup.
      timeline?.destroy();
      regions?.destroy();
      throw error;
    }
    wavesurferRef.current = wavesurfer;
    regionsRef.current = regions;
    const activeRegions = regions;
    const disableDragSelection = regions.enableDragSelection({
      color: "rgba(139, 92, 246, 0.22)",
      drag: true,
      resize: true,
      minLength: MIN_SELECTION_SECONDS,
    }, 4);
    const unsubscribeCreated = regions.on("region-created", (region) => {
      activeRegions.getRegions().filter((candidate) => candidate.id !== region.id).forEach((candidate) => candidate.remove());
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
      void wavesurfer.play().catch(() => setAudioFailure(t("audio.status.waveOpen")));
    });
    const unsubscribeError = wavesurfer.on("error", (error) => {
      if (isExpectedMediaAbort(error)) return;
      setAudioFailure(t("audio.status.waveOpen"));
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
  }, [commitSelection, documentReady, showSelectionRegion, t]);

  useEffect(() => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !previewUrl) return;
    void wavesurfer.load(previewUrl).catch((error) => {
      if (isExpectedMediaAbort(error)) return;
      setAudioFailure(t("audio.status.waveDisplay"));
    });
  }, [previewUrl, t]);

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
    setAudioFailure("");
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
    if (!handoffId || !/^[a-zA-Z0-9-]{8,100}$/.test(handoffId)) return;
    if (!("BroadcastChannel" in window)) { setAudioFailure(t("audio.status.handoffUnavailable")); return; }
    let channel: BroadcastChannel;
    try { channel = new BroadcastChannel(`worklazy-audio-handoff-${handoffId}`); }
    catch { setAudioFailure(t("audio.status.handoffUnavailable")); return; }
    let received = false;
    const announceReady = () => {
      if (!received) {
        try { channel.postMessage({ type: "ready" }); }
        catch { received = true; window.clearInterval(readyInterval); channel.close(); setAudioFailure(t("audio.status.handoffUnavailable")); }
      }
    };
    channel.onmessage = async (event: MessageEvent<{ type?: string; blob?: unknown; fileName?: unknown; mimeType?: unknown; lastModified?: unknown }>) => {
      if (received || event.data?.type !== "audio-file" || !(event.data.blob instanceof Blob)) return;
      received = true;
      const fileName = typeof event.data.fileName === "string" && event.data.fileName ? event.data.fileName : "video-studio-audio.mp3";
      const mimeType = typeof event.data.mimeType === "string" ? event.data.mimeType : event.data.blob.type;
      const lastModified = typeof event.data.lastModified === "number" ? event.data.lastModified : Date.now();
      const file = new File([event.data.blob], fileName, { type: mimeType, lastModified });
      window.clearInterval(readyInterval);
      try {
        await handleFilesRef.current?.([file]);
        channel.postMessage({ type: "received" });
      } catch { setAudioFailure(t("audio.status.handoffUnavailable")); }
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.hash}`);
      channel.close();
    };
    channel.onmessageerror = () => { received = true; window.clearInterval(readyInterval); channel.close(); setAudioFailure(t("audio.status.handoffUnavailable")); };
    const readyInterval = window.setInterval(announceReady, 500);
    announceReady();
    return () => {
      received = true;
      window.clearInterval(readyInterval);
      channel.close();
    };
  }, [t]);

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
    <UtilityPage toolId="audio-studio">
      <div className="audio-studio-page">
      <PageHeader eyebrow="AUDIO WAVEFORM STUDIO" title={t("audio.title")} description={t("audio.description")}>
        <PrivacyBanner compact />
      </PageHeader>

      {audioFailure && <UtilityNotice tone="error" role="alert">{audioFailure}</UtilityNotice>}
      <UtilitySectionCard step={1} title={t("audio.select")} description={t("audio.selectHelp")} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
        <FileDropZone files={files} onFiles={handleFiles} accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" hint={t("audio.hint")} accent="violet" />
        <UtilityNotice className="mt-3 bg-violet-500/10 text-muted-foreground"><AlertTriangle className="mt-0.5 shrink-0 text-violet-700 dark:text-violet-300" size={16} /><span>{t("audio.compatibility")}</span></UtilityNotice>
        {document && (
          <Card className="audio-file-summary mt-3 min-w-0 flex-row items-center gap-2.5 overflow-visible rounded-2xl border border-violet-300/40 bg-violet-50/70 p-3 py-3 text-violet-700 shadow-none ring-0 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-300">
            <FileAudio2 className="shrink-0" size={21} />
            <span className="flex min-w-0 flex-col"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] text-foreground">{document.sourceName}</strong><small className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{formatAudioTime(document.duration)} · {t("audio.channels", { count: document.channels.length })} · {document.sampleRate.toLocaleString(i18n.language)}Hz · {t("audio.memory", { size: formatBytes(pcmSize) })}</small></span>
          </Card>
        )}
      </UtilitySectionCard>

      {document && (
        <UtilitySectionCard step={2} title={t("audio.waveTitle")} description={t("audio.waveHelp")} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
          <div className="audio-waveform-toolbar mb-2 flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-violet-700 dark:text-violet-300"><Waves size={18} /><strong className="text-[15px] text-foreground">{t("audio.highResolution")}</strong><small className="text-[13px] text-muted-foreground">{t("audio.pxSecond", { count: ZOOM_LEVELS[zoomIndex] })}</small></span>
            <div className="flex gap-1">
              <Button className="size-9 rounded-xl bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300" variant="ghost" size="icon" type="button" aria-label={t("audio.zoomOut")} disabled={zoomIndex === 0} onClick={() => updateZoom(-1)}><ZoomOut size={18} /></Button>
              <Button className="size-9 rounded-xl bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300" variant="ghost" size="icon" type="button" aria-label={t("audio.zoomIn")} disabled={zoomIndex === ZOOM_LEVELS.length - 1} onClick={() => updateZoom(1)}><ZoomIn size={18} /></Button>
            </div>
          </div>
          <div className="audio-waveform-shell overflow-hidden rounded-2xl border border-border bg-muted p-[11px_11px_5px] shadow-inner">
            <div className="audio-waveform min-h-[218px] max-[620px]:min-h-[190px] [&_::part(cursor)]:[filter:drop-shadow(0_0_3px_rgba(255,55,95,.4))] [&_::part(region)]:rounded-md [&_::part(region)]:border-x-2 [&_::part(region)]:border-violet-600/70 [&_::part(scroll)]:[scrollbar-color:rgba(139,92,246,.5)_transparent] [&_::part(scroll)]:[scrollbar-width:thin]" ref={waveformContainerRef} />
          </div>

          <div className="audio-selection-panel mt-3 grid grid-cols-[minmax(160px,1fr)_minmax(180px,auto)_minmax(160px,1fr)] items-end gap-2.5 max-[620px]:grid-cols-2">
            <UtilityField><span>{t("audio.start")}</span><AudioSelectionInput value={selection?.start || 0} min={0} max={(selection?.end || document.duration) - MIN_SELECTION_SECONDS} onCommit={(value) => updateSelectionNumber("start", value)} /></UtilityField>
            <div className="flex min-h-[58px] flex-col items-center justify-center rounded-xl bg-violet-500/10 px-3 py-2 text-violet-700 max-[620px]:col-span-2 max-[620px]:row-start-1 max-[620px]:min-h-[50px] dark:text-violet-300"><small className="text-xs text-muted-foreground">{t("audio.duration")}</small><strong className="mt-1 text-[15px] text-foreground tabular-nums">{formatAudioTime(selectionDuration)}</strong></div>
            <UtilityField><span>{t("audio.end")}</span><AudioSelectionInput value={selection?.end || 0} min={(selection?.start || 0) + MIN_SELECTION_SECONDS} max={document.duration} onCommit={(value) => updateSelectionNumber("end", value)} /></UtilityField>
          </div>

          <div className="audio-transport mt-3 grid grid-cols-[42px_52px_minmax(260px,1fr)_minmax(230px,auto)] items-center gap-2 rounded-2xl border border-border bg-muted p-2 max-[620px]:grid-cols-[42px_52px_minmax(0,1fr)]">
            <Button className="size-[42px] rounded-full border-border bg-card text-violet-700 dark:text-violet-300" variant="outline" size="icon-lg" type="button" aria-label={t("audio.rewind")} onClick={() => wavesurferRef.current?.setTime(0)}><SkipBack size={20} /></Button>
            <Button className="audio-play-button size-[50px] rounded-full bg-gradient-to-b from-violet-500 to-violet-700 text-white shadow-lg shadow-violet-700/25 hover:from-violet-600 hover:to-violet-800" size="icon-lg" type="button" aria-label={isPlaying ? t("audio.pause") : t("audio.play")} aria-keyshortcuts="Space" onClick={() => void togglePlayback()}>{isPlaying ? <Pause size={22} /> : <Play size={22} />}</Button>
            <div className="audio-timecode flex min-w-0 items-baseline justify-center gap-2 tabular-nums max-[620px]:flex-col max-[620px]:items-end max-[620px]:gap-0.5"><strong className="text-lg tracking-wide text-foreground max-[620px]:text-base">{formatAudioTime(currentTime)}</strong><span className="text-sm text-muted-foreground max-[620px]:hidden">/</span><small className="text-sm text-muted-foreground max-[620px]:text-xs">{formatAudioTime(document.duration)}</small></div>
            <div className="audio-loop-control flex items-center gap-1 text-violet-700 max-[620px]:col-span-3 dark:text-violet-300"><Repeat2 className="shrink-0" size={17} /><ToggleRow label={t("audio.loop")} checked={loop} onChange={setLoop} /></div>
          </div>

          <div className="audio-edit-toolbar mt-3 grid grid-cols-4 gap-2 max-[620px]:grid-cols-2" aria-label={t("audio.toolbar")}>
            <AudioToolButton disabled={busy || !selection} onClick={() => void applyEdit("MUTE")}><VolumeX size={18} /><span>{t("audio.mute")}</span></AudioToolButton>
            <AudioToolButton disabled={busy || !selection} onClick={() => void applyEdit("CUT")}><Scissors size={18} /><span>{t("audio.cut")}</span></AudioToolButton>
            <AudioToolButton disabled={busy || !selection} onClick={() => void applyEdit("COPY")}><Copy size={18} /><span>{t("audio.copy")}</span></AudioToolButton>
            <AudioToolButton disabled={busy || !clipboard} onClick={() => void applyEdit("PASTE")}><ClipboardPaste size={18} /><span>{t("audio.paste")}</span></AudioToolButton>
            <AudioToolButton disabled={busy || !selection} onClick={() => void applyEdit("DELETE")}><Trash2 size={18} /><span>{t("audio.delete")}</span></AudioToolButton>
            <AudioToolButton disabled={busy || !selection} onClick={() => void applyEdit("FADE_IN")}><Waves size={18} /><span>{t("audio.edit.FADE_IN")}</span></AudioToolButton>
            <AudioToolButton disabled={busy || !selection} onClick={() => void applyEdit("FADE_OUT")}><Waves size={18} /><span>{t("audio.edit.FADE_OUT")}</span></AudioToolButton>
            <AudioToolButton disabled={busy || !selection} onClick={() => void applyEdit("NORMALIZE")}><SlidersHorizontal size={18} /><span>{t("audio.edit.NORMALIZE")}</span></AudioToolButton>
            <AudioToolButton disabled={busy || !selection} onClick={() => void applyEdit("TRIM")}><Scissors size={18} /><span>{t("audio.edit.TRIM")}</span></AudioToolButton>
            <AudioToolButton aria-keyshortcuts="Control+Z Meta+Z" disabled={busy || !undoHistory.length} onClick={() => void restoreHistory("undo")}><Undo2 size={18} /><span>{t("audio.undo")}</span><small className="absolute top-1 right-2 grid size-[17px] place-items-center rounded-full bg-violet-700 text-[10px] text-white">{undoHistory.length}</small></AudioToolButton>
            <AudioToolButton aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y" disabled={busy || !redoHistory.length} onClick={() => void restoreHistory("redo")}><Redo2 size={18} /><span>{t("audio.redo")}</span><small className="absolute top-1 right-2 grid size-[17px] place-items-center rounded-full bg-violet-700 text-[10px] text-white">{redoHistory.length}</small></AudioToolButton>
          </div>
          <div className="audio-gain-control mt-3 flex items-center gap-3 rounded-xl bg-muted p-3 max-[620px]:flex-col max-[620px]:items-stretch"><label className="grid min-w-0 flex-1 grid-cols-[auto_minmax(100px,1fr)_46px] items-center gap-3 text-[13px] font-bold text-muted-foreground"><span>{t("audio.selectionGain")}</span><input className="w-full [accent-color:var(--color-violet-700)]" type="range" min={0} max={2} step={0.05} value={gain} onChange={(event) => setGain(Number(event.target.value))} /><b className="text-right text-violet-700 tabular-nums dark:text-violet-300">{gain.toFixed(2)}×</b></label><Button type="button" className="rounded-xl" variant="secondary" disabled={busy || !selection} onClick={() => void applyEdit("GAIN")}>{t("audio.edit.GAIN")}</Button></div>

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
          <div className={`audio-clipboard-status mt-2 flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] ${clipboard ? "bg-violet-500/10 text-violet-700 dark:text-violet-300" : "bg-muted text-muted-foreground"}`} data-has-clip={clipboard ? "true" : "false"}><ClipboardCopy size={17} /><span>{clipboard ? t("audio.clipboard", { duration: formatAudioTime(clipboard.duration), channels: clipboard.channels.length }) : t("audio.clipboardEmpty")}</span></div>
        </UtilitySectionCard>
      )}

      {document && <AudioExportPanel format={exportFormat} bitrate={mp3Bitrate} busy={busy} selectionDuration={selection ? selectionDuration : undefined} exportSelection={exportSelection} onFormat={setExportFormat} onBitrate={setMp3Bitrate} onExportSelection={setExportSelection} onExport={() => void exportAudio()} />}

      <OperationProgress {...progress} accent="violet" title={t("audio.log")} />
      {busy && <div className="mt-2 flex justify-end"><Button type="button" className="rounded-xl" variant="secondary" onClick={() => { cancelDecode(); activeControllerRef.current?.abort(); progress.fail(t("audio.status.cancelled")); }}><LoaderCircle size={16} /> {t("audio.cancel")}</Button></div>}
      {lastResult && <UtilityNotice className="mt-3" tone="success" role="status" data-testid="audio-result"><FileAudio2 className="mt-0.5 shrink-0" size={18} /><span>{lastResult}</span></UtilityNotice>}

      <ToolGuide
        title={t("audio.guide.title")}
        description={t("audio.guide.description")}
        blocks={(t("audio.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))}
        faq={(t("audio.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))}
      />
      </div>
    </UtilityPage>
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
  return <UtilityInput className="tabular-nums" type="number" min={min} max={max} step="0.001" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(value.toFixed(3)); event.currentTarget.blur(); } }} />;
}

function AudioToolButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  return <Button {...props} type="button" variant="outline" className="relative min-h-[58px] flex-col gap-1 rounded-xl border-violet-300/40 bg-violet-500/10 p-2 text-[13px] font-bold text-violet-700 hover:-translate-y-px hover:bg-violet-500/15 hover:shadow-md disabled:border-border disabled:bg-muted disabled:text-muted-foreground dark:border-violet-900 dark:text-violet-300">{children}</Button>;
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
