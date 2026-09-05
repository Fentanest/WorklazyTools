import {
  AlertTriangle,
  Archive,
  Cpu,
  Download,
  Film,
  FolderDown,
  Gauge,
  ListVideo,
  Music2,
  Sparkles,
  Trash2,
  Volume2,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { UtilityField, UtilityInput, UtilityNotice, UtilityPage, UtilitySectionCard, UtilitySelect } from "../../components/UtilitySurface";
import { FileDropZone, PageHeader, PrimaryButton, SegmentedControl, ToggleRow, formatBytes } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import type {
  GroupOutputMode,
  VideoAspect,
  VideoAudioBitrate,
  VideoAudioMode,
  VideoAudioSampleRate,
  VideoBitrate,
  VideoCodec,
  VideoGroupId,
  VideoGroupSettings,
  VideoItem,
  VideoOutputFormat,
  VideoOutputJob,
  VideoResultData,
  VideoResultStorageSession,
  VideoResolution,
  VideoRotation,
  VideoTask,
  VideoWorkerInput,
  VideoWorkerOutput,
} from "./types";
import { probeVideoMetadata } from "./videoWorkerClient";
import {
  preflightVideoProcessingRoutes,
  runVideoProcessingTask,
  isTargetBitrateVideoEncodeTask,
  taskForVideoJob,
  type VideoProcessingJobRoute,
} from "./videoProcessingClient";
import { MAX_SAFE_FFMPEG_OUTPUT_BYTES, isSafeFfmpegOutputSize } from "./videoRouting";
import { createVideoZip } from "./videoZipClient";
import { VIDEO_GROUP_IDS } from "./types";
import { VideoGroupSection } from "./VideoGroupSection";
import { hasUsableVideoRange, shouldProbeVideoMetadata } from "./videoMetadata";
import { isUserFacingVideoError } from "./videoErrors";
import { applyGroupRangesByPosition, applyVideoRangeToGroup } from "./videoRanges";
import { useAppLanguage, useLocalizedPath } from "../../i18n/routing";
import type { AppLanguage } from "../../i18n/languages";
import { featureMessage, featureResource } from "../../i18n/featureMessages";
import {
  cleanupPartialVideoResults,
  createVideoResultStorageSession,
  opfsEntryNames,
  releaseVideoResultStorageSession,
  resolveVideoResultFile,
} from "./videoResultStorage";
import {
  guidanceCodeForProbeCause,
  guidanceCodeForRouteReason,
  primaryVideoProbeCause,
  type VideoRouteGuidanceCode,
} from "./videoRouteGuidance";
import { dolbyVisionBaseLayerGuidance } from "./videoDolbyVision";

type GroupSettings = VideoGroupSettings;

interface VideoPageCopy {
  downloadGuidanceLabel: string;
  downloadGuidance: string;
  guide: {
    blocks: Array<{ title: string; paragraphs: string[] }>;
    faq: Array<{ question: string; answer: string }>;
  };
}

interface VideoJobEntry {
  name: string;
  mode: "individual" | "concat";
  items: VideoItem[];
}

interface AudioModeSuggestion {
  jobKey: string;
  jobName: string;
  message: string;
  modes: Array<"remove" | "encode">;
}

interface VideoRouteNotice {
  jobKey: string;
  jobName: string;
  message: string;
}

interface DownloadableVideoOutput {
  id: string;
  fileName: string;
  mimeType: string;
  blob: File;
  data: VideoResultData;
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

const GROUP_IDS = VIDEO_GROUP_IDS;

export function VideoStudioPage() {
  const language = useAppLanguage();
  const videoPage = featureResource<VideoPageCopy>(language, "video.page");
  const audioStudioPath = useLocalizedPath("/tools/audio-studio");
  const mobileDevice = useMemo(isLikelyMobileDevice, []);
  const multiThreadReady = useMemo(() => typeof SharedArrayBuffer !== "undefined" && window.crossOriginIsolated && navigator.hardwareConcurrency > 1, []);
  const [items, setItems] = useState<VideoItem[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [groupSettings, setGroupSettings] = useState<Record<VideoGroupId, GroupSettings>>(createGroupSettings);
  const [allGroupsOneFile, setAllGroupsOneFile] = useState(false);
  const [outputFormat, setOutputFormat] = useState<VideoOutputFormat>("mp4");
  const [codec, setCodec] = useState<VideoCodec>("h264");
  const [resolution, setResolution] = useState<VideoResolution>("source");
  const [aspect, setAspect] = useState<VideoAspect>("source");
  const [crf, setCrf] = useState(23);
  const [rotation, setRotation] = useState<VideoRotation>(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [bitrate, setBitrate] = useState<VideoBitrate>("copy");
  const [customVideoBitrate, setCustomVideoBitrate] = useState("4.5");
  const [audioMode, setAudioMode] = useState<VideoAudioMode>("copy");
  const [audioModeOverrides, setAudioModeOverrides] = useState<Map<string, "remove" | "encode">>(() => new Map());
  const [audioModeSuggestions, setAudioModeSuggestions] = useState<AudioModeSuggestion[]>([]);
  const [routeNotices, setRouteNotices] = useState<VideoRouteNotice[]>([]);
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
  const itemsRef = useRef<VideoItem[]>([]);
  const videoOutputsRef = useRef<DownloadableVideoOutput[]>([]);
  const resultStorageRef = useRef<VideoResultStorageSession | undefined>(undefined);
  const archiveEntriesRef = useRef(new Set<string>());
  const activeController = useRef<AbortController | undefined>(undefined);
  const probeControllers = useRef(new Map<string, AbortController>());
  const probeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const audioHandoffChannels = useRef(new Set<BroadcastChannel>());

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => () => {
    itemsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    videoOutputsRef.current.forEach((output) => URL.revokeObjectURL(output.url));
    activeController.current?.abort();
    if (resultStorageRef.current) void releaseVideoResultStorageSession(resultStorageRef.current);
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
  const usedGroupIds = useMemo(() => usedGroups.map(({ group }) => group), [usedGroups]);
  const metadataBlockedItems = items.filter((item) => !hasUsableVideoRange(item));
  const ready = items.length > 0 && metadataBlockedItems.length === 0;
  const isVideoOutput = outputFormat === "mp4" || outputFormat === "mkv" || outputFormat === "webm";
  const passthroughTransformConflict = isVideoOutput && bitrate === "copy" && (resolution !== "source" || aspect !== "source" || rotation !== 0 || flipHorizontal);
  const passthroughConcatConflict = isVideoOutput && bitrate === "copy" && hasIncompatibleConcatDimensions(items, usedGroups, groupSettings, allGroupsOneFile);
  const passthroughConflict = passthroughTransformConflict || passthroughConcatConflict;
  const videoBitrateInvalid = isVideoOutput && bitrate === "custom" && !isNumberInRange(customVideoBitrate, 0.1, 200);
  const audioEncodingEnabled = (isVideoOutput && audioMode === "encode") || outputFormat === "mp3" || outputFormat === "aac";
  const audioBitrateInvalid = audioEncodingEnabled && audioBitrate === "custom" && !isIntegerInRange(customAudioBitrate, 32, 512);
  const audioSampleRateMaximum = outputFormat === "aac" || (isVideoOutput && outputFormat !== "webm") ? 96_000 : 48_000;
  const audioSampleRateInvalid = audioEncodingEnabled && audioSampleRate === "custom" && !isIntegerInRange(customAudioSampleRate, 8_000, audioSampleRateMaximum);
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
    const incomingFiles = unique.filter((file) => !existing.has(fileKey(file)));
    const largeFiles = incomingFiles.filter((file) => file.size > MAX_SAFE_FFMPEG_OUTPUT_BYTES);
    const rejected = nextFiles.filter((file) => !supported.includes(file));
    const notices = [
      rejected.length ? featureMessage(language, "video.messages.VideoStudioPage.unsupportedFilesWereSkipped", { p0: rejected.map((file) => file.name).join(", ") }) : "",
      largeFiles.length ? featureMessage(language, "video.messages.VideoStudioPage.wereAttachedWithoutCopyingTheEntireSourceInto", { p0: largeFiles.map((file) => `${file.name} (${formatBytes(file.size)})`).join(", ") }) : "",
    ].filter(Boolean);
    setLastResult(notices.join(" "));
    progress.reset();
  };

  const removeItem = useCallback((itemId: string) => {
    const target = itemsRef.current.find((item) => item.id === itemId);
    if (target) URL.revokeObjectURL(target.url);
    probeControllers.current.get(itemId)?.abort();
    probeControllers.current.delete(itemId);
    setItems((current) => current.filter((item) => item.id !== itemId));
    setActiveId((current) => current === itemId ? itemsRef.current.find((item) => item.id !== itemId)?.id : current);
    delete players.current[itemId];
  }, []);

  const updateItem = useCallback((itemId: string, patch: Partial<VideoItem>) => {
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, ...patch } : item));
  }, []);

  const probeItem = useCallback(async (itemId: string, preserveTiming = false) => {
    const item = itemsRef.current.find((candidate) => candidate.id === itemId);
    if (!item || !shouldProbeVideoMetadata(item) || probeControllers.current.has(itemId)) return;
    const controller = new AbortController();
    probeControllers.current.set(itemId, controller);
    updateItem(itemId, {
      probing: preserveTiming ? false : true,
      frameRateProbeStatus: "running",
      metadataError: undefined,
    });
    try {
      const queuedProbe = probeQueueRef.current.then(() => probeVideoMetadata(item.file, controller.signal, language));
      probeQueueRef.current = queuedProbe.then(() => undefined, () => undefined);
      const metadata = await queuedProbe;
      setItems((current) => current.map((candidate) => {
        if (candidate.id !== itemId) return candidate;
        const keepBrowserMetadata = candidate.metadataSource === "browser" && candidate.duration > 0;
        const duration = keepBrowserMetadata ? candidate.duration : metadata.duration;
        return {
          ...candidate,
          ...metadata,
          duration,
          width: keepBrowserMetadata ? candidate.width : metadata.width,
          height: keepBrowserMetadata ? candidate.height : metadata.height,
          end: (preserveTiming || keepBrowserMetadata) && candidate.end > candidate.start
            ? Math.min(candidate.end, duration)
            : duration,
          metadataSource: keepBrowserMetadata ? "browser" : "ffmpeg",
          probing: false,
          frameRateProbeStatus: "done",
          metadataError: undefined,
        };
      }));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setItems((current) => current.map((candidate) => candidate.id === itemId ? {
          ...candidate,
          probing: false,
          frameRateProbeStatus: "failed",
          metadataError: candidate.duration > 0
            ? undefined
            : isUserFacingVideoError(error) ? error.message : featureMessage(language, "video.messages.VideoStudioPage.unableToReadVideoMetadata"),
        } : candidate));
      }
    } finally {
      if (probeControllers.current.get(itemId) === controller) probeControllers.current.delete(itemId);
    }
  }, [language, updateItem]);

  const updateGroup = useCallback((group: VideoGroupId, patch: Partial<GroupSettings>) => {
    setGroupSettings((current) => ({ ...current, [group]: { ...current[group], ...patch } }));
  }, []);

  const moveItem = useCallback((itemId: string, group: VideoGroupId, targetId?: string) => {
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
  }, []);

  const applyRangeToGroup = useCallback((source: VideoItem) => {
    setItems((current) => applyVideoRangeToGroup(current, source));
  }, []);

  const applyRangesToGroups = useCallback((sourceGroup: VideoGroupId, targetGroups: VideoGroupId[]) => {
    const result = applyGroupRangesByPosition(itemsRef.current, sourceGroup, targetGroups);
    itemsRef.current = result.items;
    setItems(result.items);
    return result.summary;
  }, []);

  const clearVideoOutputs = () => {
    videoOutputsRef.current.forEach((output) => URL.revokeObjectURL(output.url));
    videoOutputsRef.current = [];
    setVideoOutputs([]);
    archiveEntriesRef.current.clear();
    const session = resultStorageRef.current;
    resultStorageRef.current = undefined;
    if (session) void releaseVideoResultStorageSession(session);
  };

  const appendVideoOutput = async (output: VideoWorkerOutput) => {
    const blob = await resolveVideoResultFile(output);
    const next = {
      id: createId(),
      fileName: output.fileName,
      mimeType: output.mimeType,
      blob,
      data: output.data,
      url: URL.createObjectURL(blob),
    } satisfies DownloadableVideoOutput;
    videoOutputsRef.current = [...videoOutputsRef.current, next];
    setVideoOutputs(videoOutputsRef.current);
    setLastResult(featureMessage(language, "video.messages.VideoStudioPage.isReadyDownloadItFromTheResultsBelow", { p0: next.fileName }));
  };

  const downloadAllOutputs = () => {
    videoOutputsRef.current.forEach((output) => triggerDownloadUrl(output.url, output.fileName));
    setLastResult(featureMessage(language, "video.messages.VideoStudioPage.requestedIndividualDownloadsAllowMultipleDownloadsIfYour", { p0: videoOutputsRef.current.length }));
  };

  const saveOutputsToFolder = async () => {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker || !videoOutputsRef.current.length) return;
    try {
      const directory = await picker.call(window);
      progress.start(featureMessage(language, "video.messages.VideoStudioPage.savingResultsToTheSelectedFolder"));
      for (let index = 0; index < videoOutputsRef.current.length; index += 1) {
        const output = videoOutputsRef.current[index];
        progress.update(Math.round((index / videoOutputsRef.current.length) * 100), featureMessage(language, "video.messages.VideoStudioPage.saving", { p0: index + 1, p1: videoOutputsRef.current.length, p2: output.fileName }));
        const fileHandle = await directory.getFileHandle(output.fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(output.blob);
        await writable.close();
      }
      progress.succeed(featureMessage(language, "video.messages.VideoStudioPage.savedResultsToTheSelectedFolder", { p0: videoOutputsRef.current.length }));
      setLastResult(featureMessage(language, "video.messages.VideoStudioPage.savedResultsToTheSelectedFolder", { p0: videoOutputsRef.current.length }));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      progress.fail(featureMessage(language, "video.messages.VideoStudioPage.unableToSaveResultsToTheSelectedFolder"));
    }
  };

  const createZipArchive = async () => {
    if (!videoOutputsRef.current.length) return;
    const controller = new AbortController();
    activeController.current = controller;
    progress.start(featureMessage(language, "video.messages.VideoStudioPage.creatingAZipFromTheSelectedResults"));
    setLastResult("");
    try {
      const result = await createVideoZip(
        videoOutputsRef.current.map(({ fileName, blob }) => ({ fileName, blob })),
        progress.update,
        controller.signal,
        language,
        resultStorageRef.current,
      );
      const archive = await resolveVideoResultFile(result);
      if (result.data.kind === "opfs") archiveEntriesRef.current.add(result.data.entryName);
      downloadBlob(archive, result.fileName);
      progress.succeed(featureMessage(language, "video.messages.VideoStudioPage.created", { p0: result.fileName }));
      setLastResult(featureMessage(language, "video.messages.VideoStudioPage.createdAndDownloaded", { p0: result.fileName }));
    } catch (error) {
      progress.fail(error instanceof DOMException && error.name === "AbortError" ? featureMessage(language, "video.messages.VideoStudioPage.zipCreationWasCanceled") : toUserFacingVideoError(error, language));
    } finally {
      const session = resultStorageRef.current;
      if (session) {
        const keepEntries = [...opfsEntryNames(videoOutputsRef.current), ...archiveEntriesRef.current];
        await cleanupPartialVideoResults(session, keepEntries).catch(() => undefined);
      }
      if (activeController.current === controller) activeController.current = undefined;
    }
  };

  const openInAudioStudio = (output: DownloadableVideoOutput) => {
    if (!("BroadcastChannel" in window)) {
      setLastResult(featureMessage(language, "video.messages.VideoStudioPage.thisBrowserCannotTransferFilesBetweenToolsIn"));
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
        setLastResult(featureMessage(language, "video.messages.VideoStudioPage.sentToAudioStudioInANewTab", { p0: output.fileName }));
        closeChannel();
      }
    };
    const target = new URL(audioStudioPath, window.location.origin);
    target.searchParams.set("handoff", handoffId);
    const opened = window.open(target.href, "_blank");
    if (!opened) {
      closeChannel();
      setLastResult(featureMessage(language, "video.messages.VideoStudioPage.theNewTabWasBlockedAllowPopUps"));
      return;
    }
    window.setTimeout(() => {
      if (audioHandoffChannels.current.has(channel)) {
        closeChannel();
        if (!transferred) setLastResult(featureMessage(language, "video.messages.VideoStudioPage.theAudioStudioConnectionTimedOutDownloadThe"));
      }
    }, 30_000);
  };

  const outputAction = async () => {
    if (!ready || !validateSegments(items) || passthroughConflict) return;
    if (outputSettingsInvalid) {
      progress.start(featureMessage(language, "video.messages.VideoStudioPage.checkingCustomValues"));
      progress.fail(featureMessage(language, "video.messages.VideoStudioPage.enterVideoBitrateFrom01200Mbps", { p0: audioSampleRateMaximum.toLocaleString() }));
      return;
    }
    const task = createTask({
      outputFormat,
      codec,
      resolution,
      aspect,
      crf,
      rotation,
      flipHorizontal,
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
    const jobs: VideoOutputJob[] = jobEntries.map((job) => ({
      name: job.name,
      mode: job.mode,
      inputs: job.items.map(toWorkerInput),
      audioModeOverride: audioModeOverrides.get(videoJobKey(job)),
    }));
    const routePreflight = await preflightVideoProcessingRoutes({ mode: "batch", jobs, task });
    const notices = routePreflight.jobs.flatMap((route) => routeNoticesForJob(route, jobEntries[route.jobIndex], task, language));
    setRouteNotices(notices);
    const suggested = routePreflight.jobs.flatMap((route) => {
      const modes = route.audioModeSuggestions.filter((mode) => jobs[route.jobIndex].audioModeOverride !== mode);
      if (!modes.length) return [];
      const entry = jobEntries[route.jobIndex];
      return [{
        jobKey: videoJobKey(entry),
        jobName: entry.name,
        message: audioSuggestionMessage(modes, language),
        modes,
      }];
    });
    if (suggested.length) {
      setAudioModeSuggestions(suggested);
      progress.start(featureMessage(language, "video.messages.VideoStudioPage.checkingSourceCompatibility"));
      progress.fail(suggested[0].message);
      return;
    }
    setAudioModeSuggestions([]);
    if (isTargetBitrateVideoEncodeTask(task)) {
      const oversizedRoute = routePreflight.jobs.find(({ decision, estimatedOutputBytes }) => (
        decision.route === "ffmpeg" && !isSafeFfmpegOutputSize(estimatedOutputBytes)
      ));
      const oversized = oversizedRoute && {
        job: jobEntries[oversizedRoute.jobIndex],
        estimate: oversizedRoute.estimatedOutputBytes,
        cause: primaryVideoProbeCause(oversizedRoute.probeDetails),
        reasonCode: oversizedRoute.decision.reasonCode,
      };
      if (oversized) {
        progress.start(featureMessage(language, "video.messages.VideoStudioPage.checkingEstimatedPassthroughOutputSize"));
        const guidanceCode = oversized.cause
          ? guidanceCodeForProbeCause(oversized.cause)
          : guidanceCodeForRouteReason(oversized.reasonCode);
        const causeMessage = guidanceCode ? routeGuidanceMessage(guidanceCode, language) : "";
        progress.fail(`${causeMessage} ${featureMessage(language, "video.messages.VideoStudioPage.isEstimatedAtAboutLargeSourceFilesAre", { p0: oversized.job.name, p1: formatBytes(oversized.estimate) })}`.trim());
        return;
      }
    }
    const totalSize = items.reduce((sum, item) => sum + item.file.size, 0);
    const cautionBytes = mobileDevice ? 250 * 1024 * 1024 : 500 * 1024 * 1024;
    const onlyProgressiveProcessing = routePreflight.jobs.length > 0
      && routePreflight.jobs.every(({ decision }) => decision.route !== "ffmpeg");
    const largeFileMessage = onlyProgressiveProcessing
      ? "video.messages.VideoStudioPage.largeStreamingFileNotice"
      : "video.messages.VideoStudioPage.largeFileNoticeTheSelectedSourcesTotalThey";
    if (totalSize > cautionBytes && !window.confirm(featureMessage(language, largeFileMessage, { p0: formatBytes(totalSize) }))) return;
    await executeTask((controller, onOutput, resultStorage) => {
      return runVideoProcessingTask(
        { mode: "batch", jobs, task, resultStorage },
        progress.update,
        onOutput,
        controller.signal,
        language,
        routePreflight,
      );
    });
  };

  const executeTask = async (task: (
    controller: AbortController,
    onOutput: (output: VideoWorkerOutput) => Promise<void>,
    resultStorage: VideoResultStorageSession,
  ) => ReturnType<typeof runVideoProcessingTask>) => {
    const controller = new AbortController();
    activeController.current = controller;
    clearVideoOutputs();
    progress.start(featureMessage(language, "video.messages.VideoStudioPage.attachingSourceVideosToTheProcessingEngineWithout"));
    setLastResult("");
    try {
      const resultStorage = await createVideoResultStorageSession();
      if (controller.signal.aborted) {
        await releaseVideoResultStorageSession(resultStorage);
        throw new DOMException(featureMessage(language, "video.messages.VideoStudioPage.videoProcessingWasCanceled"), "AbortError");
      }
      resultStorageRef.current = resultStorage;
      const result = await task(controller, appendVideoOutput, resultStorage);
      setLastResult(featureMessage(language, "video.messages.VideoStudioPage.allResultsAreReady", { p0: result.outputCount, p1: result.warnings.length ? ` ${result.warnings[0]}` : "" }));
      progress.succeed(featureMessage(language, "video.messages.VideoStudioPage.resultsCreated", { p0: result.outputCount }));
    } catch (error) {
      progress.fail(error instanceof DOMException && error.name === "AbortError" ? featureMessage(language, "video.messages.VideoStudioPage.videoProcessingWasCanceled") : toUserFacingVideoError(error, language));
      if (videoOutputsRef.current.length) setLastResult(featureMessage(language, "video.messages.VideoStudioPage.resultsCompletedAndCanBeDownloadedIndividuallyBelow", { p0: videoOutputsRef.current.length }));
    } finally {
      const session = resultStorageRef.current;
      if (session) {
        await cleanupPartialVideoResults(session, opfsEntryNames(videoOutputsRef.current)).catch(() => undefined);
        if (!videoOutputsRef.current.length) {
          resultStorageRef.current = undefined;
          await releaseVideoResultStorageSession(session);
        }
      }
      if (activeController.current === controller) activeController.current = undefined;
    }
  };

  const validateSegments = (targets: VideoItem[]) => {
    const invalid = targets.find((item) => !item.duration || item.end <= item.start);
    if (!invalid) return true;
    progress.start(featureMessage(language, "video.messages.VideoStudioPage.checkingTrimRanges"));
    progress.fail(featureMessage(language, "video.messages.VideoStudioPage.theEndTimeMustBeAfterTheStart", { p0: invalid.file.name }));
    return false;
  };

  const changeOutputFormat = (format: VideoOutputFormat) => {
    setOutputFormat(format);
    if (format === "webm") setCodec("vp9");
    setLastResult("");
    progress.reset();
  };

  const changeAudioMode = (value: VideoAudioMode) => {
    setAudioMode(value);
    setAudioModeOverrides(new Map());
    setAudioModeSuggestions([]);
    setRouteNotices([]);
  };

  const acceptAudioModeSuggestion = (suggestion: AudioModeSuggestion, mode: "remove" | "encode") => {
    setAudioModeOverrides((current) => new Map(current).set(suggestion.jobKey, mode));
    setAudioModeSuggestions((current) => current.filter((item) => item.jobKey !== suggestion.jobKey));
    setLastResult(featureMessage(
      language,
      mode === "encode"
        ? "video.messages.VideoStudioPage.audioEncodingSelectedFor"
        : "video.messages.VideoStudioPage.audioRemovalSelectedFor",
      { p0: suggestion.jobName },
    ));
    progress.reset();
  };

  const changeVideoBitrate = (value: VideoBitrate) => {
    setBitrate(value);
    if (value !== "copy") return;
    setResolution("source");
    setAspect("source");
    setRotation(0);
    setFlipHorizontal(false);
  };

  return (
    <UtilityPage toolId="video-studio" className="video-studio-page">
      <PageHeader eyebrow="VIDEO STUDIO" title={featureMessage(language, "video.messages.VideoStudioPage.videoStudio")} description={featureMessage(language, "video.messages.VideoStudioPage.keepAddingVideosWithoutAFileCountLimit")}>
        <PrivacyBanner compact />
      </PageHeader>

      <UtilityNotice
        data-testid="video-runtime-status"
        tone={multiThreadReady ? "success" : "warning"}
        className="mb-[15px] border border-current/15 px-3.5 py-3"
      >
        <Cpu size={19} />
        <span className="min-w-0">
          <strong className="block text-[15px] text-foreground">{multiThreadReady ? featureMessage(language, "video.messages.VideoStudioPage.multiThreadEncodingReady") : featureMessage(language, "video.messages.VideoStudioPage.singleThreadCompatibilityMode")}</strong>
          <small className="mt-1 block text-sm leading-relaxed text-muted-foreground">{multiThreadReady
            ? featureMessage(language, "video.messages.VideoStudioPage.aDedicatedVideoRuntimeUsesMultipleCpuCores")
            : featureMessage(language, "video.messages.VideoStudioPage.thisBrowserCannotMeetTheMultiThreadRequirements")}</small>
        </span>
      </UtilityNotice>

      <UtilitySectionCard step={1} title={featureMessage(language, "video.messages.VideoStudioPage.chooseVideos")} description={featureMessage(language, "video.messages.VideoStudioPage.addFilesInMultipleRoundsWithNoFile")}>
        <FileDropZone files={files} onFiles={handleFiles} accept="video/*,.mkv,.avi" multiple hint={featureMessage(language, "video.messages.VideoStudioPage.mp4MovWebmMkvAviAddMoreAt")} accent="pink" />
        <UtilityNotice tone="warning" className="mt-3"><AlertTriangle size={16} /><span>{featureMessage(language, "video.messages.VideoStudioPage.mkvAndAviCompatibilityDependsOnTheirInternal")}</span></UtilityNotice>
        {mobileDevice && <UtilityNotice tone="warning" className="mt-2"><Gauge size={16} /><span>{featureMessage(language, "video.messages.VideoStudioPage.mobileDefaultsAre1080pAnd480PxGif")}</span></UtilityNotice>}
      </UtilitySectionCard>

      {items.length > 0 && (
        <UtilitySectionCard step={2} title={featureMessage(language, "video.messages.VideoStudioPage.groupPreviewsAndTrimRanges")} description={featureMessage(language, "video.messages.VideoStudioPage.dragVideosToReorderThemWithinAGroup")}>
          <div className="video-sync-groups grid gap-3">
            {usedGroups.map(({ group, items: groupItems }) => (
              <VideoGroupSection
                key={group}
                group={group}
                items={groupItems}
                settings={groupSettings[group]}
                availableGroups={usedGroupIds}
                activeId={activeId}
                language={language}
                players={players}
                onActivate={setActiveId}
                onUpdateItem={updateItem}
                onUpdateSettings={updateGroup}
                onMoveItem={moveItem}
                onRemoveItem={removeItem}
                onProbeItem={probeItem}
                onApplyRange={applyRangeToGroup}
                onApplyGroupRanges={applyRangesToGroups}
                onNotice={setLastResult}
              />
            ))}
          </div>
        </UtilitySectionCard>
      )}

      {items.length > 0 && (
        <UtilitySectionCard step={3} title={featureMessage(language, "video.messages.VideoStudioPage.outputSettings")} description={featureMessage(language, "video.messages.VideoStudioPage.theOutputFormatAutomaticallyDeterminesWhetherToCreate")}>
          <div className="video-output-format-grid mb-[13px] grid grid-cols-2 items-end gap-2.5 max-[620px]:grid-cols-1" data-testid="video-output-format">
            <UtilityField><span>{featureMessage(language, "video.messages.VideoStudioPage.outputFormat")}</span><UtilitySelect value={outputFormat} onChange={(event) => changeOutputFormat(event.target.value as VideoOutputFormat)}><option value="mp4">MP4 {featureMessage(language, "video.messages.VideoStudioPage.video")}</option><option value="mkv">MKV {featureMessage(language, "video.messages.VideoStudioPage.video")}</option><option value="webm">WebM {featureMessage(language, "video.messages.VideoStudioPage.video")}</option><option value="gif">GIF {featureMessage(language, "video.messages.VideoStudioPage.animation")}</option><option value="mp3">MP3 {featureMessage(language, "video.messages.VideoStudioPage.audio")}</option><option value="aac">AAC {featureMessage(language, "video.messages.VideoStudioPage.audio")}</option></UtilitySelect></UtilityField>
            <div className="video-output-count flex min-h-[51px] items-center gap-2.5 rounded-xl bg-pink-600/10 px-[11px] py-[9px] text-pink-700 dark:text-pink-300"><ListVideo size={18} /><span className="flex min-w-0 flex-col"><strong className="text-sm text-foreground">{featureMessage(language, "video.messages.VideoStudioPage.outputFiles", { p0: outputCount })}</strong><small className="mt-[3px] text-[13px] text-muted-foreground">{featureMessage(language, "video.messages.VideoStudioPage.completedFilesAppearInTheIndividualDownloadList")}</small></span></div>
          </div>
          <UtilityNotice tone="warning" className="video-output-limit mb-[13px] mt-[-2px]"><Gauge size={17} /><span className="min-w-0"><strong className="block text-sm text-foreground">{featureMessage(language, "video.messages.VideoStudioPage.browserRecommendationUnder1GbPerOutput")}</strong><small className="mt-[3px] block text-[13px] leading-relaxed text-muted-foreground">{featureMessage(language, "video.messages.VideoStudioPage.theCurrentSafetyLimitIs15Gb")}</small></span></UtilityNotice>

          {isVideoOutput && (
            <EncodingSettings
              container={outputFormat}
              codec={codec}
              resolution={resolution}
              aspect={aspect}
              crf={crf}
              rotation={rotation}
              flipHorizontal={flipHorizontal}
              bitrate={bitrate}
              customBitrate={customVideoBitrate}
              onCodec={setCodec}
              onResolution={setResolution}
              onAspect={setAspect}
              onCrf={setCrf}
              onRotation={setRotation}
              onFlipHorizontal={setFlipHorizontal}
              onBitrate={changeVideoBitrate}
              onCustomBitrate={setCustomVideoBitrate}
              language={language}
            />
          )}

          {outputFormat === "gif" && <div className="mb-3 grid grid-cols-2 gap-3 max-[620px]:grid-cols-1" data-testid="video-gif-settings"><UtilityField><span>{featureMessage(language, "video.messages.VideoStudioPage.gifFrameRate")}</span><UtilitySelect value={gifFps} onChange={(event) => setGifFps(Number(event.target.value) as 10 | 12 | 15 | 20)}><option value={10}>10 fps · {featureMessage(language, "video.messages.VideoStudioPage.smaller")}</option><option value={12}>12 fps · {featureMessage(language, "video.messages.VideoStudioPage.recommended")}</option><option value={15}>15 fps</option><option value={20}>20 fps · {featureMessage(language, "video.messages.VideoStudioPage.smoother")}</option></UtilitySelect></UtilityField><UtilityField><span>{featureMessage(language, "video.messages.VideoStudioPage.maximumWidth")}</span><UtilitySelect value={gifWidth} onChange={(event) => setGifWidth(Number(event.target.value) as 480 | 720 | 1080)}><option value={480}>480px</option><option value={720}>720px · {featureMessage(language, "video.messages.VideoStudioPage.recommended")}</option><option value={1080}>1080px</option></UtilitySelect></UtilityField></div>}
          {isVideoOutput && (
            <AudioTrackSettings
              container={outputFormat}
              mode={audioMode}
              bitrate={audioBitrate}
              customBitrate={customAudioBitrate}
              sampleRate={audioSampleRate}
              customSampleRate={customAudioSampleRate}
              onMode={changeAudioMode}
              onBitrate={setAudioBitrate}
              onCustomBitrate={setCustomAudioBitrate}
              onSampleRate={setAudioSampleRate}
              onCustomSampleRate={setCustomAudioSampleRate}
              language={language}
            />
          )}
          {(outputFormat === "mp3" || outputFormat === "aac") && (
            <AudioEncodingFields
              codec={outputFormat === "mp3" ? "mp3" : "aac"}
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

          <div className="video-global-output-toggle my-[13px] overflow-hidden rounded-[13px] border border-border"><ToggleRow label={featureMessage(language, "video.messages.VideoStudioPage.concatenateAllGroupsIntoOneFile")} description={featureMessage(language, "video.messages.VideoStudioPage.connectGroupsByGroupNumberAndCardOrder")} checked={allGroupsOneFile} onChange={setAllGroupsOneFile} /></div>

          {isVideoOutput && bitrate === "copy" && outputFormat !== "webm" && !passthroughConflict && <UtilityNotice tone="warning" className="mt-[13px]"><Gauge size={17} /><span>{featureMessage(language, "video.messages.VideoStudioPage.passthroughAvoidsReEncodingSoItIsFast")}</span></UtilityNotice>}
          {outputFormat === "webm" && bitrate === "copy" && <UtilityNotice tone="error" role="alert" className="webm-passthrough-warning mt-[13px]"><AlertTriangle size={17} /><span><strong>{featureMessage(language, "video.messages.VideoStudioPage.typicalMp4VideoAndAudioCannotBeCopied")}</strong> {featureMessage(language, "video.messages.VideoStudioPage.reEncodeH264VideoUsingCrfOr")}</span></UtilityNotice>}
          {isVideoOutput && audioMode === "copy" && <UtilityNotice tone="warning" className="mt-[13px]"><Volume2 size={17} /><span>{featureMessage(language, "video.messages.VideoStudioPage.onlyTheFirstAudioTrackIsCopiedWithout")}</span></UtilityNotice>}
          {isVideoOutput && audioMode === "remove" && <UtilityNotice tone="warning" className="video-output-note mt-[13px]"><Volume2 size={17} /><span>{featureMessage(language, "video.messages.VideoStudioPage.audioWillBeRemovedFromTheOutputVideo")}</span></UtilityNotice>}
          {audioModeSuggestions.map((suggestion) => (
            <UtilityNotice tone="error" role="alert" className="video-audio-mode-suggestion mt-[13px] flex-wrap" data-removal-only={suggestion.modes.length === 1 && suggestion.modes[0] === "remove" || undefined} key={suggestion.jobKey}>
              <AlertTriangle size={17} />
              <span className="min-w-0 flex-1"><strong>{suggestion.jobName}</strong> {suggestion.message}</span>
              <span className="video-audio-suggestion-actions flex flex-wrap gap-[7px]" data-testid="video-audio-suggestion-actions">
                {suggestion.modes.includes("encode") && <Button type="button" className="video-audio-encode-suggestion min-h-9 bg-pink-700 px-3 text-white hover:bg-pink-800 focus-visible:ring-pink-700/30" data-testid="video-audio-encode-suggestion" onClick={() => acceptAudioModeSuggestion(suggestion, "encode")}>{featureMessage(language, "video.messages.VideoStudioPage.convertAndKeepAudio")}</Button>}
                {suggestion.modes.includes("remove") && <Button type="button" variant="secondary" className="min-h-9 px-3" data-testid="video-audio-remove-suggestion" onClick={() => acceptAudioModeSuggestion(suggestion, "remove")}>{featureMessage(language, "video.messages.VideoStudioPage.copyVideoWithoutAudio")}</Button>}
              </span>
            </UtilityNotice>
          ))}
          {routeNotices.map((notice) => <UtilityNotice tone="warning" className="video-route-guidance mt-[13px]" key={`${notice.jobKey}:${notice.message}`}><Gauge size={17} /><span><strong>{notice.jobName}</strong> {notice.message}</span></UtilityNotice>)}
          {passthroughTransformConflict && <UtilityNotice tone="error" role="alert" className="mt-[13px]"><Gauge size={17} /><span>{featureMessage(language, "video.messages.VideoStudioPage.changingAspectRatioOrResolutionRequiresReEncoding")}</span></UtilityNotice>}
          {!passthroughTransformConflict && passthroughConcatConflict && <UtilityNotice tone="error" role="alert" className="mt-[13px]"><Gauge size={17} /><span>{featureMessage(language, "video.messages.VideoStudioPage.videosWithDifferentDimensionsOrAspectRatiosCannot")}</span></UtilityNotice>}
          {outputFormat === "gif" && <UtilityNotice tone="warning" className="video-output-note mt-[13px]"><Sparkles size={17} /><span>{featureMessage(language, "video.messages.VideoStudioPage.createsGifsFromEachGroupSSelectedRanges")}</span></UtilityNotice>}
          {(outputFormat === "mp3" || outputFormat === "aac") && <UtilityNotice tone="warning" className="video-output-note mt-[13px]"><Music2 size={17} /><span>{featureMessage(language, "video.messages.VideoStudioPage.extractsOnlyAudioFromEachGroupSSelected")}</span></UtilityNotice>}

          <div className="video-output-summary mt-[13px] overflow-hidden rounded-[13px] border border-border bg-muted/60 [&_p+_p]:border-t [&_p+_p]:border-border [&_p]:m-0 [&_p]:grid [&_p]:min-h-[42px] [&_p]:grid-cols-[72px_minmax(0,1fr)_auto] [&_p]:items-center [&_p]:gap-2.5 [&_p]:px-[11px] [&_p]:py-[7px] max-[620px]:[&_p]:grid-cols-[58px_minmax(0,1fr)_auto] [&_strong]:text-sm [&_span]:text-[13px] [&_span]:text-muted-foreground [&_b]:text-sm [&_b]:text-pink-700 dark:[&_b]:text-pink-300">
            {allGroupsOneFile
              ? <p><strong>{featureMessage(language, "video.messages.VideoStudioPage.allGroups")}</strong><span>{featureMessage(language, "video.messages.VideoStudioPage.concatenateByGroupNumberAndCardOrder")}</span><b>1</b></p>
              : usedGroups.map(({ group, items: groupItems }) => <p key={group}><strong>{featureMessage(language, "video.messages.VideoStudioPage.group")} {group}</strong><span>{groupSettings[group].outputMode === "concat" ? featureMessage(language, "video.messages.VideoStudioPage.concatenateVideosInOrder", { p0: groupItems.length }) : featureMessage(language, "video.messages.VideoStudioPage.exportVideosIndividually", { p0: groupItems.length })}</span><b>{groupSettings[group].outputMode === "concat" ? 1 : groupItems.length}</b></p>)}
          </div>
          <div className="mt-4 flex justify-end max-[620px]:[&_[data-ui-component=primary-button]]:w-full" data-testid="video-output-actions"><PrimaryButton accent="pink" disabled={!ready || passthroughConflict || outputSettingsInvalid} loading={progress.status === "running"} onClick={() => void outputAction()}><Download size={18} /> {featureMessage(language, "video.messages.VideoStudioPage.createResults", { p0: outputCount })}</PrimaryButton></div>
          {!ready && <UtilityNotice tone="error" role="alert" className="mt-[13px]"><AlertTriangle size={17} /><span>{featureMessage(language, "video.messages.VideoStudioPage.exportIsBlockedBecauseMetadataIsUnavailableFor", { p0: metadataBlockedItems.map((item) => item.file.name).join(", ") })}</span></UtilityNotice>}
        </UtilitySectionCard>
      )}

      <OperationProgress {...progress} accent="pink" title={featureMessage(language, "video.messages.VideoStudioPage.videoProcessingLog")} />
      {progress.status === "running" && <div className="mt-2 flex justify-end"><Button type="button" variant="secondary" onClick={() => activeController.current?.abort()}>{featureMessage(language, "video.messages.VideoStudioPage.cancel")}</Button></div>}
      {lastResult && <UtilityNotice tone="success" role="status" className="mt-[13px]" data-testid="video-result-status"><Download size={18} /><span>{lastResult}</span></UtilityNotice>}

      {videoOutputs.length > 0 && (
        <UtilitySectionCard
          className="video-results-card border-pink-600/20"
          title={featureMessage(language, "video.messages.VideoStudioPage.completedResults", { p0: videoOutputs.length })}
          description={featureMessage(language, "video.messages.VideoStudioPage.eachFileAppearsAsSoonAsItFinishes")}
        >
          <div className="video-result-list flex flex-col gap-2" aria-live="polite">
            {videoOutputs.map((output, index) => (
              <Card as="article" className="video-result-item min-h-[58px] flex-row items-center justify-between gap-3 overflow-visible rounded-xl border border-border bg-muted/60 p-2.5 shadow-none ring-0 max-[620px]:flex-col max-[620px]:items-stretch" key={output.id}>
                <span className="flex min-w-0 items-center gap-2.5 text-pink-700 dark:text-pink-300">{isAudioOutput(output) ? <Music2 size={18} /> : <Film size={18} />}<span className="flex min-w-0 flex-col"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-foreground">{output.fileName}</strong><small className="mt-[3px] text-[13px] text-muted-foreground">{formatBytes(output.blob.size)} · {featureMessage(language, "video.messages.VideoStudioPage.result")} {index + 1}</small></span></span>
                <div className="video-result-item-actions flex shrink-0 flex-wrap justify-end gap-[7px] max-[620px]:grid max-[620px]:grid-cols-1">
                  <Button render={<a href={output.url} download={output.fileName} data-testid="video-result-download" />} className="min-h-[37px] bg-pink-700 text-white shadow-md shadow-pink-700/20 hover:bg-pink-800 focus-visible:ring-pink-700/30 max-[620px]:w-full"><Download size={16} /> {featureMessage(language, "video.messages.VideoStudioPage.download")}</Button>
                  {isAudioOutput(output) && <Button type="button" variant="secondary" className="audio-handoff-button min-h-[37px] px-3 text-violet-700 dark:text-violet-300 max-[620px]:w-full" onClick={() => openInAudioStudio(output)}><Waves size={16} /> {featureMessage(language, "video.messages.VideoStudioPage.continueInAudioStudio")}</Button>}
                </div>
              </Card>
            ))}
          </div>
          <div className="video-result-actions mt-3 flex flex-wrap gap-2 max-[620px]:grid max-[620px]:grid-cols-1" data-testid="video-result-actions">
            <Button type="button" variant="secondary" className="min-h-[39px] max-[620px]:w-full" disabled={progress.status === "running"} onClick={downloadAllOutputs}><Download size={17} /> {featureMessage(language, "video.messages.VideoStudioPage.downloadAllIndividually")}</Button>
            {directorySaveAvailable && <Button type="button" variant="secondary" className="min-h-[39px] max-[620px]:w-full" disabled={progress.status === "running"} onClick={() => void saveOutputsToFolder()}><FolderDown size={17} /> {featureMessage(language, "video.messages.VideoStudioPage.saveToFolder")}</Button>}
            <Button type="button" variant="secondary" className="min-h-[39px] max-[620px]:w-full" disabled={progress.status === "running"} onClick={() => void createZipArchive()}><Archive size={17} /> {featureMessage(language, "video.messages.VideoStudioPage.createZip")}</Button>
            <Button type="button" variant="destructive" className="ml-auto min-h-[39px] max-[620px]:ml-0 max-[620px]:w-full" disabled={progress.status === "running"} onClick={() => { clearVideoOutputs(); setLastResult(""); progress.reset(); }}><Trash2 size={17} /> {featureMessage(language, "video.messages.VideoStudioPage.clearResults")}</Button>
          </div>
          <UtilityNotice tone="warning" className="video-download-guidance mt-[11px]">
            <AlertTriangle size={16} />
            <span><strong>{videoPage.downloadGuidanceLabel}</strong>{videoPage.downloadGuidance}</span>
          </UtilityNotice>
          {routeNotices.map((notice) => <UtilityNotice tone="warning" className="video-route-result-guidance mt-[13px]" key={`result:${notice.jobKey}:${notice.message}`}><Gauge size={17} /><span><strong>{notice.jobName}</strong> {notice.message}</span></UtilityNotice>)}
        </UtilitySectionCard>
      )}

      <ToolGuide
        title={featureMessage(language, "video.messages.VideoStudioPage.browserVideoProcessingGuide")}
        description={featureMessage(language, "video.messages.VideoStudioPage.videoFilesAreProcessedInAnIsolatedWorkspace")}
        blocks={videoPage.guide.blocks}
        faq={videoPage.guide.faq}
      />
    </UtilityPage>
  );
}

function EncodingSettings({ container, codec, resolution, aspect, crf, rotation, flipHorizontal, bitrate, customBitrate, onCodec, onResolution, onAspect, onCrf, onRotation, onFlipHorizontal, onBitrate, onCustomBitrate, language }: {
  container: "mp4" | "mkv" | "webm";
  codec: VideoCodec;
  resolution: VideoResolution;
  aspect: VideoAspect;
  crf: number;
  rotation: VideoRotation;
  flipHorizontal: boolean;
  bitrate: VideoBitrate;
  customBitrate: string;
  onCodec: (value: VideoCodec) => void;
  onResolution: (value: VideoResolution) => void;
  onAspect: (value: VideoAspect) => void;
  onCrf: (value: number) => void;
  onRotation: (value: VideoRotation) => void;
  onFlipHorizontal: (value: boolean) => void;
  onBitrate: (value: VideoBitrate) => void;
  onCustomBitrate: (value: string) => void;
  language: AppLanguage;
}) {
  const passthrough = bitrate === "copy";
  const crfMode = bitrate === "0" || codec === "vp9";
  return (
    <div className="grid grid-cols-3 gap-2.5 max-[820px]:grid-cols-2 max-[620px]:grid-cols-1" data-testid="video-encoding-settings">
      <UtilityField className="video-bitrate-control"><span>{featureMessage(language, "video.messages.VideoStudioPage.videoProcessingSizeTarget")}</span><UtilitySelect value={bitrate} onChange={(event) => onBitrate(event.target.value as VideoBitrate)}><option value="copy">{featureMessage(language, "video.messages.VideoStudioPage.copySourcePassthrough")}</option><option value="0">{featureMessage(language, "video.messages.VideoStudioPage.qualityBasedSizeCrf")}</option><option value="2M">2 Mbps</option><option value="5M">5 Mbps</option><option value="8M">8 Mbps</option><option value="custom">{featureMessage(language, "video.messages.VideoStudioPage.custom")}</option></UtilitySelect></UtilityField>
      <UtilityField><span>{featureMessage(language, "video.messages.VideoStudioPage.videoCodec")}</span><UtilitySelect value={codec} disabled={passthrough} onChange={(event) => onCodec(event.target.value as VideoCodec)}><option value="h264" disabled={container === "webm"}>H.264</option><option value="hevc" disabled={container === "webm"}>HEVC · {featureMessage(language, "video.messages.VideoStudioPage.whenSupported")}</option><option value="vp9">VP9</option></UtilitySelect></UtilityField>
      <UtilityField><span>{featureMessage(language, "video.messages.VideoStudioPage.resizeAllVideos")}</span><UtilitySelect value={resolution} disabled={passthrough} onChange={(event) => onResolution(event.target.value as VideoResolution)}><option value="source">{featureMessage(language, "video.messages.VideoStudioPage.keepSource")}</option><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option></UtilitySelect></UtilityField>
      <UtilityField><span>{featureMessage(language, "video.messages.VideoStudioPage.aspectRatio")}</span><UtilitySelect value={aspect} disabled={passthrough} onChange={(event) => onAspect(event.target.value as VideoAspect)}><option value="source">{featureMessage(language, "video.messages.VideoStudioPage.keepSourceRatio")}</option><option value="9:16">9:16 {featureMessage(language, "video.messages.VideoStudioPage.portrait")}</option><option value="1:1">1:1 {featureMessage(language, "video.messages.VideoStudioPage.square")}</option><option value="16:9">16:9 {featureMessage(language, "video.messages.VideoStudioPage.landscape")}</option></UtilitySelect></UtilityField>
      <UtilityField><span>{featureMessage(language, "video.messages.VideoStudioPage.rotation")}</span><UtilitySelect value={rotation} disabled={passthrough} onChange={(event) => onRotation(Number(event.target.value) as VideoRotation)}><option value={0}>{featureMessage(language, "video.messages.VideoStudioPage.noRotation")}</option><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option></UtilitySelect></UtilityField>
      <ToggleRow label={featureMessage(language, "video.messages.VideoStudioPage.flipHorizontally")} checked={flipHorizontal} onChange={onFlipHorizontal} disabled={passthrough} />
      {bitrate === "custom" && <UnitNumberField label={featureMessage(language, "video.messages.VideoStudioPage.customVideoBitrate")} unit="Mbps" value={customBitrate} min={0.1} max={200} step={0.1} inputMode="decimal" valid={isNumberInRange(customBitrate, 0.1, 200)} help="0.1~200 Mbps" onChange={onCustomBitrate} />}
      <label className="col-span-2 flex min-w-0 flex-col gap-1.5 rounded-xl bg-muted p-3 text-[13px] font-bold text-muted-foreground max-[620px]:col-auto"><span className="flex justify-between">{featureMessage(language, "video.messages.VideoStudioPage.qualityCrf")} <b className="text-foreground">{crf}</b></span><input className="w-full [accent-color:var(--color-pink-600)] disabled:cursor-not-allowed disabled:opacity-50" type="range" min={18} max={32} value={crf} disabled={!crfMode} onChange={(event) => onCrf(Number(event.target.value))} /><small className="text-xs font-medium leading-snug">{crfMode ? featureMessage(language, "video.messages.VideoStudioPage.lowerValuesAreSharperAndProduceLargerFiles") : featureMessage(language, "video.messages.VideoStudioPage.targetBitrateModeUsesTheSelectedBitrateInstead")}</small></label>
    </div>
  );
}

function AudioTrackSettings(props: {
  container: "mp4" | "mkv" | "webm";
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
  return (
    <div className="video-audio-settings my-[13px] rounded-[14px] border border-border bg-muted/60 p-3">
      <div className="video-audio-settings-heading mb-2.5 flex items-start gap-2 text-pink-700 dark:text-pink-300"><Volume2 size={17} /><span className="flex flex-col"><strong className="text-sm text-foreground">{featureMessage(props.language, "video.messages.VideoStudioPage.videoAudio")}</strong><small className="mt-[3px] text-[13px] leading-relaxed text-muted-foreground">{featureMessage(props.language, "video.messages.VideoStudioPage.onlyTheFirstAudioTrackIsProcessed")}</small></span></div>
      <SegmentedControl
        value={props.mode}
        options={[
          { value: "copy", label: featureMessage(props.language, "video.messages.VideoStudioPage.copyAudio") },
          { value: "remove", label: featureMessage(props.language, "video.messages.VideoStudioPage.removeAudio") },
          { value: "encode", label: featureMessage(props.language, "video.messages.VideoStudioPage.convertAudio") },
        ]}
        onChange={props.onMode}
        label={featureMessage(props.language, "video.messages.VideoStudioPage.videoAudioMode")}
      />
      {props.mode === "encode" && <AudioEncodingFields {...props} codec={props.container === "webm" ? "opus" : "aac"} />}
    </div>
  );
}

function AudioEncodingFields({ bitrate, customBitrate, sampleRate, customSampleRate, onBitrate, onCustomBitrate, onSampleRate, onCustomSampleRate, codec, language }: {
  bitrate: VideoAudioBitrate;
  customBitrate: string;
  sampleRate: VideoAudioSampleRate;
  customSampleRate: string;
  onBitrate: (value: VideoAudioBitrate) => void;
  onCustomBitrate: (value: string) => void;
  onSampleRate: (value: VideoAudioSampleRate) => void;
  onCustomSampleRate: (value: string) => void;
  codec: "aac" | "mp3" | "opus";
  language: AppLanguage;
}) {
  const maximumSampleRate = codec === "aac" ? 96_000 : 48_000;
  return (
    <div className="mt-[11px] grid grid-cols-2 gap-3 max-[620px]:grid-cols-1" data-testid="video-audio-encoding-fields">
      <UtilityField><span>{featureMessage(language, "video.messages.VideoStudioPage.audioQualitySizeBitrate")}</span><UtilitySelect value={bitrate} onChange={(event) => onBitrate(event.target.value as VideoAudioBitrate)}><option value="128k">128 kbps</option><option value="192k">192 kbps · {featureMessage(language, "video.messages.VideoStudioPage.recommended")}</option><option value="256k">256 kbps</option><option value="320k">320 kbps</option><option value="custom">{featureMessage(language, "video.messages.VideoStudioPage.custom")}</option></UtilitySelect></UtilityField>
      {bitrate === "custom" && <UnitNumberField label={featureMessage(language, "video.messages.VideoStudioPage.customAudioBitrate")} unit="kbps" value={customBitrate} min={32} max={512} step={1} inputMode="numeric" valid={isIntegerInRange(customBitrate, 32, 512)} help="32~512 kbps" onChange={onCustomBitrate} />}
      <UtilityField><span>{featureMessage(language, "video.messages.VideoStudioPage.audioSampleRate")}</span><UtilitySelect value={sampleRate} onChange={(event) => onSampleRate(event.target.value as VideoAudioSampleRate)}><option value="source">{featureMessage(language, "video.messages.VideoStudioPage.keepSource2")}</option>{codec !== "opus" && <option value="44100">44,100 Hz</option>}<option value="48000">48,000 Hz · {featureMessage(language, "video.messages.VideoStudioPage.recommended")}</option><option value="custom">{featureMessage(language, "video.messages.VideoStudioPage.custom")}</option></UtilitySelect></UtilityField>
      {sampleRate === "custom" && <UnitNumberField label={featureMessage(language, "video.messages.VideoStudioPage.customSampleRate")} inputAriaLabel={featureMessage(language, "video.messages.VideoStudioPage.customSampleRate2")} unit="Hz" value={customSampleRate} min={8000} max={maximumSampleRate} step={100} inputMode="numeric" valid={isIntegerInRange(customSampleRate, 8_000, maximumSampleRate)} help={`8,000~${maximumSampleRate.toLocaleString()} Hz${codec === "opus" ? featureMessage(language, "video.messages.VideoStudioPage.snappedToAnOpusSupportedRate") : ""}`} onChange={onCustomSampleRate} />}
    </div>
  );
}

function UnitNumberField({ label, inputAriaLabel = label, unit, value, min, max, step, inputMode, valid, help, onChange }: {
  label: string;
  inputAriaLabel?: string;
  unit: string;
  value: string;
  min: number;
  max: number;
  step: number;
  inputMode: "decimal" | "numeric";
  valid: boolean;
  help: string;
  onChange: (value: string) => void;
}) {
  return (
    <UtilityField aria-invalid={!valid}>
      <span>{label}</span>
      <span aria-invalid={!valid} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center overflow-hidden rounded-xl border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20">
        <UtilityInput className="rounded-none border-0 bg-transparent shadow-none focus-visible:border-0 focus-visible:ring-0" aria-label={inputAriaLabel} type="number" min={min} max={max} step={step} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} />
        <b className="border-l border-border px-2.5 text-[13px] text-muted-foreground">{unit}</b>
      </span>
      <small className={valid ? "text-xs font-medium leading-snug text-muted-foreground" : "text-xs font-medium leading-snug text-destructive"}>{help}</small>
    </UtilityField>
  );
}

function createTask(settings: {
  outputFormat: VideoOutputFormat;
  codec: VideoCodec;
  resolution: VideoResolution;
  aspect: VideoAspect;
  crf: number;
  rotation: VideoRotation;
  flipHorizontal: boolean;
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
    rotation: settings.rotation,
    flipHorizontal: settings.flipHorizontal,
  };
}

function createJobEntries(
  groups: Array<{ group: VideoGroupId; items: VideoItem[] }>,
  settings: Record<VideoGroupId, GroupSettings>,
  allGroupsOneFile: boolean,
  language: AppLanguage,
): VideoJobEntry[] {
  if (allGroupsOneFile) return [{ name: featureMessage(language, "video.messages.VideoStudioPage.allGroups2"), mode: "concat" as const, items: groups.flatMap((group) => group.items) }];
  const entries: VideoJobEntry[] = [];
  groups.forEach(({ group, items: groupItems }) => {
    if (settings[group].outputMode === "concat") entries.push({ name: `${featureMessage(language, "video.messages.VideoStudioPage.group2")}-${group}`, mode: "concat", items: groupItems });
    else groupItems.forEach((item, index) => entries.push({ name: `${item.file.name.replace(/\.[^.]+$/, "")}-${featureMessage(language, "video.messages.VideoStudioPage.group2")}${group}-${index + 1}`, mode: "individual", items: [item] }));
  });
  return entries;
}

function videoJobKey(job: VideoJobEntry) {
  return `${job.mode}:${job.items.map((item) => item.id).join(":")}`;
}

function routeGuidanceMessage(code: VideoRouteGuidanceCode, language: AppLanguage) {
  const keys: Record<VideoRouteGuidanceCode, string> = {
    "source-structure": "video.messages.VideoStudioPage.routeSourceStructureRequiresCompatibilityProcessing",
    "video-format": "video.messages.VideoStudioPage.routeVideoFormatRequiresCompatibilityProcessing",
    "audio-format": "video.messages.VideoStudioPage.routeAudioFormatRequiresCompatibilityProcessing",
    timeline: "video.messages.VideoStudioPage.routeTimelineRequiresCompatibilityProcessing",
    concat: "video.messages.VideoStudioPage.routeConcatTracksRequireCompatibilityProcessing",
    "frame-rate": "video.messages.VideoStudioPage.routeFrameRateRequiresCompatibilityProcessing",
    "video-capability": "video.messages.VideoStudioPage.routeVideoCapabilityRequiresCompatibilityProcessing",
    "audio-capability": "video.messages.VideoStudioPage.routeAudioCapabilityRequiresCompatibilityProcessing",
    "container-setting": "video.messages.VideoStudioPage.routeContainerSettingUsesCompatibilityProcessing",
    "codec-setting": "video.messages.VideoStudioPage.routeCodecSettingUsesCompatibilityProcessing",
    "quality-setting": "video.messages.VideoStudioPage.routeQualitySettingUsesCompatibilityProcessing",
    "storage-route": "video.messages.VideoStudioPage.routeStorageStateUsesCompatibilityProcessing",
    generic: "video.messages.VideoStudioPage.routeCurrentSettingsUseCompatibilityProcessing",
  };
  return featureMessage(language, keys[code]);
}

function audioSuggestionMessage(modes: Array<"remove" | "encode">, language: AppLanguage) {
  if (modes.includes("encode")) {
    return featureMessage(language, modes.includes("remove")
      ? "video.messages.VideoStudioPage.sourceAudioNeedsConversionOrRemoval"
      : "video.messages.VideoStudioPage.sourceAudioNeedsConversion");
  }
  return featureMessage(language, "video.messages.VideoStudioPage.sourceAudioCannotBeCopiedRemoveItForLargeFiles");
}

function routeNoticesForJob(
  route: VideoProcessingJobRoute,
  job: VideoJobEntry,
  task: VideoTask,
  language: AppLanguage,
): VideoRouteNotice[] {
  const notices: VideoRouteNotice[] = [];
  const jobKey = videoJobKey(job);
  if (route.dvBaseLayer) {
    const guidance = dolbyVisionBaseLayerGuidance(route.dvBaseLayer.compatIds);
    const key = guidance === "hdr10"
      ? "video.messages.VideoStudioPage.dolbyVisionHdr10BaseLayerNotice"
      : guidance === "sdr"
        ? "video.messages.VideoStudioPage.dolbyVisionSdrBaseLayerNotice"
        : guidance === "hlg"
          ? "video.messages.VideoStudioPage.dolbyVisionHlgBaseLayerNotice"
          : "video.messages.VideoStudioPage.dolbyVisionMixedBaseLayerNotice";
    notices.push({ jobKey, jobName: job.name, message: featureMessage(language, key) });
  }
  if (route.decision.route === "ffmpeg") {
    const cause = primaryVideoProbeCause(route.probeDetails);
    const guidanceCode = cause
      ? guidanceCodeForProbeCause(cause)
      : guidanceCodeForRouteReason(route.decision.reasonCode);
    if (guidanceCode) notices.push({ jobKey, jobName: job.name, message: routeGuidanceMessage(guidanceCode, language) });
    const jobTask = taskForVideoJob(task, { name: job.name, mode: job.mode, inputs: job.items.map(toWorkerInput) });
    if (jobTask.kind === "encode" && jobTask.bitrate !== "copy" && jobTask.bitrate !== "0"
      && job.items.some((item) => item.width >= 3840 || item.height >= 2160)) {
      notices.push({
        jobKey,
        jobName: job.name,
        message: featureMessage(language, "video.messages.VideoStudioPage.highResolutionCompatibilityProcessingNotice"),
      });
    }
  }
  return notices;
}

function toWorkerInput(item: VideoItem): VideoWorkerInput {
  return { fileName: item.file.name, file: item.file, fileSize: item.file.size, duration: item.duration, width: item.width, height: item.height, frameRate: item.frameRate, start: item.start, end: item.end };
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
  if (isUserFacingVideoError(error)) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof RangeError || /array buffer allocation failed|invalid typed array length|out of memory/i.test(message)) {
    return featureMessage(language, "video.messages.VideoStudioPage.theCompletedVideoOrIntermediateDataExceededThe");
  }
  if ((error instanceof DOMException && error.name === "NotReadableError") || /requested file could not be read|permission problems/i.test(message)) {
    return featureMessage(language, "video.messages.VideoStudioPage.theSelectedVideoCannotBeReadItMay");
  }
  return featureMessage(language, "video.messages.VideoStudioPage.videoProcessingFailed");
}
function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00.0";
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${remaining.toFixed(1).padStart(4, "0")}`;
}
function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  triggerDownloadUrl(url, fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
}

function triggerDownloadUrl(url: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
}
