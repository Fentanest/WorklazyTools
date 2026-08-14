import {
  AlertTriangle,
  Archive,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  Expand,
  Film,
  FolderDown,
  Gauge,
  GripVertical,
  Link2,
  ListVideo,
  Music2,
  Pause,
  Play,
  Scissors,
  Sparkles,
  Timer,
  Trash2,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { FileDropZone, PageHeader, PrimaryButton, SectionCard, SegmentedControl, ToggleRow, formatBytes } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import type {
  VideoAspect,
  VideoAudioBitrate,
  VideoAudioMode,
  VideoAudioSampleRate,
  VideoBitrate,
  VideoCodec,
  VideoOutputFormat,
  VideoOutputJob,
  VideoResolution,
  VideoTask,
  VideoWorkerInput,
  VideoWorkerOutput,
} from "./types";
import { probeVideoMetadata, runVideoTask } from "./videoWorkerClient";
import { createVideoZip } from "./videoZipClient";
import { useAppLanguage, useLocalizedPath } from "../../i18n/routing";
import type { AppLanguage } from "../../i18n/languages";

type VideoGroupId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
type GroupOutputMode = "individual" | "concat";

interface VideoItem {
  id: string;
  file: File;
  url: string;
  duration: number;
  width: number;
  height: number;
  start: number;
  end: number;
  group: VideoGroupId;
  metadataSource?: "browser" | "ffmpeg";
  metadataError?: string;
  probing?: boolean;
}

interface GroupSettings {
  sync: boolean;
  outputMode: GroupOutputMode;
  audioItemId?: string;
}

interface VideoJobEntry {
  name: string;
  mode: "individual" | "concat";
  items: VideoItem[];
}

interface DownloadableVideoOutput {
  id: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  url: string;
}

interface WritableVideoFileHandle {
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
}

interface WritableVideoDirectoryHandle {
  getFileHandle: (name: string, options: { create: true }) => Promise<WritableVideoFileHandle>;
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<WritableVideoDirectoryHandle>;
};

const GROUP_IDS: VideoGroupId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MAX_VIDEO_GROUP = GROUP_IDS[GROUP_IDS.length - 1];
const MAX_SAFE_BROWSER_OUTPUT_BYTES = 1.5 * 1024 * 1024 * 1024;

export function VideoStudioPage() {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  const audioStudioPath = useLocalizedPath("/tools/audio-studio");
  const mobileDevice = useMemo(isLikelyMobileDevice, []);
  const multiThreadReady = useMemo(() => typeof SharedArrayBuffer !== "undefined" && window.crossOriginIsolated && navigator.hardwareConcurrency > 1, []);
  const [items, setItems] = useState<VideoItem[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [groupSettings, setGroupSettings] = useState<Record<VideoGroupId, GroupSettings>>(createGroupSettings);
  const [draggedId, setDraggedId] = useState<string>();
  const [fullscreenGroup, setFullscreenGroup] = useState<VideoGroupId>();
  const [groupPlayheads, setGroupPlayheads] = useState<Record<VideoGroupId, number>>(() => createGroupValues(0));
  const [allGroupsOneFile, setAllGroupsOneFile] = useState(false);
  const [outputFormat, setOutputFormat] = useState<VideoOutputFormat>("mp4");
  const [codec, setCodec] = useState<VideoCodec>("h264");
  const [resolution, setResolution] = useState<VideoResolution>(() => isLikelyMobileDevice() ? "1080" : "source");
  const [aspect, setAspect] = useState<VideoAspect>("source");
  const [crf, setCrf] = useState(23);
  const [bitrate, setBitrate] = useState<VideoBitrate>("copy");
  const [customVideoBitrate, setCustomVideoBitrate] = useState("4.5");
  const [audioMode, setAudioMode] = useState<VideoAudioMode>("copy");
  const [audioBitrate, setAudioBitrate] = useState<VideoAudioBitrate>("192k");
  const [customAudioBitrate, setCustomAudioBitrate] = useState("192");
  const [audioSampleRate, setAudioSampleRate] = useState<VideoAudioSampleRate>("source");
  const [customAudioSampleRate, setCustomAudioSampleRate] = useState("48000");
  const [gifFps, setGifFps] = useState<10 | 12 | 15 | 20>(12);
  const [gifWidth, setGifWidth] = useState<480 | 720 | 1080>(() => isLikelyMobileDevice() ? 480 : 720);
  const [lastResult, setLastResult] = useState("");
  const [videoOutputs, setVideoOutputs] = useState<DownloadableVideoOutput[]>([]);
  const progress = useOperationProgress();
  const players = useRef<Record<string, HTMLVideoElement | null>>({});
  const groupContainers = useRef<Partial<Record<VideoGroupId, HTMLElement | null>>>({});
  const itemsRef = useRef<VideoItem[]>([]);
  const videoOutputsRef = useRef<DownloadableVideoOutput[]>([]);
  const syncing = useRef(false);
  const activeController = useRef<AbortController | undefined>(undefined);
  const probeControllers = useRef(new Map<string, AbortController>());
  const audioHandoffChannels = useRef(new Set<BroadcastChannel>());

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setFullscreenGroup(undefined);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);
  useEffect(() => () => {
    itemsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    videoOutputsRef.current.forEach((output) => URL.revokeObjectURL(output.url));
    activeController.current?.abort();
    probeControllers.current.forEach((controller) => controller.abort());
    probeControllers.current.clear();
    audioHandoffChannels.current.forEach((channel) => channel.close());
    audioHandoffChannels.current.clear();
  }, []);

  const directorySaveAvailable = useMemo(
    () => typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function",
    [],
  );

  const files = useMemo(() => items.map((item) => item.file), [items]);
  const usedGroups = useMemo(() => GROUP_IDS
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length), [items]);
  const ready = items.length > 0 && items.every((item) => item.duration > 0 && item.end > item.start);
  const isVideoOutput = outputFormat === "mp4" || outputFormat === "mkv" || outputFormat === "webm";
  const passthroughTransformConflict = isVideoOutput && bitrate === "copy" && (resolution !== "source" || aspect !== "source");
  const passthroughConcatConflict = isVideoOutput && bitrate === "copy" && hasIncompatibleConcatDimensions(items, usedGroups, groupSettings, allGroupsOneFile);
  const passthroughConflict = passthroughTransformConflict || passthroughConcatConflict;
  const videoBitrateInvalid = isVideoOutput && bitrate === "custom" && !isNumberInRange(customVideoBitrate, 0.1, 200);
  const audioEncodingEnabled = (isVideoOutput && audioMode === "encode") || outputFormat === "mp3" || outputFormat === "aac";
  const audioBitrateInvalid = audioEncodingEnabled && audioBitrate === "custom" && !isIntegerInRange(customAudioBitrate, 32, 512);
  const audioSampleRateInvalid = audioEncodingEnabled && audioSampleRate === "custom" && !isIntegerInRange(customAudioSampleRate, 8_000, 192_000);
  const outputSettingsInvalid = videoBitrateInvalid || audioBitrateInvalid || audioSampleRateInvalid;
  const outputCount = allGroupsOneFile
    ? (items.length ? 1 : 0)
    : usedGroups.reduce((count, entry) => count + (groupSettings[entry.group].outputMode === "concat" ? 1 : entry.items.length), 0);

  const handleFiles = (nextFiles: File[]) => {
    const supported = nextFiles.filter((file) => file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(file.name));
    const unique = supported.filter((file, index) => supported.findIndex((candidate) => fileKey(candidate) === fileKey(file)) === index);
    const existing = new Map(items.map((item) => [fileKey(item.file), item]));
    const next = unique.map((file) => existing.get(fileKey(file)) || {
      id: createId(),
      file,
      url: URL.createObjectURL(file),
      duration: 0,
      width: 0,
      height: 0,
      start: 0,
      end: 0,
      group: 1 as VideoGroupId,
    });
    items.forEach((item) => {
      if (!next.includes(item)) {
        probeControllers.current.get(item.id)?.abort();
        probeControllers.current.delete(item.id);
        URL.revokeObjectURL(item.url);
      }
    });
    setItems(next);
    setActiveId((current) => next.some((item) => item.id === current) ? current : next[0]?.id);
    const largeFiles = unique.filter((file) => file.size > MAX_SAFE_BROWSER_OUTPUT_BYTES);
    const rejected = nextFiles.filter((file) => !supported.includes(file));
    setLastResult(rejected.length
      ? L(`지원하지 않는 파일을 제외했습니다: ${rejected.map((file) => file.name).join(", ")}`, `Unsupported files were skipped: ${rejected.map((file) => file.name).join(", ")}`)
      : largeFiles.length
        ? L(`${largeFiles.map((file) => `${file.name} (${formatBytes(file.size)})`).join(", ")}은 원본을 메모리에 통째로 복사하지 않고 연결했습니다. 원본 그대로 복사(패스스루)한 결과가 너무 크면 출력 전에 구간 축소 안내가 표시됩니다.`, `${largeFiles.map((file) => `${file.name} (${formatBytes(file.size)})`).join(", ")} were attached without copying the entire source into memory. If a passthrough result is too large, you will be asked to shorten the range before export.`)
        : "");
    progress.reset();
  };

  const removeItem = (itemId: string) => {
    const target = items.find((item) => item.id === itemId);
    if (target) URL.revokeObjectURL(target.url);
    probeControllers.current.get(itemId)?.abort();
    probeControllers.current.delete(itemId);
    const next = items.filter((item) => item.id !== itemId);
    setItems(next);
    if (activeId === itemId) setActiveId(next[0]?.id);
    delete players.current[itemId];
  };

  const updateItem = (itemId: string, patch: Partial<VideoItem>) => {
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, ...patch } : item));
  };

  const probeItem = async (itemId: string) => {
    const item = itemsRef.current.find((candidate) => candidate.id === itemId);
    if (!item || item.duration > 0 || probeControllers.current.has(itemId)) return;
    const controller = new AbortController();
    probeControllers.current.set(itemId, controller);
    updateItem(itemId, { probing: true, metadataError: undefined });
    try {
      const metadata = await probeVideoMetadata(item.file, controller.signal, language);
      updateItem(itemId, { ...metadata, end: metadata.duration, metadataSource: "ffmpeg", probing: false });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        updateItem(itemId, { probing: false, metadataError: error instanceof Error ? error.message : L("영상 정보를 확인하지 못했습니다.", "Unable to read video metadata.") });
      }
    } finally {
      if (probeControllers.current.get(itemId) === controller) probeControllers.current.delete(itemId);
    }
  };

  const updateGroup = (group: VideoGroupId, patch: Partial<GroupSettings>) => {
    setGroupSettings((current) => ({ ...current, [group]: { ...current[group], ...patch } }));
  };

  const moveItem = (itemId: string, group: VideoGroupId, targetId?: string) => {
    setItems((current) => {
      const moved = current.find((item) => item.id === itemId);
      if (!moved) return current;
      const remaining = current.filter((item) => item.id !== itemId);
      const movedItem = { ...moved, group };
      if (!targetId || targetId === itemId) {
        const lastGroupIndex = remaining.reduce((last, item, index) => item.group === group ? index : last, -1);
        remaining.splice(lastGroupIndex + 1, 0, movedItem);
        return remaining;
      }
      const targetIndex = remaining.findIndex((item) => item.id === targetId);
      if (targetIndex < 0) return [...remaining, movedItem];
      remaining.splice(targetIndex, 0, movedItem);
      return remaining;
    });
    setActiveId(itemId);
  };

  const dropOnGroup = (event: DragEvent, group: VideoGroupId, targetId?: string) => {
    event.preventDefault();
    event.stopPropagation();
    const itemId = draggedId || event.dataTransfer.getData("text/plain");
    if (itemId) moveItem(itemId, group, targetId);
    setDraggedId(undefined);
  };

  const moveToAdjacentGroup = (item: VideoItem, direction: -1 | 1) => {
    const next = Math.min(MAX_VIDEO_GROUP, Math.max(1, item.group + direction)) as VideoGroupId;
    if (next !== item.group) moveItem(item.id, next);
  };

  const synchronizePlayers = async (sourceId: string, action: "play" | "pause" | "seek") => {
    const sourceItem = itemsRef.current.find((item) => item.id === sourceId);
    if (!sourceItem || !groupSettings[sourceItem.group].sync || syncing.current) return;
    const source = players.current[sourceId];
    if (!source) return;
    syncing.current = true;
    try {
      await Promise.all(itemsRef.current.map(async (item) => {
        const player = players.current[item.id];
        if (!player || item.id === sourceId || item.group !== sourceItem.group) return;
        player.currentTime = Math.min(source.currentTime, Number.isFinite(player.duration) ? player.duration : source.currentTime);
        if (action === "play") await player.play().catch(() => undefined);
        if (action === "pause") player.pause();
      }));
    } finally {
      window.requestAnimationFrame(() => { syncing.current = false; });
    }
  };

  const seekItem = (item: VideoItem, value: number) => {
    const player = players.current[item.id];
    if (player) player.currentTime = value;
    setGroupPlayheads((current) => ({ ...current, [item.group]: value }));
    void synchronizePlayers(item.id, "seek");
  };

  const setBoundaryFromPlayer = (item: VideoItem, kind: "start" | "end") => {
    const current = players.current[item.id]?.currentTime ?? 0;
    if (kind === "start") updateItem(item.id, { start: Math.max(0, Math.min(current, item.end - 0.05)) });
    else updateItem(item.id, { end: Math.min(item.duration, Math.max(current, item.start + 0.05)) });
  };

  const applyRangeToGroup = (source: VideoItem) => {
    setItems((current) => current.map((item) => item.group !== source.group ? item : {
      ...item,
      start: Math.min(source.start, Math.max(0, item.duration - 0.05)),
      end: Math.min(source.end, item.duration),
    }));
  };

  const playGroup = async (group: VideoGroupId) => {
    await Promise.all(itemsRef.current.filter((item) => item.group === group).map((item) => players.current[item.id]?.play().catch(() => undefined)));
  };

  const pauseGroup = (group: VideoGroupId) => {
    itemsRef.current.filter((item) => item.group === group).forEach((item) => players.current[item.id]?.pause());
  };

  const seekGroup = (group: VideoGroupId, value: number) => {
    setGroupPlayheads((current) => ({ ...current, [group]: value }));
    itemsRef.current.filter((item) => item.group === group).forEach((item) => {
      const player = players.current[item.id];
      if (player) player.currentTime = Math.min(value, item.duration);
    });
  };

  const openGroupFullscreen = async (group: VideoGroupId) => {
    const element = groupContainers.current[group];
    if (!element?.requestFullscreen) {
      setLastResult(L("이 브라우저에서는 분할 전체화면을 지원하지 않습니다.", "This browser does not support split fullscreen."));
      return;
    }
    try {
      await element.requestFullscreen();
      setFullscreenGroup(group);
    } catch {
      setLastResult(L("전체화면을 열지 못했습니다. 브라우저의 전체화면 권한을 확인해 주세요.", "Unable to enter fullscreen. Check the browser's fullscreen permission."));
    }
  };

  const clearVideoOutputs = () => {
    videoOutputsRef.current.forEach((output) => URL.revokeObjectURL(output.url));
    videoOutputsRef.current = [];
    setVideoOutputs([]);
  };

  const appendVideoOutput = (output: VideoWorkerOutput) => {
    const blob = new Blob([output.buffer], { type: output.mimeType });
    const next = {
      id: createId(),
      fileName: output.fileName,
      mimeType: output.mimeType,
      blob,
      url: URL.createObjectURL(blob),
    } satisfies DownloadableVideoOutput;
    videoOutputsRef.current = [...videoOutputsRef.current, next];
    setVideoOutputs(videoOutputsRef.current);
    setLastResult(L(`${next.fileName} 준비 완료 · 아래 결과 목록에서 내려받을 수 있습니다.`, `${next.fileName} is ready. Download it from the results below.`));
  };

  const downloadAllOutputs = () => {
    videoOutputsRef.current.forEach((output) => triggerDownloadUrl(output.url, output.fileName));
    setLastResult(L(`${videoOutputsRef.current.length}개 파일의 개별 다운로드를 요청했습니다. 브라우저가 여러 파일 다운로드 허용 여부를 물으면 허용해 주세요.`, `Requested ${videoOutputsRef.current.length} individual downloads. Allow multiple downloads if your browser asks.`));
  };

  const saveOutputsToFolder = async () => {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker || !videoOutputsRef.current.length) return;
    try {
      const directory = await picker.call(window);
      progress.start(L("선택한 폴더에 결과를 저장하는 중…", "Saving results to the selected folder…"));
      for (let index = 0; index < videoOutputsRef.current.length; index += 1) {
        const output = videoOutputsRef.current[index];
        progress.update(Math.round((index / videoOutputsRef.current.length) * 100), L(`${index + 1}/${videoOutputsRef.current.length} ${output.fileName} 저장 중…`, `${index + 1}/${videoOutputsRef.current.length} Saving ${output.fileName}…`));
        const fileHandle = await directory.getFileHandle(output.fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(output.blob);
        await writable.close();
      }
      progress.succeed(L(`${videoOutputsRef.current.length}개 결과를 선택한 폴더에 저장했습니다.`, `Saved ${videoOutputsRef.current.length} results to the selected folder.`));
      setLastResult(L(`${videoOutputsRef.current.length}개 결과를 선택한 폴더에 저장했습니다.`, `Saved ${videoOutputsRef.current.length} results to the selected folder.`));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      progress.fail(error instanceof Error ? error.message : L("선택한 폴더에 결과를 저장하지 못했습니다.", "Unable to save results to the selected folder."));
    }
  };

  const createZipArchive = async () => {
    if (!videoOutputsRef.current.length) return;
    const controller = new AbortController();
    activeController.current = controller;
    progress.start(L("선택한 결과로 ZIP 파일을 만드는 중…", "Creating a ZIP from the selected results…"));
    setLastResult("");
    try {
      const result = await createVideoZip(
        videoOutputsRef.current.map(({ fileName, blob }) => ({ fileName, blob })),
        progress.update,
        controller.signal,
        language,
      );
      downloadBuffer(result.buffer, result.mimeType, result.fileName);
      progress.succeed(L(`${result.fileName} 생성 완료`, `${result.fileName} created`));
      setLastResult(L(`${result.fileName}을 만들고 내려받았습니다.`, `Created and downloaded ${result.fileName}.`));
    } catch (error) {
      progress.fail(error instanceof DOMException && error.name === "AbortError" ? L("ZIP 만들기를 취소했습니다.", "ZIP creation was canceled.") : toUserFacingVideoError(error, language));
    } finally {
      if (activeController.current === controller) activeController.current = undefined;
    }
  };

  const openInAudioStudio = (output: DownloadableVideoOutput) => {
    if (!("BroadcastChannel" in window)) {
      setLastResult(L("이 브라우저는 도구 간 메모리 전달을 지원하지 않습니다. 파일을 내려받은 뒤 오디오 스튜디오에서 직접 열어 주세요.", "This browser cannot transfer files between tools in memory. Download the file and open it manually in Audio Studio."));
      return;
    }
    const handoffId = createId();
    const channel = new BroadcastChannel(audioHandoffChannelName(handoffId));
    let transferred = false;
    audioHandoffChannels.current.add(channel);
    const closeChannel = () => {
      channel.close();
      audioHandoffChannels.current.delete(channel);
    };
    channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "ready" && !transferred) {
        transferred = true;
        channel.postMessage({
          type: "audio-file",
          blob: output.blob,
          fileName: output.fileName,
          mimeType: output.mimeType,
          lastModified: Date.now(),
        });
      }
      if (event.data?.type === "received") {
        setLastResult(L(`${output.fileName}을 새 탭의 오디오 스튜디오로 전달했습니다.`, `Sent ${output.fileName} to Audio Studio in a new tab.`));
        closeChannel();
      }
    };
    const target = new URL(audioStudioPath, window.location.origin);
    target.searchParams.set("handoff", handoffId);
    const opened = window.open(target.href, "_blank");
    if (!opened) {
      closeChannel();
      setLastResult(L("새 탭이 차단되었습니다. 팝업을 허용한 뒤 다시 눌러 주세요.", "The new tab was blocked. Allow pop-ups and try again."));
      return;
    }
    window.setTimeout(() => {
      if (audioHandoffChannels.current.has(channel)) {
        closeChannel();
        if (!transferred) setLastResult(L("오디오 스튜디오 연결 시간이 지났습니다. 결과를 내려받아 직접 열어 주세요.", "The Audio Studio connection timed out. Download the result and open it manually."));
      }
    }, 30_000);
  };

  const outputAction = async () => {
    if (!ready || !validateSegments(items) || passthroughConflict) return;
    if (outputSettingsInvalid) {
      progress.start(L("직접입력 값을 확인하는 중…", "Checking custom values…"));
      progress.fail(L("영상 비트레이트는 0.1~200 Mbps, 오디오 비트레이트는 32~512 kbps, 샘플레이트는 8,000~192,000 Hz 범위로 입력해 주세요.", "Enter video bitrate from 0.1–200 Mbps, audio bitrate from 32–512 kbps, and sample rate from 8,000–192,000 Hz."));
      return;
    }
    const task = createTask({
      outputFormat,
      codec,
      resolution,
      aspect,
      crf,
      bitrate,
      customVideoBitrate,
      audioMode,
      audioBitrate,
      customAudioBitrate,
      audioSampleRate,
      customAudioSampleRate,
      gifFps,
      gifWidth,
    });
    const jobEntries = createJobEntries(usedGroups, groupSettings, allGroupsOneFile, language);
    if (task.kind === "encode" && task.bitrate === "copy") {
      const oversized = jobEntries
        .map((job) => ({ job, estimate: estimatePassthroughBytes(job) }))
        .find(({ estimate }) => estimate > MAX_SAFE_BROWSER_OUTPUT_BYTES);
      if (oversized) {
        progress.start(L("원본 그대로 복사할 결과 크기를 확인하는 중…", "Checking estimated passthrough output size…"));
        progress.fail(L(`${oversized.job.name}의 예상 결과가 약 ${formatBytes(oversized.estimate)}입니다. 대형 원본 자체가 위험한 것은 아니지만, 현재 브라우저 출력 방식은 1.5GB를 넘는 단일 결과를 만들 수 없습니다. 출력 구간을 줄이거나 화질 기준 자동 용량 조절(CRF)을 선택해 주세요.`, `${oversized.job.name} is estimated at about ${formatBytes(oversized.estimate)}. Large source files are not inherently unsafe, but this browser output path cannot create a single result over 1.5 GB. Shorten the range or select CRF encoding.`));
        return;
      }
    }
    const totalSize = items.reduce((sum, item) => sum + item.file.size, 0);
    const cautionBytes = mobileDevice ? 250 * 1024 * 1024 : 500 * 1024 * 1024;
    if (totalSize > cautionBytes && !window.confirm(L(`대형 파일 처리 주의: 선택한 원본이 ${formatBytes(totalSize)}입니다. 원본은 전체 메모리 복사 없이 연결하지만, 이 기기에서는 변환 시간이 길어지거나 메모리가 부족할 수 있습니다. 계속할까요?`, `Large-file notice: the selected sources total ${formatBytes(totalSize)}. They are attached without copying the entire files into memory, but conversion may take longer or run out of memory on this device. Continue?`))) return;
    await executeTask((controller, onOutput) => {
      const jobs: VideoOutputJob[] = jobEntries.map((job) => ({
        name: job.name,
        mode: job.mode,
        inputs: job.items.map(toWorkerInput),
      }));
      return runVideoTask({ mode: "batch", jobs, task }, progress.update, onOutput, controller.signal, language);
    });
  };

  const executeTask = async (task: (controller: AbortController, onOutput: (output: VideoWorkerOutput) => void) => ReturnType<typeof runVideoTask>) => {
    const controller = new AbortController();
    activeController.current = controller;
    clearVideoOutputs();
    progress.start(L("원본 영상을 메모리 복사 없이 처리 엔진에 연결하는 중…", "Attaching source videos to the processing engine without copying them into memory…"));
    setLastResult("");
    try {
      const result = await task(controller, appendVideoOutput);
      setLastResult(L(`${result.outputCount}개 결과가 모두 준비되었습니다.${result.warnings.length ? ` ${result.warnings[0]}` : ""}`, `All ${result.outputCount} results are ready.${result.warnings.length ? ` ${result.warnings[0]}` : ""}`));
      progress.succeed(L(`${result.outputCount}개 결과 생성 완료`, `${result.outputCount} results created`));
    } catch (error) {
      progress.fail(error instanceof DOMException && error.name === "AbortError" ? L("비디오 작업을 취소했습니다.", "Video processing was canceled.") : toUserFacingVideoError(error, language));
      if (videoOutputsRef.current.length) setLastResult(L(`${videoOutputsRef.current.length}개 결과는 완료되어 아래에서 개별 다운로드할 수 있습니다.`, `${videoOutputsRef.current.length} results completed and can be downloaded individually below.`));
    } finally {
      if (activeController.current === controller) activeController.current = undefined;
    }
  };

  const validateSegments = (targets: VideoItem[]) => {
    const invalid = targets.find((item) => !item.duration || item.end <= item.start);
    if (!invalid) return true;
    progress.start(L("구간 설정을 확인하는 중…", "Checking trim ranges…"));
    progress.fail(L(`${invalid.file.name}: 종료 시간은 시작 시간보다 뒤여야 합니다.`, `${invalid.file.name}: the end time must be after the start time.`));
    return false;
  };

  const changeOutputFormat = (format: VideoOutputFormat) => {
    setOutputFormat(format);
    if (format === "webm") setCodec("vp9");
    setLastResult("");
    progress.reset();
  };

  return (
    <div className="page tool-page page-enter video-studio-page">
      <PageHeader eyebrow="VIDEO STUDIO" title={L("비디오 스튜디오", "Video Studio")} description={L("영상 수 제한 없이 계속 추가하고 최대 10개 그룹으로 나눠, 그룹마다 개별 저장하거나 순서대로 이어붙이세요.", "Keep adding videos without a file-count limit, organize them into up to 10 groups, and export individually or concatenate in order.")}>
        <PrivacyBanner compact />
      </PageHeader>

      <div className={`video-engine-status${multiThreadReady ? " is-ready" : ""}`}>
        <Cpu size={19} />
        <span>
          <strong>{multiThreadReady ? L("멀티스레드 인코딩 준비됨", "Multi-thread encoding ready") : L("단일 스레드 호환 모드", "Single-thread compatibility mode")}</strong>
          <small>{multiThreadReady
            ? L("비디오 전용 실행 문서에서 여러 CPU 코어를 사용합니다. 이 문서에는 광고 스크립트를 불러오지 않습니다.", "A dedicated video runtime uses multiple CPU cores and does not load advertising scripts.")
            : L("현재 브라우저에서 멀티스레드 실행 조건을 사용할 수 없어 호환 엔진으로 처리합니다. 기능은 같지만 인코딩 시간이 더 길 수 있습니다.", "This browser cannot meet the multi-thread requirements, so it uses the compatible engine. Features are the same, but encoding may take longer.")}</small>
        </span>
      </div>

      <SectionCard step={1} title={L("비디오 선택", "Choose videos")} description={L("파일 개수 제한 없이 여러 번 이어서 추가할 수 있습니다. 추가 후 최대 10개 그룹에서 순서와 출력 방식을 정합니다.", "Add files in multiple rounds with no file-count limit, then set order and output mode in up to 10 groups.")}>
        <FileDropZone files={files} onFiles={handleFiles} accept="video/*,.mkv,.avi" multiple hint={L("MP4·MOV·WebM·MKV·AVI · 여러 번 나눠 추가 가능", "MP4 · MOV · WebM · MKV · AVI · add more at any time")} accent="pink" />
        <div className="inline-notice warning"><AlertTriangle size={16} /><span>{L("MKV·AVI는 파일 안의 영상 압축 방식에 따라 완벽한 호환을 보장하지 않습니다. 미리보기가 안 되면 브라우저용 FFmpeg 변환기가 재생 시간과 크기를 대신 확인해 숫자로 구간을 지정할 수 있지만, 분석도 실패하면 MP4·MOV·WebM으로 바꿔 주세요.", "MKV and AVI compatibility depends on their internal codecs and is not guaranteed. If preview fails, browser FFmpeg will try to read duration and dimensions for numeric trimming; if probing also fails, convert the source to MP4, MOV, or WebM first.")}</span></div>
        {mobileDevice && <div className="inline-notice"><Gauge size={16} /><span>{L("모바일 권장값으로 1080p와 GIF 480px를 기본 선택했습니다. 여러 영상이나 합계 250MB 이상의 대형 파일도 처리할 수 있지만, 한 번에 한 파일씩 짧은 구간부터 작업하면 더 안정적입니다.", "Mobile defaults are 1080p and 480 px GIF. Large totals above 250 MB are supported, but processing one short clip at a time is more reliable.")}</span></div>}
      </SectionCard>

      {items.length > 0 && (
        <SectionCard step={2} title={L("그룹별 미리보기와 구간 설정", "Group previews and trim ranges")} description={L("영상을 끌어서 같은 그룹 안의 순서를 바꾸거나 다른 그룹으로 옮길 수 있습니다.", "Drag videos to reorder them within a group or move them to another group.")}>
          <div className="video-sync-groups">
            {usedGroups.map(({ group, items: groupItems }) => {
              const settings = groupSettings[group];
              const audioItemId = settings.audioItemId && groupItems.some((item) => item.id === settings.audioItemId) ? settings.audioItemId : groupItems[0].id;
              const groupDuration = Math.max(...groupItems.map((item) => item.duration || 0), 0.01);
              return (
                <section
                  className={`video-sync-group${fullscreenGroup === group ? " is-fullscreen" : ""}`}
                  key={group}
                  ref={(element) => { groupContainers.current[group] = element; }}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                  onDrop={(event) => dropOnGroup(event, group)}
                >
                  <header className="video-group-header">
                    <span className="video-group-title"><Link2 size={16} /><span><strong>{L("그룹", "Group")} {group}</strong><small>{L(`${groupItems.length}개 영상 · 카드 순서대로 출력`, `${groupItems.length} videos · exported in card order`)}</small></span></span>
                    <div className="video-group-output-mode">
                      <SegmentedControl value={settings.outputMode} options={[{ value: "individual", label: L("개별 출력", "Individual") }, { value: "concat", label: L("이어붙이기", "Concatenate") }]} onChange={(value) => updateGroup(group, { outputMode: value })} label={L(`그룹 ${group} 출력 방식`, `Group ${group} output mode`)} />
                    </div>
                    <div className="video-group-actions">
                      <label className="compact-sync-toggle"><input type="checkbox" checked={settings.sync} disabled={groupItems.length < 2} onChange={(event) => updateGroup(group, { sync: event.target.checked })} /><span>{L("동기 재생", "Sync playback")}</span></label>
                      {groupItems.length > 1 && <button type="button" className="secondary-button small" onClick={() => void openGroupFullscreen(group)}><Expand size={15} /> {L("분할 전체화면", "Split fullscreen")}</button>}
                    </div>
                  </header>

                  {groupItems.length > 1 && (
                    <div className="video-group-master-controls">
                      <button type="button" aria-label={L(`그룹 ${group} 함께 재생`, `Play group ${group} together`)} onClick={() => void playGroup(group)}><Play size={15} /></button>
                      <button type="button" aria-label={L(`그룹 ${group} 함께 정지`, `Pause group ${group} together`)} onClick={() => pauseGroup(group)}><Pause size={15} /></button>
                      <input type="range" min={0} max={groupDuration} step="0.01" value={Math.min(groupPlayheads[group], groupDuration)} aria-label={L(`그룹 ${group} 공통 재생 위치`, `Group ${group} playhead`)} onChange={(event) => seekGroup(group, Number(event.target.value))} />
                      <b>{formatTime(groupPlayheads[group])}</b>
                      <label><Volume2 size={14} /><span>{L("소리", "Audio")}</span><select value={audioItemId} onChange={(event) => updateGroup(group, { audioItemId: event.target.value })}>{groupItems.map((item, index) => <option value={item.id} key={item.id}>{index + 1}. {item.file.name}</option>)}</select></label>
                    </div>
                  )}

                  <div className={`multi-video-grid count-${groupItems.length}`}>
                    {groupItems.map((item, groupIndex) => {
                      const mutedForGroupView = groupItems.length > 1 && (settings.sync || fullscreenGroup === group) && audioItemId !== item.id;
                      return (
                        <article
                          className={`${activeId === item.id ? "active" : ""}${draggedId === item.id ? " dragging" : ""}`}
                          key={item.id}
                          onClick={() => setActiveId(item.id)}
                          onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; }}
                          onDrop={(event) => dropOnGroup(event, group, item.id)}
                        >
                          <div
                            className="video-drag-handle"
                            draggable
                            title={L("드래그하여 순서 또는 그룹 이동", "Drag to reorder or change group")}
                            onDragStart={(event) => { setDraggedId(item.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); }}
                            onDragEnd={() => setDraggedId(undefined)}
                          ><GripVertical size={16} /><span>{groupIndex + 1}</span></div>
                          <video
                            ref={(element) => { players.current[item.id] = element; }}
                            src={item.url}
                            controls
                            muted={mutedForGroupView}
                            preload="metadata"
                            onLoadedMetadata={(event) => {
                              const duration = event.currentTarget.duration;
                              probeControllers.current.get(item.id)?.abort();
                              probeControllers.current.delete(item.id);
                              updateItem(item.id, { duration, width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight, end: item.end || duration, metadataSource: "browser", probing: false, metadataError: undefined });
                            }}
                            onError={() => void probeItem(item.id)}
                            onPlay={() => void synchronizePlayers(item.id, "play")}
                            onPause={() => void synchronizePlayers(item.id, "pause")}
                            onSeeked={() => void synchronizePlayers(item.id, "seek")}
                            onTimeUpdate={(event) => {
                              if (audioItemId === item.id) {
                                const currentTime = event.currentTarget.currentTime;
                                setGroupPlayheads((current) => ({ ...current, [group]: currentTime }));
                              }
                            }}
                          />
                          {item.metadataSource === "ffmpeg" && <div className="video-preview-fallback"><Film size={22} /><strong>{L("브라우저 미리보기 없음", "No browser preview")}</strong><span>{L("영상 정보는 확인했습니다. 아래 숫자 입력으로 구간을 지정하세요.", "Metadata is available. Use the numeric fields below to set the range.")}</span></div>}
                          {item.probing && <div className="video-preview-fallback"><Gauge size={22} /><strong>{L("영상 정보 확인 중", "Reading video metadata")}</strong><span>{L("FFmpeg 호환 경로를 준비하고 있습니다.", "Preparing the FFmpeg compatibility path.")}</span></div>}
                          <div className="video-card-footer">
                            <span><strong>{groupIndex + 1}. {item.file.name}</strong><small>{formatBytes(item.file.size)} · {item.duration ? `${formatTime(item.duration)}${item.metadataSource === "ffmpeg" ? L(" · 변환용 정보 확인됨", " · metadata ready for conversion") : ""}` : item.metadataError || L("재생 정보 확인 중…", "Reading playback metadata…")}</small></span>
                            <span className="video-card-actions">
                              <button type="button" disabled={item.group === 1} aria-label={L(`${item.file.name} 왼쪽 그룹으로 이동`, `Move ${item.file.name} to the previous group`)} onClick={(event) => { event.stopPropagation(); moveToAdjacentGroup(item, -1); }}><ChevronLeft size={14} /></button>
                              <label className="video-group-select"><span className="visually-hidden">{item.file.name} {L("그룹", "group")}</span><select value={item.group} aria-label={L(`${item.file.name} 그룹 이동`, `Move ${item.file.name} to a group`)} onClick={(event) => event.stopPropagation()} onChange={(event) => moveItem(item.id, Number(event.target.value) as VideoGroupId)}>{GROUP_IDS.map((id) => <option value={id} key={id}>{L("그룹", "Group")} {id}</option>)}</select></label>
                              <button type="button" disabled={item.group === MAX_VIDEO_GROUP} aria-label={L(`${item.file.name} 오른쪽 그룹으로 이동`, `Move ${item.file.name} to the next group`)} onClick={(event) => { event.stopPropagation(); moveToAdjacentGroup(item, 1); }}><ChevronRight size={14} /></button>
                              <button type="button" aria-label={L(`${item.file.name} 제거`, `Remove ${item.file.name}`)} onClick={(event) => { event.stopPropagation(); removeItem(item.id); }}><X size={14} /></button>
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="group-trim-editor">
                    <div className="group-trim-heading"><span><Scissors size={17} /><strong>{L(`그룹 ${group} 구간 설정`, `Group ${group} trim ranges`)}</strong></span><small>{L("각 영상에 서로 다른 구간을 지정할 수 있습니다.", "Each video can use a different range.")}</small></div>
                    {groupItems.map((item, groupIndex) => item.duration > 0 ? (
                      <div className={`video-trim-lane${activeId === item.id ? " active" : ""}`} key={item.id} onClick={() => setActiveId(item.id)}>
                        <div className="video-trim-lane-title"><strong>{groupIndex + 1}. {item.file.name}</strong><b>{formatTime(item.start)} — {formatTime(item.end)}</b></div>
                        <div
                          className="video-range-control"
                          style={{ "--range-start": `${item.start / item.duration * 100}%`, "--range-end": `${item.end / item.duration * 100}%` } as CSSProperties}
                        >
                          <span className="video-range-selection" />
                          <input aria-label={L(`${item.file.name} 시작 지점`, `${item.file.name} start time`)} type="range" min={0} max={item.duration} step="0.01" value={item.start} onChange={(event) => { const value = Math.min(Number(event.target.value), item.end - 0.05); updateItem(item.id, { start: value }); seekItem(item, value); }} />
                          <input aria-label={L(`${item.file.name} 종료 지점`, `${item.file.name} end time`)} type="range" min={0} max={item.duration} step="0.01" value={item.end} onChange={(event) => { const value = Math.max(Number(event.target.value), item.start + 0.05); updateItem(item.id, { end: value }); seekItem(item, value); }} />
                        </div>
                        <div className="video-range-values">
                          <label><span>{L("시작", "Start")}</span><input type="number" min={0} max={item.end} step="0.1" value={item.start.toFixed(1)} onChange={(event) => updateItem(item.id, { start: Math.max(0, Math.min(Number(event.target.value), item.end - 0.05)) })} /></label>
                          <small>{L("선택 구간", "Selection")} {formatTime(item.end - item.start)}</small>
                          <label><span>{L("종료", "End")}</span><input type="number" min={item.start} max={item.duration} step="0.1" value={item.end.toFixed(1)} onChange={(event) => updateItem(item.id, { end: Math.min(item.duration, Math.max(Number(event.target.value), item.start + 0.05)) })} /></label>
                        </div>
                        <div className="trim-play-buttons">
                          <button type="button" className="secondary-button small" onClick={() => setBoundaryFromPlayer(item, "start")}><Timer size={14} /> {L("현재 위치→시작", "Current → start")}</button>
                          <button type="button" className="secondary-button small" onClick={() => setBoundaryFromPlayer(item, "end")}><Timer size={14} /> {L("현재 위치→종료", "Current → end")}</button>
                          <button type="button" className="secondary-button small" onClick={() => { const player = players.current[item.id]; if (player) { player.currentTime = item.start; void player.play(); } }}><Play size={14} /> {L("구간 재생", "Play range")}</button>
                          {groupItems.length > 1 && <button type="button" className="secondary-button small" onClick={() => applyRangeToGroup(item)}>{L("이 구간을 그룹 전체에 적용", "Apply range to entire group")}</button>}
                        </div>
                      </div>
                    ) : <div className="video-trim-loading" key={item.id}>{L(`${item.file.name} 재생 정보를 확인하는 중…`, `Reading playback metadata for ${item.file.name}…`)}</div>)}
                  </div>
                </section>
              );
            })}
          </div>
        </SectionCard>
      )}

      {items.length > 0 && (
        <SectionCard step={3} title={L("출력 설정", "Output settings")} description={L("별도 작업을 고를 필요 없이 출력 형식이 GIF 생성, 음원 추출 또는 영상 출력을 결정합니다.", "The output format automatically determines whether to create a GIF, extract audio, or export video.")}>
          <div className="video-output-format-grid">
            <label><span>{L("출력 형식", "Output format")}</span><select value={outputFormat} onChange={(event) => changeOutputFormat(event.target.value as VideoOutputFormat)}><option value="mp4">MP4 {L("영상", "video")}</option><option value="mkv">MKV {L("영상", "video")}</option><option value="webm">WebM {L("영상", "video")}</option><option value="gif">GIF {L("움짤", "animation")}</option><option value="mp3">MP3 {L("음원", "audio")}</option><option value="aac">AAC {L("음원", "audio")}</option></select></label>
            <div className="video-output-count"><ListVideo size={18} /><span><strong>{L(`${outputCount}개 결과 파일`, `${outputCount} output files`)}</strong><small>{L("완성되는 파일부터 개별 다운로드 목록에 표시합니다.", "Completed files appear in the individual download list immediately.")}</small></span></div>
          </div>
          <div className="video-output-limit"><Gauge size={17} /><span><strong>{L("브라우저 출력 권장: 파일당 1GB 이하", "Browser recommendation: under 1 GB per output")}</strong><small>{L("현재 안전 한도는 결과 파일 1개당 1.5GB입니다. 원본 파일 크기와는 별도로 계산합니다.", "The current safety limit is 1.5 GB per result, calculated separately from source file size.")}</small></span></div>

          {isVideoOutput && (
            <EncodingSettings
              container={outputFormat}
              codec={codec}
              resolution={resolution}
              aspect={aspect}
              crf={crf}
              bitrate={bitrate}
              customBitrate={customVideoBitrate}
              onCodec={setCodec}
              onResolution={setResolution}
              onAspect={setAspect}
              onCrf={setCrf}
              onBitrate={setBitrate}
              onCustomBitrate={setCustomVideoBitrate}
              language={language}
            />
          )}

          {outputFormat === "gif" && <div className="quick-tool-settings"><label><span>{L("GIF 초당 프레임", "GIF frame rate")}</span><select value={gifFps} onChange={(event) => setGifFps(Number(event.target.value) as 10 | 12 | 15 | 20)}><option value={10}>10 fps · {L("작은 용량", "smaller")}</option><option value={12}>12 fps · {L("권장", "recommended")}</option><option value={15}>15 fps</option><option value={20}>20 fps · {L("부드럽게", "smoother")}</option></select></label><label><span>{L("최대 가로 크기", "Maximum width")}</span><select value={gifWidth} onChange={(event) => setGifWidth(Number(event.target.value) as 480 | 720 | 1080)}><option value={480}>480px</option><option value={720}>720px · {L("권장", "recommended")}</option><option value={1080}>1080px</option></select></label></div>}
          {isVideoOutput && (
            <AudioTrackSettings
              mode={audioMode}
              bitrate={audioBitrate}
              customBitrate={customAudioBitrate}
              sampleRate={audioSampleRate}
              customSampleRate={customAudioSampleRate}
              onMode={setAudioMode}
              onBitrate={setAudioBitrate}
              onCustomBitrate={setCustomAudioBitrate}
              onSampleRate={setAudioSampleRate}
              onCustomSampleRate={setCustomAudioSampleRate}
              language={language}
            />
          )}
          {(outputFormat === "mp3" || outputFormat === "aac") && (
            <AudioEncodingFields
              bitrate={audioBitrate}
              customBitrate={customAudioBitrate}
              sampleRate={audioSampleRate}
              customSampleRate={customAudioSampleRate}
              onBitrate={setAudioBitrate}
              onCustomBitrate={setCustomAudioBitrate}
              onSampleRate={setAudioSampleRate}
              onCustomSampleRate={setCustomAudioSampleRate}
              language={language}
            />
          )}

          <div className="video-global-output-toggle"><ToggleRow label={L("모든 그룹을 한 파일로 이어붙이기", "Concatenate all groups into one file")} description={L("그룹 번호와 그룹 내부 카드 순서대로 연결하며, 그룹별 개별·이어붙이기 설정을 이번 출력에만 덮어씁니다.", "Connect groups by group number and card order, overriding each group's output mode for this export only.")} checked={allGroupsOneFile} onChange={setAllGroupsOneFile} /></div>

          {isVideoOutput && bitrate === "copy" && outputFormat !== "webm" && !passthroughConflict && <div className="inline-warning"><Gauge size={17} /><span>{L("원본 그대로 복사(패스스루)는 영상 압축을 다시 하지 않습니다. 빠르고 화질 손실이 없지만 자르기 시작점은 가까운 키프레임(재생 기준 장면)으로 맞춰질 수 있고, 압축 방식이 다른 영상은 이어붙이지 못할 수 있습니다.", "Passthrough avoids re-encoding, so it is fast and lossless. Trim starts may snap to a nearby keyframe, and videos with different codec settings may not concatenate.")}</span></div>}
          {outputFormat === "webm" && bitrate === "copy" && <div className="inline-warning error webm-passthrough-warning"><AlertTriangle size={17} /><span><strong>{L("일반적인 MP4의 영상과 음성을 WebM 파일에 그대로 담을 수 없습니다.", "Typical MP4 video and audio cannot be copied directly into WebM.")}</strong> {L("H.264 영상과 AAC 음성은 화질 기준 자동 용량 조절(CRF) 또는 지정 비트레이트로 다시 변환하고, 음성은 호환 형식으로 다시 변환(Opus)하거나 제거하세요. 원본이 이미 VP8·VP9·AV1 영상과 Opus·Vorbis 음성인 경우에만 원본 그대로 복사할 수 있습니다.", "Re-encode H.264 video using CRF or a target bitrate, and convert audio to Opus or remove it. Direct copy works only when the source already uses VP8, VP9, or AV1 video with Opus or Vorbis audio.")}</span></div>}
          {isVideoOutput && audioMode === "copy" && <div className="inline-warning"><Volume2 size={17} /><span>{L("영상 파일 안의 첫 번째 음성만 압축 방식 그대로 복사합니다. 선택한 출력 파일 형식이 원본 음성을 지원하지 않으면 자동으로 품질을 바꾸지 않고 오류를 표시합니다.", "Only the first audio track is copied without re-encoding. If the output container does not support it, the tool reports an error instead of silently changing quality.")}</span></div>}
          {isVideoOutput && audioMode === "remove" && <div className="video-output-note"><Volume2 size={17} /><span>{L("출력 영상에서 음성을 완전히 제거합니다.", "Audio will be removed from the output video.")}</span></div>}
          {passthroughTransformConflict && <div className="inline-warning error"><Gauge size={17} /><span>{L("화면 비율이나 해상도를 바꾸려면 영상을 다시 압축해야 합니다. 두 설정을 원본 유지로 되돌리거나 화질 기준 자동 용량 조절(CRF)·지정 비트레이트를 선택하세요.", "Changing aspect ratio or resolution requires re-encoding. Restore both to source settings or choose CRF/target-bitrate encoding.")}</span></div>}
          {!passthroughTransformConflict && passthroughConcatConflict && <div className="inline-warning error"><Gauge size={17} /><span>{L("크기나 화면 비율이 다른 영상은 원본 그대로 이어붙일 수 없습니다. 화질 기준 자동 용량 조절(CRF)·지정 비트레이트를 선택하면 각 영상의 원본 비율을 유지하고 첫 영상 크기의 화면에 맞춰 연결합니다.", "Videos with different dimensions or aspect ratios cannot be concatenated via passthrough. Choose CRF or a target bitrate to fit each source into the first video's frame while preserving its aspect ratio.")}</span></div>}
          {outputFormat === "gif" && <div className="video-output-note"><Sparkles size={17} /><span>{L("각 그룹의 선택 구간을 설정한 순서와 출력 방식대로 GIF로 만듭니다.", "Creates GIFs from each group's selected ranges in the configured order and output mode.")}</span></div>}
          {(outputFormat === "mp3" || outputFormat === "aac") && <div className="video-output-note"><Music2 size={17} /><span>{L("영상 화면은 제외하고 각 그룹의 선택 구간에서 음원만 추출합니다.", "Extracts only audio from each group's selected ranges, excluding video.")}</span></div>}

          <div className="video-output-summary">
            {allGroupsOneFile
              ? <p><strong>{L("전체 그룹", "All groups")}</strong><span>{L("그룹 번호와 카드 순서대로 이어붙이기", "Concatenate by group number and card order")}</span><b>1</b></p>
              : usedGroups.map(({ group, items: groupItems }) => <p key={group}><strong>{L("그룹", "Group")} {group}</strong><span>{groupSettings[group].outputMode === "concat" ? L(`${groupItems.length}개 영상을 순서대로 이어붙이기`, `Concatenate ${groupItems.length} videos in order`) : L(`${groupItems.length}개 영상을 각각 출력`, `Export ${groupItems.length} videos individually`)}</span><b>{groupSettings[group].outputMode === "concat" ? 1 : groupItems.length}</b></p>)}
          </div>
          <div className="section-actions"><PrimaryButton accent="pink" disabled={!ready || passthroughConflict || outputSettingsInvalid} loading={progress.status === "running"} onClick={() => void outputAction()}><Download size={18} /> {L(`설정대로 ${outputCount}개 결과 만들기`, `Create ${outputCount} results`)}</PrimaryButton></div>
        </SectionCard>
      )}

      <OperationProgress {...progress} accent="pink" title={L("비디오 처리 로그", "Video processing log")} />
      {progress.status === "running" && <div className="cancel-operation"><button type="button" className="secondary-button" onClick={() => activeController.current?.abort()}>{L("작업 취소", "Cancel")}</button></div>}
      {lastResult && <div className="inline-success"><Download size={18} /><span>{lastResult}</span></div>}

      {videoOutputs.length > 0 && (
        <SectionCard
          className="video-results-card"
          title={L(`완성된 결과 ${videoOutputs.length}개`, `${videoOutputs.length} completed results`)}
          description={L("파일 하나가 끝날 때마다 즉시 추가됩니다. 필요한 파일만 받거나 전체를 개별 파일로 받고, 필요할 때만 ZIP을 만들 수 있습니다.", "Each file appears as soon as it finishes. Download only what you need, download all individually, or create a ZIP when required.")}
        >
          <div className="video-result-list" aria-live="polite">
            {videoOutputs.map((output, index) => (
              <article className="video-result-item" key={output.id}>
                <span>{isAudioOutput(output) ? <Music2 size={18} /> : <Film size={18} />}<span><strong>{output.fileName}</strong><small>{formatBytes(output.blob.size)} · {L("결과", "result")} {index + 1}</small></span></span>
                <div className="video-result-item-actions">
                  <a className="result-download" href={output.url} download={output.fileName}><Download size={16} /> {L("개별 다운로드", "Download")}</a>
                  {isAudioOutput(output) && <button type="button" className="secondary-button audio-handoff-button" onClick={() => openInAudioStudio(output)}><Waves size={16} /> {L("오디오 스튜디오에서 계속 편집", "Continue in Audio Studio")}</button>}
                </div>
              </article>
            ))}
          </div>
          <div className="video-result-actions">
            <button type="button" className="secondary-button" disabled={progress.status === "running"} onClick={downloadAllOutputs}><Download size={17} /> {L("전체 개별 다운로드", "Download all individually")}</button>
            {directorySaveAvailable && <button type="button" className="secondary-button" disabled={progress.status === "running"} onClick={() => void saveOutputsToFolder()}><FolderDown size={17} /> {L("폴더에 저장", "Save to folder")}</button>}
            <button type="button" className="secondary-button" disabled={progress.status === "running"} onClick={() => void createZipArchive()}><Archive size={17} /> {L("ZIP으로 묶기", "Create ZIP")}</button>
            <button type="button" className="secondary-button danger" disabled={progress.status === "running"} onClick={() => { clearVideoOutputs(); setLastResult(""); progress.reset(); }}><Trash2 size={17} /> {L("결과 지우기", "Clear results")}</button>
          </div>
          <div className="video-download-guidance">
            <AlertTriangle size={16} />
            <span>{language === "ko" ? <><strong>전체 개별 다운로드</strong>는 브라우저가 여러 파일 다운로드 허용을 요청할 수 있습니다. ZIP은 영상 용량이 거의 줄지 않고 원본 결과와 ZIP을 함께 메모리에 두므로, 공유용 묶음이 꼭 필요할 때만 사용하세요.</> : <><strong>Download all individually</strong> may prompt your browser to allow multiple downloads. ZIP barely reduces video size and keeps both results and the archive in memory, so use it only when you need one bundle.</>}</span>
          </div>
        </SectionCard>
      )}

      <ToolGuide
        title={L("브라우저 비디오 처리 안내", "Browser video processing guide")}
        description={L("영상 파일은 외부 변환 서버에 업로드하지 않고 이 페이지의 별도 작업 공간에서 처리합니다.", "Video files are processed in an isolated workspace on this page and are not uploaded to a conversion server.")}
        blocks={language === "ko" ? [
          { title: "계속 추가와 그룹별 출력", paragraphs: ["영상은 파일 선택 창을 여러 번 열거나 드롭을 반복해 기존 목록 뒤에 계속 추가할 수 있습니다. 최대 10개 그룹에서 순서를 정하고, 각 그룹은 영상을 각각 출력하거나 선택 구간만 이어붙입니다. 완성된 결과는 파일별로 바로 표시하며 ZIP은 필요할 때만 따로 만듭니다. MP3·AAC 결과는 버튼으로 오디오 스튜디오 새 탭에 바로 전달할 수 있습니다."] },
          { title: "원본 그대로 복사(패스스루)와 정확도", paragraphs: ["영상 압축을 다시 하지 않고 원본을 복사하면 빠르고 화질 손실이 없습니다. 음성은 첫 번째 항목만 그대로 복사하거나 제거하거나 호환 형식으로 다시 변환할 수 있습니다. 원본 음성이 출력 파일 형식과 맞지 않으면 품질을 임의로 바꾸지 않고 오류로 안내합니다. 가까운 재생 기준 장면(키프레임)에 맞추느라 시작점이 조금 앞설 수 있으며, 압축 방식이나 해상도가 다른 영상은 다시 압축하지 않고 이어붙일 수 없습니다."] },
          { title: "비트레이트와 샘플레이트", paragraphs: ["비트레이트는 초당 저장할 데이터 양으로, 높을수록 대체로 화질·음질과 파일 크기가 커집니다. 샘플레이트는 음성을 1초에 몇 번 측정하는지를 뜻합니다. 권장 목록 또는 직접 수치로 설정할 수 있습니다."] },
          { title: "동기 재생과 분할 전체화면", paragraphs: ["그룹 안의 영상을 함께 재생하고 공통 탐색 바로 위치를 맞출 수 있습니다. 분할 전체화면에서는 그룹에 넣은 영상을 한 화면에서 비교하며 선택한 영상 하나의 소리만 듣습니다."] },
          { title: "대용량 원본과 결과 한도", paragraphs: ["원본 영상은 통째로 복사하지 않고 브라우저의 읽기 전용 파일 연결로 변환 엔진에 전달합니다. 다만 변환 중간 데이터와 완성된 결과는 브라우저 메모리를 사용하므로, 긴 4K 영상은 필요한 구간을 먼저 줄이는 것이 좋습니다. 원본 그대로 복사한 예상 결과가 안전 한도를 넘으면 작업 전에 안내합니다."] },
          { title: "입력 형식 호환성", paragraphs: ["MP4·MOV·WebM은 일반적인 최신 브라우저에서 미리보기를 제공합니다. MKV·AVI 미리보기가 실패하면 브라우저용 변환 엔진이 재생 시간과 화면 크기를 대신 확인해 숫자 구간 입력을 열어 주지만, 파일 안의 모든 영상 압축 방식까지 완벽하게 지원하지는 않습니다."] },
          { title: "여러 CPU 코어 사용", paragraphs: ["지원 브라우저에서는 비디오 도구만 별도의 안전한 실행 환경으로 다시 열어 여러 CPU 코어를 사용합니다. 주소와 도메인은 그대로 유지되며 다른 도구와 광고 실행 환경에는 영향을 주지 않습니다. 조건을 만족하지 않으면 기능이 같은 단일 코어 방식으로 자동 전환합니다."] },
        ] : [
          { title: "Adding files and group outputs", paragraphs: ["Open the file picker or drop files repeatedly to append videos. Arrange them in up to 10 groups; each group can export individually or concatenate selected ranges. Results appear as they finish, and ZIP creation is optional. MP3 and AAC results can be sent directly to Audio Studio in a new tab."] },
          { title: "Passthrough and trim accuracy", paragraphs: ["Passthrough is fast and lossless because it avoids re-encoding. The first audio track can be copied, removed, or converted. Incompatible source audio reports an error rather than changing quality silently. Trim starts may move to a nearby keyframe, and videos with different codecs or dimensions cannot be concatenated without re-encoding."] },
          { title: "Bitrate and sample rate", paragraphs: ["Bitrate is data stored per second; higher values generally increase quality and file size. Sample rate is how often audio is sampled per second. Choose a preset or enter a custom value."] },
          { title: "Synchronized playback and split fullscreen", paragraphs: ["Play videos in a group together and move them with one playhead. Split fullscreen lets you compare the group on one screen while listening to one selected video."] },
          { title: "Large sources and output limits", paragraphs: ["Source videos are attached to the engine through read-only browser file references rather than copied in full. Intermediate data and final results still use memory, so trim long 4K sources first. Oversized passthrough estimates are reported before processing."] },
          { title: "Input compatibility", paragraphs: ["MP4, MOV, and WebM usually preview in current browsers. If MKV or AVI preview fails, the conversion engine tries to read duration and dimensions for numeric trimming, but not every internal codec is guaranteed."] },
          { title: "Using multiple CPU cores", paragraphs: ["Supported browsers reopen only the video tool in a secure isolated runtime that can use multiple CPU cores. The address and domain stay the same, and other tools and ad execution are unaffected. A functionally equivalent single-core path is used when requirements are not met."] },
        ]}
        faq={language === "ko" ? [
          { question: "영상이 서버로 전송되나요?", answer: "아니요. 선택한 파일은 브라우저 안의 변환 엔진에서만 읽으며 영상 데이터와 결과를 서버로 전송하지 않습니다." },
          { question: "그룹별 출력은 어떻게 내려받나요?", answer: "완성된 파일마다 개별 다운로드 버튼이 생깁니다. 전체 개별 다운로드, 지원 브라우저의 폴더 저장, 선택형 ZIP 묶기 중에서 원하는 방식을 고를 수 있습니다." },
          { question: "GIF와 음원 추출은 어디서 선택하나요?", answer: "출력 형식에서 GIF, MP3 또는 AAC를 고르면 필요한 설정만 자동으로 표시됩니다. MP3·AAC 결과에는 오디오 스튜디오에서 계속 편집하는 버튼도 표시됩니다." },
          { question: "영상의 소리를 그대로 두거나 없앨 수 있나요?", answer: "네. 영상 출력에서 파일 안의 첫 번째 음성을 그대로 복사하거나 제거하거나 호환 형식으로 다시 변환할 수 있습니다. 여러 음성 트랙을 고르는 기능은 현재 지원하지 않습니다." },
          { question: "다시 압축하지 않고 이어붙일 수 있나요?", answer: "영상·음성 압축 방식과 해상도 구성이 서로 맞으면 가능합니다. 맞지 않으면 자동으로 품질을 바꾸지 않고 다시 압축해야 한다고 안내합니다." },
          { question: "왜 첫 실행이 오래 걸리나요?", answer: "사이트에 포함된 브라우저용 영상 변환 실행 파일을 처음 불러오고 메모리를 준비하기 때문입니다. 브라우저 캐시에 저장되면 다음 작업의 준비 시간은 짧아질 수 있습니다." },
          { question: "남은 시간은 전체 작업 기준인가요?", answer: "현재 처리 중인 영상과 인코딩 단계의 최근 속도를 기준으로 다시 계산합니다. 새 영상이나 최종 연결 단계가 시작되면 이전 단계의 누적 시간을 섞지 않고 잠시 측정한 뒤 새 예상 시간을 표시합니다." },
          { question: "MKV·AVI도 항상 변환되나요?", answer: "아니요. 브라우저 미리보기가 안 되면 변환 엔진이 재생 시간과 크기 같은 파일 정보를 대신 분석하지만, 파일 안의 영상 압축 방식을 읽지 못하는 조합까지 보장하지는 않습니다." },
        ] : [
          { question: "Are videos sent to a server?", answer: "No. Selected files are read only by the in-browser conversion engine; video data and results are not sent to a server." },
          { question: "How do I download group outputs?", answer: "Each completed file gets its own download button. You can also download all individually, save to a folder in supported browsers, or create an optional ZIP." },
          { question: "Where do I select GIF or audio extraction?", answer: "Choose GIF, MP3, or AAC as the output format. Only the relevant settings appear, and MP3/AAC results can continue in Audio Studio." },
          { question: "Can I keep or remove video audio?", answer: "Yes. Copy, remove, or convert the first audio track. Selecting among multiple audio tracks is not currently supported." },
          { question: "Can videos concatenate without re-encoding?", answer: "Yes when video/audio codecs and dimensions are compatible. Otherwise the tool asks you to re-encode instead of silently changing quality." },
          { question: "Why is the first run slow?", answer: "The browser must load the bundled video conversion runtime and allocate memory. Later starts may be faster while assets remain cached." },
          { question: "Is remaining time for the whole job?", answer: "It is recalculated from the recent speed of the current video and encoding stage. A new input or final concat stage starts a fresh estimate." },
          { question: "Do MKV and AVI always work?", answer: "No. The engine can often probe files that browsers cannot preview, but unsupported internal codec combinations are not guaranteed." },
        ]}
      />
    </div>
  );
}

function EncodingSettings({ container, codec, resolution, aspect, crf, bitrate, customBitrate, onCodec, onResolution, onAspect, onCrf, onBitrate, onCustomBitrate, language }: {
  container: "mp4" | "mkv" | "webm";
  codec: VideoCodec;
  resolution: VideoResolution;
  aspect: VideoAspect;
  crf: number;
  bitrate: VideoBitrate;
  customBitrate: string;
  onCodec: (value: VideoCodec) => void;
  onResolution: (value: VideoResolution) => void;
  onAspect: (value: VideoAspect) => void;
  onCrf: (value: number) => void;
  onBitrate: (value: VideoBitrate) => void;
  onCustomBitrate: (value: string) => void;
  language: AppLanguage;
}) {
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  const passthrough = bitrate === "copy";
  return (
    <div className="encoding-grid">
      <label><span>{L("영상 압축 방식(코덱)", "Video codec")}</span><select value={codec} disabled={passthrough} onChange={(event) => onCodec(event.target.value as VideoCodec)}><option value="h264" disabled={container === "webm"}>H.264</option><option value="hevc" disabled={container === "webm"}>HEVC · {L("지원 시", "when supported")}</option><option value="vp9">VP9</option></select></label>
      <label><span>{L("해상도 일괄 변경", "Resize all videos")}</span><select value={resolution} disabled={passthrough} onChange={(event) => onResolution(event.target.value as VideoResolution)}><option value="source">{L("변경 안 함", "Keep source")}</option><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option></select></label>
      <label><span>{L("화면 비율", "Aspect ratio")}</span><select value={aspect} disabled={passthrough} onChange={(event) => onAspect(event.target.value as VideoAspect)}><option value="source">{L("원본 비율 유지", "Keep source ratio")}</option><option value="9:16">9:16 {L("세로", "portrait")}</option><option value="1:1">1:1 {L("정사각형", "square")}</option><option value="16:9">16:9 {L("가로", "landscape")}</option></select></label>
      <label><span>{L("영상 처리 방식·용량 기준", "Video processing & size target")}</span><select value={bitrate} onChange={(event) => onBitrate(event.target.value as VideoBitrate)}><option value="copy">{L("원본 그대로 복사(패스스루)", "Copy source (passthrough)")}</option><option value="0">{L("화질 기준 자동 용량 조절(CRF)", "Quality-based size (CRF)")}</option><option value="2M">2 Mbps</option><option value="5M">5 Mbps</option><option value="8M">8 Mbps</option><option value="custom">{L("직접입력", "Custom")}</option></select></label>
      {bitrate === "custom" && <label className={`custom-encoding-input${isNumberInRange(customBitrate, 0.1, 200) ? "" : " invalid"}`}><span>{L("영상 비트레이트 직접입력", "Custom video bitrate")}</span><span className="unit-input"><input aria-label={L("영상 비트레이트 직접입력", "Custom video bitrate")} type="number" min={0.1} max={200} step={0.1} inputMode="decimal" value={customBitrate} onChange={(event) => onCustomBitrate(event.target.value)} /><b>Mbps</b></span><small>0.1~200 Mbps</small></label>}
      <label className="crf-control"><span>{L("화질 기준(CRF)", "Quality (CRF)")} <b>{crf}</b></span><input type="range" min={18} max={32} value={crf} disabled={passthrough} onChange={(event) => onCrf(Number(event.target.value))} /><small>{L("값이 낮을수록 더 선명하고 파일이 커집니다.", "Lower values are sharper and produce larger files.")}</small></label>
    </div>
  );
}

function AudioTrackSettings(props: {
  mode: VideoAudioMode;
  bitrate: VideoAudioBitrate;
  customBitrate: string;
  sampleRate: VideoAudioSampleRate;
  customSampleRate: string;
  onMode: (value: VideoAudioMode) => void;
  onBitrate: (value: VideoAudioBitrate) => void;
  onCustomBitrate: (value: string) => void;
  onSampleRate: (value: VideoAudioSampleRate) => void;
  onCustomSampleRate: (value: string) => void;
  language: AppLanguage;
}) {
  const L = (ko: string, en: string) => props.language === "ko" ? ko : en;
  return (
    <div className="video-audio-settings">
      <div className="video-audio-settings-heading"><Volume2 size={17} /><span><strong>{L("영상 속 음성 처리", "Video audio")}</strong><small>{L("여러 음성이 들어 있어도 첫 번째 음성만 처리합니다.", "Only the first audio track is processed.")}</small></span></div>
      <SegmentedControl
        value={props.mode}
        options={[
          { value: "copy", label: L("원본 음성 복사", "Copy audio") },
          { value: "remove", label: L("음성 제거", "Remove audio") },
          { value: "encode", label: L("호환 형식 변환", "Convert audio") },
        ]}
        onChange={props.onMode}
        label={L("영상 속 음성 처리 방식", "Video audio mode")}
      />
      {props.mode === "encode" && <AudioEncodingFields {...props} />}
    </div>
  );
}

function AudioEncodingFields({ bitrate, customBitrate, sampleRate, customSampleRate, onBitrate, onCustomBitrate, onSampleRate, onCustomSampleRate, language }: {
  bitrate: VideoAudioBitrate;
  customBitrate: string;
  sampleRate: VideoAudioSampleRate;
  customSampleRate: string;
  onBitrate: (value: VideoAudioBitrate) => void;
  onCustomBitrate: (value: string) => void;
  onSampleRate: (value: VideoAudioSampleRate) => void;
  onCustomSampleRate: (value: string) => void;
  language: AppLanguage;
}) {
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  return (
    <div className="quick-tool-settings audio-encoding-fields">
      <label><span>{L("음질·용량(비트레이트)", "Audio quality & size (bitrate)")}</span><select value={bitrate} onChange={(event) => onBitrate(event.target.value as VideoAudioBitrate)}><option value="128k">128 kbps</option><option value="192k">192 kbps · {L("권장", "recommended")}</option><option value="256k">256 kbps</option><option value="320k">320 kbps</option><option value="custom">{L("직접입력", "Custom")}</option></select></label>
      {bitrate === "custom" && <label className={isIntegerInRange(customBitrate, 32, 512) ? "" : "invalid"}><span>{L("오디오 비트레이트 직접입력", "Custom audio bitrate")}</span><span className="unit-input"><input aria-label={L("오디오 비트레이트 직접입력", "Custom audio bitrate")} type="number" min={32} max={512} step={1} inputMode="numeric" value={customBitrate} onChange={(event) => onCustomBitrate(event.target.value)} /><b>kbps</b></span><small>32~512 kbps</small></label>}
      <label><span>{L("초당 음성 표본 수(샘플레이트)", "Audio sample rate")}</span><select value={sampleRate} onChange={(event) => onSampleRate(event.target.value as VideoAudioSampleRate)}><option value="source">{L("원본 유지", "Keep source")}</option><option value="44100">44,100 Hz</option><option value="48000">48,000 Hz · {L("권장", "recommended")}</option><option value="custom">{L("직접입력", "Custom")}</option></select></label>
      {sampleRate === "custom" && <label className={isIntegerInRange(customSampleRate, 8_000, 192_000) ? "" : "invalid"}><span>{L("샘플레이트 직접입력", "Custom sample rate")}</span><span className="unit-input"><input aria-label={L("오디오 샘플레이트 직접입력", "Custom sample rate")} type="number" min={8000} max={192000} step={100} inputMode="numeric" value={customSampleRate} onChange={(event) => onCustomSampleRate(event.target.value)} /><b>Hz</b></span><small>8,000~192,000 Hz</small></label>}
    </div>
  );
}

function createTask(settings: {
  outputFormat: VideoOutputFormat;
  codec: VideoCodec;
  resolution: VideoResolution;
  aspect: VideoAspect;
  crf: number;
  bitrate: VideoBitrate;
  customVideoBitrate: string;
  audioMode: VideoAudioMode;
  audioBitrate: VideoAudioBitrate;
  customAudioBitrate: string;
  audioSampleRate: VideoAudioSampleRate;
  customAudioSampleRate: string;
  gifFps: 10 | 12 | 15 | 20;
  gifWidth: 480 | 720 | 1080;
}): VideoTask {
  if (settings.outputFormat === "gif") return { kind: "gif", fps: settings.gifFps, width: settings.gifWidth };
  const resolvedAudioBitrate = settings.audioBitrate === "custom" ? `${Math.round(Number(settings.customAudioBitrate))}k` : settings.audioBitrate;
  const resolvedSampleRate = settings.audioSampleRate === "custom"
    ? Math.round(Number(settings.customAudioSampleRate))
    : settings.audioSampleRate === "source" ? "source" as const : Number(settings.audioSampleRate);
  if (settings.outputFormat === "mp3" || settings.outputFormat === "aac") {
    return { kind: "audio", format: settings.outputFormat, bitrate: resolvedAudioBitrate, sampleRate: resolvedSampleRate };
  }
  const resolvedVideoBitrate = settings.bitrate === "custom" ? `${Number(settings.customVideoBitrate)}M` : settings.bitrate;
  return {
    kind: "encode",
    container: settings.outputFormat,
    codec: settings.codec,
    resolution: settings.resolution,
    aspect: settings.aspect,
    crf: settings.crf,
    bitrate: resolvedVideoBitrate,
    audioMode: settings.audioMode,
    audioBitrate: resolvedAudioBitrate,
    audioSampleRate: resolvedSampleRate,
  };
}

function createJobEntries(
  groups: Array<{ group: VideoGroupId; items: VideoItem[] }>,
  settings: Record<VideoGroupId, GroupSettings>,
  allGroupsOneFile: boolean,
  language: AppLanguage,
): VideoJobEntry[] {
  if (allGroupsOneFile) return [{ name: language === "ko" ? "전체-그룹" : "all-groups", mode: "concat" as const, items: groups.flatMap((group) => group.items) }];
  const entries: VideoJobEntry[] = [];
  groups.forEach(({ group, items: groupItems }) => {
    if (settings[group].outputMode === "concat") entries.push({ name: `${language === "ko" ? "그룹" : "group"}-${group}`, mode: "concat", items: groupItems });
    else groupItems.forEach((item, index) => entries.push({ name: `${item.file.name.replace(/\.[^.]+$/, "")}-${language === "ko" ? "그룹" : "group"}${group}-${index + 1}`, mode: "individual", items: [item] }));
  });
  return entries;
}

function toWorkerInput(item: VideoItem): VideoWorkerInput {
  return { fileName: item.file.name, file: item.file, duration: item.duration, width: item.width, height: item.height, start: item.start, end: item.end };
}

function estimatePassthroughBytes(job: VideoJobEntry) {
  return job.items.reduce((sum, item) => {
    const selectedRatio = item.duration > 0 ? Math.min(1, Math.max(0, (item.end - item.start) / item.duration)) : 1;
    return sum + item.file.size * selectedRatio;
  }, 0);
}

function hasIncompatibleConcatDimensions(
  items: VideoItem[],
  groups: Array<{ group: VideoGroupId; items: VideoItem[] }>,
  settings: Record<VideoGroupId, GroupSettings>,
  allGroupsOneFile: boolean,
) {
  const targets = allGroupsOneFile ? [items] : groups.filter(({ group }) => settings[group].outputMode === "concat").map((group) => group.items);
  return targets.some((target) => target.length > 1 && target.some((item) => item.width !== target[0].width || item.height !== target[0].height));
}

function createGroupSettings() {
  return Object.fromEntries(GROUP_IDS.map((group) => [group, { sync: false, outputMode: "individual" as GroupOutputMode }])) as Record<VideoGroupId, GroupSettings>;
}

function createGroupValues<T>(value: T) {
  return Object.fromEntries(GROUP_IDS.map((group) => [group, value])) as Record<VideoGroupId, T>;
}

function createId() { return globalThis.crypto?.randomUUID?.() || `video-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function fileKey(file: File) { return `${file.name}:${file.size}:${file.lastModified}`; }
function isLikelyMobileDevice() { return typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 760); }
function isNumberInRange(value: string, min: number, max: number) {
  const numeric = Number(value);
  return value.trim() !== "" && Number.isFinite(numeric) && numeric >= min && numeric <= max;
}
function isIntegerInRange(value: string, min: number, max: number) {
  const numeric = Number(value);
  return value.trim() !== "" && Number.isInteger(numeric) && numeric >= min && numeric <= max;
}
function isAudioOutput(output: DownloadableVideoOutput) {
  return output.mimeType.startsWith("audio/") || /\.(mp3|m4a|aac)$/i.test(output.fileName);
}
function audioHandoffChannelName(id: string) { return `worklazy-audio-handoff-${id}`; }

function toUserFacingVideoError(error: unknown, language: AppLanguage) {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof RangeError || /array buffer allocation failed|invalid typed array length|out of memory/i.test(message)) {
    return language === "ko" ? "완성된 영상 또는 변환 중간 데이터가 브라우저 메모리 한도를 넘었습니다. 출력 구간·해상도를 줄이거나 원본 그대로 복사(패스스루)를 사용해 주세요." : "The completed video or intermediate data exceeded the browser memory limit. Shorten the range, reduce resolution, or use passthrough.";
  }
  if ((error instanceof DOMException && error.name === "NotReadableError") || /requested file could not be read|permission problems/i.test(message)) {
    return language === "ko" ? "선택한 영상 파일을 읽을 수 없습니다. 파일이 이동·교체되었거나 브라우저의 접근 권한이 해제되었을 수 있습니다. 원본 파일을 다시 선택해 주세요." : "The selected video cannot be read. It may have moved, changed, or lost browser permission. Select the source file again.";
  }
  return message || (language === "ko" ? "비디오 처리에 실패했습니다." : "Video processing failed.");
}
function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00.0";
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${remaining.toFixed(1).padStart(4, "0")}`;
}
function downloadBuffer(buffer: ArrayBuffer, mimeType: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
  triggerDownloadUrl(url, fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function triggerDownloadUrl(url: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
}
