/// <reference lib="webworker" />

import { createFile, type ISOFile, type MP4BoxBuffer, type Movie, type Sample, type Track } from "mp4box";
import { Muxer, StreamTarget } from "mp4-muxer";

import { workerMessage } from "../../i18n/workerMessages.ts";
import { createVideoWorkerResult, createVideoOutputName, type VideoFileLabels } from "./videoProcessingShared.ts";
import { createVideoResultRandomAccessTarget, type VideoResultRandomAccessTarget } from "./videoResultStorage.worker.ts";
import {
  compareVideoStreamInputProfiles,
  compareVideoStreamAudioProfiles,
  selectAudioStreamSamples,
  selectVideoStreamSamples,
  type VideoStreamCopyMetrics,
  type VideoStreamCopyProbeResult,
  type VideoStreamInputProfile,
  type VideoStreamSampleInfo,
  type VideoStreamCopyReasonCode,
} from "./videoStreamCopy.ts";
import {
  assessVideoWebCodecsSupport,
  createVideoWebCodecsAudioEncoderConfig,
  createVideoWebCodecsEncoderConfig,
  parsedVideoTrackFrameRate,
  resolveVideoFrameCanvasTransform,
  resolveVideoFrameTransformLayout,
  resolveVideoWebCodecsBaseDimensions,
  resolveVideoWebCodecsFrameRate,
  resolveVideoWebCodecsOutputDimensions,
  type VideoWebCodecsMetrics,
  type VideoWebCodecsProbeResult,
} from "./videoWebCodecs.ts";
import type {
  VideoStreamInputDescriptor,
  VideoStreamJobDescriptor,
  VideoStreamPreflightRequest,
  VideoStreamRunRequest,
} from "./videoStreamWorkerClient.ts";
import type { VideoProgressStage } from "./videoProcessingProgress.ts";
import type { VideoAudioMode, VideoTask } from "./types.ts";

const worker = self as DedicatedWorkerGlobalScope;
const METADATA_CHUNK_BYTES = 1024 * 1024;
const SAMPLE_READ_WINDOW_BYTES = 8 * 1024 * 1024;
const OUTPUT_CHUNK_BYTES = 1024 * 1024;
const INPUT_REQUEST_TIMEOUT_MS = 60_000;

interface SampleEntryLike {
  type?: string;
  avcC?: BoxLike;
  hvcC?: BoxLike;
  esds?: EsdsLike;
  wave?: { esds?: EsdsLike; esdss?: EsdsLike[] };
}

interface BoxLike {
  start?: number;
  size?: number;
  hdr_size?: number;
}

interface DescriptorLike {
  tag?: number;
  data?: Uint8Array;
  descs?: DescriptorLike[];
  findDescriptor?: (tag: number) => DescriptorLike | undefined;
}

interface EsdsLike {
  esd?: DescriptorLike;
}

interface TrackEditLike {
  segment_duration?: number;
  media_time?: number;
  media_rate_integer?: number;
  media_rate_fraction?: number;
}

interface ParsedTrack {
  track: Track;
  samples: VideoStreamSampleInfo[];
  mediaTimeOffsetSeconds: number;
}

interface ParsedInput {
  file: File;
  profile: VideoStreamInputProfile;
  video: ParsedTrack;
  audio?: ParsedTrack;
  metadataBytesRead: number;
}

interface SelectedRecord {
  kind: "video" | "audio";
  sample: VideoStreamSampleInfo;
  mediaTimeOffsetSeconds: number;
}

interface PendingInput {
  resolve: (file: File) => void;
  reject: (error: Error) => void;
  timeout: number;
}

const pendingInputs = new Map<string, PendingInput>();
let active = false;
let activeCopyMetrics: VideoStreamCopyMetrics | undefined;
let activeWebCodecsMetrics: VideoWebCodecsMetrics | undefined;
let activeAbortController: AbortController | undefined;

worker.onmessage = (event: MessageEvent) => {
  if (event.data?.type === "input-file") {
    const pending = pendingInputs.get(event.data.fileId);
    if (!pending || !(event.data.file instanceof File)) return;
    pendingInputs.delete(event.data.fileId);
    worker.clearTimeout(pending.timeout);
    pending.resolve(event.data.file);
    return;
  }
  if (event.data?.type === "cancel") {
    activeAbortController?.abort();
    for (const pending of pendingInputs.values()) {
      worker.clearTimeout(pending.timeout);
      pending.reject(new DOMException("Canceled", "AbortError"));
    }
    pendingInputs.clear();
    return;
  }
  if (active || (event.data?.type !== "preflight" && event.data?.type !== "start")) return;
  active = true;
  activeAbortController = new AbortController();
  void (event.data.type === "preflight"
    ? handlePreflight(event.data.request as VideoStreamPreflightRequest, activeAbortController.signal)
    : handleStart(event.data.request as VideoStreamRunRequest, activeAbortController.signal)
  ).catch((error) => {
    worker.postMessage({ type: isAbortError(error) ? "canceled" : "error" });
  }).finally(closeWorker);
};

worker.postMessage({ type: "ready" });

async function handlePreflight(request: VideoStreamPreflightRequest, signal: AbortSignal) {
  const probe = request.operation === "webcodecs"
    ? await inspectWebCodecsJob(request.job, request.task, signal)
    : await inspectJob(request.job, request.audioMode, signal);
  worker.postMessage({ type: "preflight-result", probe });
}

async function handleStart(request: VideoStreamRunRequest, signal: AbortSignal) {
  if (request.task.container !== "mp4" || !request.resultStorage) {
    throw new Error("Unsupported streaming request");
  }
  if (request.operation === "webcodecs") {
    if (request.task.bitrate === "copy" || request.task.bitrate === "0") throw new Error("Unsupported encoding request");
    await handleWebCodecsStart(request, signal);
    return;
  }
  if (request.task.bitrate !== "copy") {
    throw new Error("Unsupported direct-copy request");
  }
  activeCopyMetrics = request.collectMetrics ? createMetrics() : undefined;
  const files = await requestJobFiles(request.job, Boolean(activeCopyMetrics), signal);
  const parsedInputs: ParsedInput[] = [];
  let metadataCompleted = 0;
  const metadataTotal = Math.max(1, files.reduce((total, file) => total + file.size, 0));
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    throwIfAborted(signal);
    const parsed = await parseInput(file, request.task.audioMode, (logicalPosition) => {
      reportProgress(
        "demux",
        metadataCompleted + logicalPosition,
        metadataTotal,
        workerMessage(request.language, "video.messages.video.checkingSourceForDirectCopy", { p0: index + 1, p1: files.length }),
      );
    }, signal);
    parsedInputs.push(parsed);
    metadataCompleted += file.size;
  }
  if (!compareVideoStreamInputProfiles(parsedInputs.map((input) => input.profile), request.task.audioMode === "copy")) {
    throw new Error("Input track profiles do not match");
  }
  reportProgress("demux", metadataTotal, metadataTotal, workerMessage(request.language, "video.messages.video.sourceTracksReady"));
  reportProgress("decode", 1, 1, workerMessage(request.language, "video.messages.video.copyingWithoutChangingPictureQuality"));
  reportProgress("encode", 1, 1, workerMessage(request.language, "video.messages.video.copyingWithoutChangingPictureQuality"));

  const outputName = createVideoOutputName(request.job.name, request.task, request.job.mode === "concat", request.fileLabels as VideoFileLabels);
  let writtenBytes = 0;
  let target: VideoResultRandomAccessTarget | undefined;
  try {
    target = await createVideoResultRandomAccessTarget(
      request.resultStorage,
      outputName,
      request.estimatedOutputBytes,
      (cumulativeBytes, _position, byteLength) => {
        if (activeCopyMetrics) {
          activeCopyMetrics.outputCumulativeBytesMonotonic &&= cumulativeBytes >= activeCopyMetrics.outputLastCumulativeBytes;
          activeCopyMetrics.outputLastCumulativeBytes = cumulativeBytes;
          activeCopyMetrics.outputWriteCalls += 1;
          activeCopyMetrics.maxOutputWriteBytes = Math.max(activeCopyMetrics.maxOutputWriteBytes, byteLength);
        }
        writtenBytes = cumulativeBytes;
        reportProgress(
          "write",
          writtenBytes,
          Math.max(request.estimatedOutputBytes, writtenBytes),
          workerMessage(request.language, "video.messages.video.savingCompletedVideoProgressively"),
        );
      },
    );
    const output = await muxJob(request, parsedInputs, target, signal);
    if (activeCopyMetrics) activeCopyMetrics.outputFileSize = output.size;
    worker.postMessage({ type: "output", output });
    worker.postMessage({
      type: "result",
      result: {
        ...createVideoWorkerResult(1, request.task, (key, values) => workerMessage(request.language, key, values)),
        metrics: activeCopyMetrics,
      },
    });
  } catch (error) {
    await target?.discard().catch(() => undefined);
    throw error;
  }
}

async function inspectWebCodecsJob(
  job: VideoStreamJobDescriptor,
  task: Extract<VideoTask, { kind: "encode" }>,
  signal?: AbortSignal,
): Promise<VideoWebCodecsProbeResult> {
  try {
    if (task.container !== "mp4" || task.bitrate === "copy" || task.bitrate === "0" || task.codec === "vp9") {
      return { compatible: false, reasonCode: "INPUT_UNSUPPORTED" };
    }
    if (job.mode === "concat" && job.inputs.some((input) => !validDescriptorFrameRate(input.frameRate))) {
      return { compatible: false, reasonCode: "CONCAT_FRAME_RATE_UNAVAILABLE" };
    }
    const files = await requestJobFiles(job, false, signal);
    const inputs: ParsedInput[] = [];
    for (const file of files) {
      throwIfAborted(signal);
      inputs.push(await parseInput(file, task.audioMode, undefined, signal));
    }
    return assessParsedWebCodecsSupport(job, task, inputs);
  } catch (error) {
    if (isAbortError(error)) throw error;
    return { compatible: false, reasonCode: "INPUT_UNSUPPORTED" };
  }
}

async function assessParsedWebCodecsSupport(
  job: VideoStreamJobDescriptor,
  task: Extract<VideoTask, { kind: "encode" }>,
  inputs: readonly ParsedInput[],
) {
  const baseDimensions = resolveVideoWebCodecsBaseDimensions(job, task);
  const measuredFrameRates = inputs.map((input) => parsedVideoTrackFrameRate(input.video.samples));
  const frameRate = resolveVideoWebCodecsFrameRate(job, measuredFrameRates.filter((value): value is number => value !== undefined));
  if (!baseDimensions || !frameRate) return { compatible: false, reasonCode: "CONCAT_FRAME_RATE_UNAVAILABLE" } as const;
  const [outputWidth, outputHeight] = resolveVideoWebCodecsOutputDimensions(baseDimensions, task.rotation);
  const audioPresenceMatches = inputs.every((input) => Boolean(input.audio) === Boolean(inputs[0]?.audio));
  const audioTracksCompatible = audioPresenceMatches && (
    task.audioMode !== "copy" || job.mode !== "concat" || compareAudioProfiles(inputs)
  );
  const firstAudio = inputs[0]?.profile.audio;
  const audioEncoderConfig = firstAudio
    ? createVideoWebCodecsAudioEncoderConfig(task, firstAudio.sampleRate!, firstAudio.channelCount!, job.mode === "concat")
    : undefined;
  return assessVideoWebCodecsSupport({
    videoDecoderConfigs: inputs.map(videoDecoderConfig),
    videoEncoderConfig: createVideoWebCodecsEncoderConfig(task, outputWidth, outputHeight, frameRate),
    audioMode: task.audioMode,
    audioDecoderConfigs: task.audioMode === "encode"
      ? inputs.flatMap((input) => input.profile.audio ? [audioDecoderConfig(input.profile.audio)] : [])
      : [],
    audioEncoderConfig,
    audioTracksCompatible: task.audioMode === "remove" ? true : audioTracksCompatible,
  });
}

async function handleWebCodecsStart(request: VideoStreamRunRequest, signal: AbortSignal) {
  activeWebCodecsMetrics = request.collectMetrics ? createWebCodecsMetrics() : undefined;
  const files = await requestJobFiles(request.job, Boolean(activeWebCodecsMetrics), signal);
  const parsedInputs: ParsedInput[] = [];
  let metadataCompleted = 0;
  const metadataTotal = Math.max(1, files.reduce((total, file) => total + file.size, 0));
  for (let index = 0; index < files.length; index += 1) {
    throwIfAborted(signal);
    const parsed = await parseInput(files[index], request.task.audioMode, (logicalPosition) => {
      reportProgress(
        "demux",
        metadataCompleted + logicalPosition,
        metadataTotal,
        workerMessage(request.language, "video.messages.video.checkingSourceForEncoding", { p0: index + 1, p1: files.length }),
      );
    }, signal);
    parsedInputs.push(parsed);
    metadataCompleted += files[index].size;
  }
  const support = await assessParsedWebCodecsSupport(request.job, request.task, parsedInputs);
  if (!support.compatible) throw new Error(support.reasonCode);
  reportProgress("demux", metadataTotal, metadataTotal, workerMessage(request.language, "video.messages.video.sourceReadyForEncoding"));

  const outputName = createVideoOutputName(request.job.name, request.task, request.job.mode === "concat", request.fileLabels as VideoFileLabels);
  let target: VideoResultRandomAccessTarget | undefined;
  try {
    target = await createVideoResultRandomAccessTarget(
      request.resultStorage!,
      outputName,
      request.estimatedOutputBytes,
      (cumulativeBytes, _position, byteLength) => {
        if (activeWebCodecsMetrics) {
          activeWebCodecsMetrics.outputCumulativeBytesMonotonic &&= cumulativeBytes >= activeWebCodecsMetrics.outputLastCumulativeBytes;
          activeWebCodecsMetrics.outputLastCumulativeBytes = cumulativeBytes;
          activeWebCodecsMetrics.outputWriteCalls += 1;
          activeWebCodecsMetrics.maxOutputWriteBytes = Math.max(activeWebCodecsMetrics.maxOutputWriteBytes, byteLength);
        }
        reportProgress(
          "write",
          cumulativeBytes,
          Math.max(request.estimatedOutputBytes, cumulativeBytes),
          workerMessage(request.language, "video.messages.video.savingCompletedVideoProgressively"),
        );
      },
    );
    const output = await encodeWebCodecsJob(request, parsedInputs, target, signal);
    if (activeWebCodecsMetrics) activeWebCodecsMetrics.outputFileSize = output.size;
    worker.postMessage({ type: "output", output });
    worker.postMessage({
      type: "result",
      result: {
        ...createVideoWorkerResult(1, request.task, (key, values) => workerMessage(request.language, key, values)),
        metrics: activeWebCodecsMetrics,
      },
    });
  } catch (error) {
    await target?.discard().catch(() => undefined);
    throw error;
  }
}

function videoDecoderConfig(input: ParsedInput): VideoDecoderConfig {
  return {
    codec: input.profile.video.codecName,
    codedWidth: input.profile.video.width,
    codedHeight: input.profile.video.height,
    description: exactArrayBuffer(input.profile.video.configuration),
    hardwareAcceleration: "no-preference",
  };
}

function audioDecoderConfig(profile: NonNullable<VideoStreamInputProfile["audio"]>): AudioDecoderConfig {
  return {
    codec: profile.codecName,
    sampleRate: profile.sampleRate!,
    numberOfChannels: profile.channelCount!,
    description: exactArrayBuffer(profile.configuration),
  };
}

function compareAudioProfiles(inputs: readonly ParsedInput[]) {
  return compareVideoStreamAudioProfiles(inputs.map((input) => input.profile));
}

function validDescriptorFrameRate(value: number | undefined) {
  return Number.isFinite(value) && (value ?? 0) > 0 && (value ?? 0) <= 240;
}

async function encodeWebCodecsJob(
  request: VideoStreamRunRequest,
  inputs: ParsedInput[],
  target: VideoResultRandomAccessTarget,
  signal: AbortSignal,
) {
  const baseDimensions = resolveVideoWebCodecsBaseDimensions(request.job, request.task);
  const frameRate = resolveVideoWebCodecsFrameRate(
    request.job,
    inputs.map((input) => parsedVideoTrackFrameRate(input.video.samples)).filter((value): value is number => value !== undefined),
  );
  if (!baseDimensions || !frameRate) throw new Error("Output video configuration is unavailable");
  const [outputWidth, outputHeight] = resolveVideoWebCodecsOutputDimensions(baseDimensions, request.task.rotation);
  const firstAudio = inputs[0]?.profile.audio;
  const includeCopiedAudio = request.task.audioMode === "copy" && Boolean(firstAudio);
  const audioEncoderConfig = request.task.audioMode === "encode" && firstAudio
    ? createVideoWebCodecsAudioEncoderConfig(
        request.task,
        firstAudio.sampleRate!,
        firstAudio.channelCount!,
        request.job.mode === "concat",
      )
    : undefined;
  const streamTarget = new StreamTarget({
    chunked: true,
    chunkSize: OUTPUT_CHUNK_BYTES,
    onData(data, position) {
      throwIfAborted(signal);
      target.write(data, position);
    },
  });
  const muxer = new Muxer({
    target: streamTarget,
    video: {
      codec: request.task.codec === "h264" ? "avc" : "hevc",
      width: outputWidth,
      height: outputHeight,
      frameRate,
    },
    audio: includeCopiedAudio ? {
      codec: "aac",
      numberOfChannels: firstAudio!.channelCount!,
      sampleRate: firstAudio!.sampleRate!,
    } : audioEncoderConfig ? {
      codec: "aac",
      numberOfChannels: audioEncoderConfig.numberOfChannels,
      sampleRate: audioEncoderConfig.sampleRate,
    } : undefined,
    fastStart: false,
    firstTimestampBehavior: "cross-track-offset",
  });

  let codecFailure: unknown;
  let submittedVideoFrames = 0;
  let lastKeyFrameTimestamp = Number.NEGATIVE_INFINITY;
  const totalDurationMicroseconds = Math.max(1, Math.round(request.job.inputs.reduce(
    (total, input) => total + Math.max(0.05, input.end - input.start),
    0,
  ) * 1_000_000));
  const videoEncoder = new VideoEncoder({
    output(chunk, metadata) {
      try {
        muxer.addVideoChunk(chunk, metadata);
        if (activeWebCodecsMetrics) activeWebCodecsMetrics.encodedVideoFrames += 1;
        reportProgress(
          "mux",
          Math.min(totalDurationMicroseconds, chunk.timestamp + (chunk.duration ?? 0)),
          totalDurationMicroseconds,
          workerMessage(request.language, "video.messages.video.finalizingCompletedVideo"),
        );
      } catch (error) {
        codecFailure ||= error;
      }
    },
    error(error) {
      codecFailure ||= error;
    },
  });
  videoEncoder.configure(createVideoWebCodecsEncoderConfig(request.task, outputWidth, outputHeight, frameRate));

  let audioEncoder: AudioEncoder | undefined;
  if (audioEncoderConfig) {
    audioEncoder = new AudioEncoder({
      output(chunk, metadata) {
        try {
          muxer.addAudioChunk(chunk, metadata);
          if (activeWebCodecsMetrics) activeWebCodecsMetrics.encodedAudioData += 1;
        } catch (error) {
          codecFailure ||= error;
        }
      },
      error(error) {
        codecFailure ||= error;
      },
    });
    audioEncoder.configure(audioEncoderConfig);
  }

  try {
    let segmentOffsetMicroseconds = 0;
    for (let index = 0; index < inputs.length; index += 1) {
      throwIfAborted(signal);
      const descriptor = request.job.inputs[index];
      await encodeVideoInput({
        input: inputs[index],
        descriptor,
        task: request.task,
        baseDimensions,
        frameRate,
        segmentOffsetMicroseconds,
        totalDurationMicroseconds,
        normalizeForConcat: request.job.mode === "concat",
        language: request.language,
        videoEncoder,
        target,
        signal,
        onEncodedFrame(timestamp, segmentStart) {
          throwCodecFailure(codecFailure);
          const keyFrame = segmentStart || timestamp - lastKeyFrameTimestamp >= 2_000_000;
          if (keyFrame) lastKeyFrameTimestamp = timestamp;
          submittedVideoFrames += 1;
          reportProgress(
            "encode",
            Math.min(totalDurationMicroseconds, timestamp + Math.round(1_000_000 / frameRate)),
            totalDurationMicroseconds,
            workerMessage(request.language, "video.messages.video.encoding", { p0: "MP4" }),
          );
          return keyFrame;
        },
      });
      segmentOffsetMicroseconds += Math.max(1, Math.round((descriptor.end - descriptor.start) * 1_000_000));
    }
    await videoEncoder.flush();
    throwCodecFailure(codecFailure);

    if (includeCopiedAudio) {
      await muxCopiedAudio(request, inputs, muxer, target, signal);
    } else if (audioEncoder) {
      await encodeAudioInputs(request, inputs, audioEncoder, target, signal, () => throwCodecFailure(codecFailure));
      await audioEncoder.flush();
      throwCodecFailure(codecFailure);
    }
    if (!submittedVideoFrames) throw new Error("No video frames were encoded");
    throwIfAborted(signal);
    muxer.finalize();
    await target.flush();
    const outputName = createVideoOutputName(request.job.name, request.task, request.job.mode === "concat", request.fileLabels as VideoFileLabels);
    const output = await target.complete(outputName, "video/mp4");
    reportProgress("write", output.size, output.size, workerMessage(request.language, "video.messages.video.resultReadyCheckingTheNextJob", { p0: 1, p1: 1 }));
    return output;
  } finally {
    await flushAndCloseCodec(videoEncoder);
    if (audioEncoder) await flushAndCloseCodec(audioEncoder);
  }
}

interface EncodeVideoInputOptions {
  input: ParsedInput;
  descriptor: VideoStreamInputDescriptor;
  task: Extract<VideoTask, { kind: "encode" }>;
  baseDimensions: readonly [number, number];
  frameRate: number;
  segmentOffsetMicroseconds: number;
  totalDurationMicroseconds: number;
  normalizeForConcat: boolean;
  language: "ko" | "en";
  videoEncoder: VideoEncoder;
  target: VideoResultRandomAccessTarget;
  signal: AbortSignal;
  onEncodedFrame: (timestamp: number, segmentStart: boolean) => boolean;
}

async function encodeVideoInput(options: EncodeVideoInputOptions) {
  const { input, descriptor, task, baseDimensions, frameRate, segmentOffsetMicroseconds, videoEncoder, target, signal } = options;
  const selection = selectVideoStreamSamples(input.video.samples, descriptor.start, descriptor.end, input.video.mediaTimeOffsetSeconds);
  if (!selection) throw new Error("The selected video range is unavailable");
  const selectedRecords = selection.samples.map((sample) => ({
    kind: "video" as const,
    sample,
    mediaTimeOffsetSeconds: input.video.mediaTimeOffsetSeconds,
  }));
  const canvasDimensions = resolveVideoWebCodecsOutputDimensions(baseDimensions, task.rotation);
  const canvas = new OffscreenCanvas(canvasDimensions[0], canvasDimensions[1]);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Video frame rendering is unavailable");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const segmentDurationMicroseconds = Math.max(1, Math.round((descriptor.end - descriptor.start) * 1_000_000));
  const expectedFrameCount = Math.max(1, Math.round((descriptor.end - descriptor.start) * frameRate));
  const startMicroseconds = Math.round(descriptor.start * 1_000_000);
  const endMicroseconds = Math.round(descriptor.end * 1_000_000);
  let nextFrameIndex = 0;
  let heldFrame: VideoFrame | undefined;
  let pendingFrames = 0;
  let processing = Promise.resolve();
  let decoderFailure: unknown;
  const decoder = new VideoDecoder({
    output(frame) {
      pendingFrames += 1;
      if (activeWebCodecsMetrics) activeWebCodecsMetrics.decodedVideoFrames += 1;
      processing = processing.then(async () => {
        throwIfAborted(signal);
        const timestamp = frame.timestamp;
        if (timestamp < startMicroseconds - 1 || timestamp >= endMicroseconds) {
          closeVideoFrame(frame);
          return;
        }
        const localTimestamp = Math.max(0, timestamp - startMicroseconds);
        if (heldFrame) {
          while (nextFrameIndex < expectedFrameCount && frameTimestamp(nextFrameIndex, frameRate) < Math.min(localTimestamp, segmentDurationMicroseconds)) {
            await encodeCanvasFrame(heldFrame, nextFrameIndex);
            nextFrameIndex += 1;
          }
          closeVideoFrame(heldFrame);
        }
        heldFrame = frame;
      }).catch((error) => {
        decoderFailure ||= error;
        closeVideoFrame(frame);
      }).finally(() => {
        pendingFrames -= 1;
      });
    },
    error(error) {
      decoderFailure ||= error;
    },
  });
  decoder.configure(videoDecoderConfig(input));

  const encodeCanvasFrame = async (source: VideoFrame, frameIndex: number) => {
    throwIfAborted(signal);
    throwCodecFailure(decoderFailure);
    await waitForCodecQueue(videoEncoder, "encodeQueueSize", 6, signal);
    if (activeWebCodecsMetrics) {
      activeWebCodecsMetrics.maxVideoEncodeQueueSize = Math.max(
        activeWebCodecsMetrics.maxVideoEncodeQueueSize,
        videoEncoder.encodeQueueSize,
      );
    }
    drawVideoFrame(context, source, descriptor, task, baseDimensions, options.normalizeForConcat);
    const localTimestamp = frameTimestamp(frameIndex, frameRate);
    const frameDurationMicroseconds = Math.max(1, frameTimestamp(frameIndex + 1, frameRate) - localTimestamp);
    const outputTimestamp = segmentOffsetMicroseconds + localTimestamp;
    const frame = new VideoFrame(canvas, { timestamp: outputTimestamp, duration: frameDurationMicroseconds, alpha: "discard" });
    try {
      videoEncoder.encode(frame, { keyFrame: options.onEncodedFrame(outputTimestamp, frameIndex === 0) });
    } finally {
      closeVideoFrame(frame);
    }
  };

  try {
    await readSelectedRecords(input.file, selectedRecords, async (record, data) => {
      throwCodecFailure(decoderFailure);
      await waitForCombinedDecodeCapacity(decoder, () => pendingFrames, signal);
      const timestamp = Math.round((record.sample.cts / record.sample.timescale - record.mediaTimeOffsetSeconds) * 1_000_000);
      const duration = Math.max(1, Math.round(record.sample.duration / record.sample.timescale * 1_000_000));
      decoder.decode(new EncodedVideoChunk({
        type: record.sample.isSync ? "key" : "delta",
        timestamp,
        duration,
        data,
      }));
      if (activeWebCodecsMetrics) {
        activeWebCodecsMetrics.maxVideoDecodeQueueSize = Math.max(
          activeWebCodecsMetrics.maxVideoDecodeQueueSize,
          decoder.decodeQueueSize,
        );
      }
      reportProgress(
        "decode",
        Math.min(options.totalDurationMicroseconds, segmentOffsetMicroseconds + Math.max(0, timestamp - startMicroseconds)),
        options.totalDurationMicroseconds,
        workerMessage(options.language, "video.messages.video.processing"),
      );
    }, target, signal);
    await decoder.flush();
    await processing;
    throwCodecFailure(decoderFailure);
    if (!heldFrame) throw new Error("The selected range contains no decodable video frames");
    while (nextFrameIndex < expectedFrameCount) {
      await encodeCanvasFrame(heldFrame, nextFrameIndex);
      nextFrameIndex += 1;
    }
  } finally {
    if (heldFrame) closeVideoFrame(heldFrame);
    await flushAndCloseCodec(decoder);
  }
}

function frameTimestamp(frameIndex: number, frameRate: number) {
  return Math.round(frameIndex * 1_000_000 / frameRate);
}

function drawVideoFrame(
  context: OffscreenCanvasRenderingContext2D,
  frame: VideoFrame,
  descriptor: VideoStreamInputDescriptor,
  task: Extract<VideoTask, { kind: "encode" }>,
  baseDimensions: readonly [number, number],
  normalizeForConcat: boolean,
) {
  const sourceWidth = frame.displayWidth || descriptor.width;
  const sourceHeight = frame.displayHeight || descriptor.height;
  const layout = resolveVideoFrameTransformLayout(
    { width: sourceWidth, height: sourceHeight },
    task,
    baseDimensions,
    normalizeForConcat,
  );
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = "#000";
  context.fillRect(0, 0, layout.outputWidth, layout.outputHeight);
  const matrix = resolveVideoFrameCanvasTransform(task.rotation, task.flipHorizontal, baseDimensions);
  context.setTransform(...matrix);
  context.drawImage(
    frame,
    layout.sourceX,
    layout.sourceY,
    layout.sourceWidth,
    layout.sourceHeight,
    layout.destinationX,
    layout.destinationY,
    layout.destinationWidth,
    layout.destinationHeight,
  );
  context.setTransform(1, 0, 0, 1, 0, 0);
}

function closeVideoFrame(frame: VideoFrame) {
  try {
    frame.close();
  } finally {
    if (activeWebCodecsMetrics) activeWebCodecsMetrics.closedVideoFrames += 1;
  }
}

async function muxCopiedAudio(
  request: VideoStreamRunRequest,
  inputs: ParsedInput[],
  muxer: Muxer<StreamTarget>,
  target: VideoResultRandomAccessTarget,
  signal: AbortSignal,
) {
  const firstAudio = inputs[0]?.profile.audio;
  if (!firstAudio) return;
  let sentMetadata = false;
  let segmentOffsetMicroseconds = 0;
  for (let inputIndex = 0; inputIndex < inputs.length; inputIndex += 1) {
    throwIfAborted(signal);
    const input = inputs[inputIndex];
    const descriptor = request.job.inputs[inputIndex];
    if (!input.audio) throw new Error("The audio track is unavailable");
    const samples = selectAudioStreamSamples(
      input.audio.samples,
      descriptor.start,
      descriptor.end,
      input.audio.mediaTimeOffsetSeconds,
    );
    const records = samples.map((sample) => ({
      kind: "audio" as const,
      sample,
      mediaTimeOffsetSeconds: input.audio!.mediaTimeOffsetSeconds,
    }));
    await readSelectedRecords(input.file, records, (record, data) => {
      const sourceTimestamp = record.sample.cts / record.sample.timescale - record.mediaTimeOffsetSeconds;
      const timestamp = segmentOffsetMicroseconds + Math.max(0, Math.round((sourceTimestamp - descriptor.start) * 1_000_000));
      const duration = Math.max(1, Math.round(record.sample.duration / record.sample.timescale * 1_000_000));
      const metadata = sentMetadata ? undefined : {
        decoderConfig: {
          codec: firstAudio.codecName,
          numberOfChannels: firstAudio.channelCount!,
          sampleRate: firstAudio.sampleRate!,
          description: exactArrayBuffer(firstAudio.configuration),
        },
      };
      muxer.addAudioChunkRaw(data, "key", timestamp, duration, metadata);
      sentMetadata = true;
    }, target, signal);
    segmentOffsetMicroseconds += Math.max(1, Math.round((descriptor.end - descriptor.start) * 1_000_000));
  }
}

async function encodeAudioInputs(
  request: VideoStreamRunRequest,
  inputs: ParsedInput[],
  encoder: AudioEncoder,
  target: VideoResultRandomAccessTarget,
  signal: AbortSignal,
  throwAsyncFailure: () => void,
) {
  const firstAudio = inputs[0]?.profile.audio;
  if (!firstAudio) return;
  const outputConfig = createVideoWebCodecsAudioEncoderConfig(
    request.task,
    firstAudio.sampleRate!,
    firstAudio.channelCount!,
    request.job.mode === "concat",
  );
  let segmentOffsetMicroseconds = 0;
  for (let inputIndex = 0; inputIndex < inputs.length; inputIndex += 1) {
    throwIfAborted(signal);
    const input = inputs[inputIndex];
    const descriptor = request.job.inputs[inputIndex];
    if (!input.audio || !input.profile.audio) throw new Error("The audio track is unavailable");
    const samples = input.audio.samples.filter((sample) => {
      const start = sample.dts / sample.timescale - input.audio!.mediaTimeOffsetSeconds;
      const end = (sample.dts + sample.duration) / sample.timescale - input.audio!.mediaTimeOffsetSeconds;
      return end > descriptor.start + 1e-9 && start < descriptor.end - 1e-9;
    });
    const records = samples.map((sample) => ({
      kind: "audio" as const,
      sample,
      mediaTimeOffsetSeconds: input.audio!.mediaTimeOffsetSeconds,
    }));
    let decoderFailure: unknown;
    let pendingAudio = 0;
    let processing = Promise.resolve();
    let encodedFrames = 0;
    const decoder = new AudioDecoder({
      output(data) {
        pendingAudio += 1;
        if (activeWebCodecsMetrics) activeWebCodecsMetrics.decodedAudioData += 1;
        processing = processing.then(async () => {
          throwIfAborted(signal);
          throwAsyncFailure();
          const converted = convertAudioData(
            data,
            descriptor.start,
            descriptor.end,
            outputConfig.sampleRate,
            outputConfig.numberOfChannels,
            segmentOffsetMicroseconds,
            encodedFrames,
          );
          if (!converted) return;
          await waitForCodecQueue(encoder, "encodeQueueSize", 8, signal);
          if (activeWebCodecsMetrics) {
            activeWebCodecsMetrics.maxAudioEncodeQueueSize = Math.max(
              activeWebCodecsMetrics.maxAudioEncodeQueueSize,
              encoder.encodeQueueSize,
            );
          }
          try {
            encoder.encode(converted.data);
            encodedFrames += converted.numberOfFrames;
          } finally {
            converted.data.close();
          }
        }).catch((error) => {
          decoderFailure ||= error;
        }).finally(() => {
          closeAudioData(data);
          pendingAudio -= 1;
        });
      },
      error(error) {
        decoderFailure ||= error;
      },
    });
    decoder.configure(audioDecoderConfig(input.profile.audio));
    try {
      await readSelectedRecords(input.file, records, async (record, bytes) => {
        throwCodecFailure(decoderFailure);
        await waitForCombinedAudioDecodeCapacity(decoder, () => pendingAudio, signal);
        const timestamp = Math.round((record.sample.dts / record.sample.timescale - record.mediaTimeOffsetSeconds) * 1_000_000);
        const duration = Math.max(1, Math.round(record.sample.duration / record.sample.timescale * 1_000_000));
        decoder.decode(new EncodedAudioChunk({ type: "key", timestamp, duration, data: bytes }));
        if (activeWebCodecsMetrics) {
          activeWebCodecsMetrics.maxAudioDecodeQueueSize = Math.max(
            activeWebCodecsMetrics.maxAudioDecodeQueueSize,
            decoder.decodeQueueSize,
          );
        }
      }, target, signal);
      await decoder.flush();
      await processing;
      throwCodecFailure(decoderFailure);
    } finally {
      await flushAndCloseCodec(decoder);
    }
    segmentOffsetMicroseconds += Math.max(1, Math.round((descriptor.end - descriptor.start) * 1_000_000));
  }
}

function convertAudioData(
  data: AudioData,
  trimStartSeconds: number,
  trimEndSeconds: number,
  outputSampleRate: number,
  outputChannels: number,
  segmentOffsetMicroseconds: number,
  priorOutputFrames: number,
) {
  const dataStartSeconds = data.timestamp / 1_000_000;
  const startFrame = Math.max(0, Math.ceil((trimStartSeconds - dataStartSeconds) * data.sampleRate - 1e-6));
  const endFrame = Math.min(
    data.numberOfFrames,
    Math.max(startFrame, Math.floor((trimEndSeconds - dataStartSeconds) * data.sampleRate + 1e-6)),
  );
  const sourceFrameCount = endFrame - startFrame;
  if (sourceFrameCount <= 0) return undefined;
  const planes: Float32Array[] = [];
  for (let channel = 0; channel < data.numberOfChannels; channel += 1) {
    const plane = new Float32Array(sourceFrameCount);
    data.copyTo(plane, {
      format: "f32-planar",
      planeIndex: channel,
      frameOffset: startFrame,
      frameCount: sourceFrameCount,
    });
    planes.push(plane);
  }
  const outputFrameCount = Math.max(1, Math.round(sourceFrameCount * outputSampleRate / data.sampleRate));
  const output = new Float32Array(outputFrameCount * outputChannels);
  for (let channel = 0; channel < outputChannels; channel += 1) {
    const destination = output.subarray(channel * outputFrameCount, (channel + 1) * outputFrameCount);
    for (let frameIndex = 0; frameIndex < outputFrameCount; frameIndex += 1) {
      const sourcePosition = Math.min(sourceFrameCount - 1, frameIndex * data.sampleRate / outputSampleRate);
      const leftIndex = Math.floor(sourcePosition);
      const rightIndex = Math.min(sourceFrameCount - 1, leftIndex + 1);
      const fraction = sourcePosition - leftIndex;
      const left = channelSample(planes, channel, leftIndex, outputChannels);
      const right = channelSample(planes, channel, rightIndex, outputChannels);
      destination[frameIndex] = left + (right - left) * fraction;
    }
  }
  const timestamp = segmentOffsetMicroseconds + Math.round(priorOutputFrames / outputSampleRate * 1_000_000);
  return {
    numberOfFrames: outputFrameCount,
    data: new AudioData({
      format: "f32-planar",
      sampleRate: outputSampleRate,
      numberOfFrames: outputFrameCount,
      numberOfChannels: outputChannels,
      timestamp,
      data: output,
    }),
  };
}

function channelSample(planes: readonly Float32Array[], outputChannel: number, frameIndex: number, outputChannels: number) {
  if (outputChannels === 1 && planes.length > 1) {
    return planes.reduce((total, plane) => total + plane[frameIndex], 0) / planes.length;
  }
  if (planes.length === 1) return planes[0][frameIndex];
  return planes[Math.min(outputChannel, planes.length - 1)][frameIndex];
}

function closeAudioData(data: AudioData) {
  try {
    data.close();
  } finally {
    if (activeWebCodecsMetrics) activeWebCodecsMetrics.closedAudioData += 1;
  }
}

async function inspectJob(job: VideoStreamJobDescriptor, audioMode: VideoAudioMode, signal?: AbortSignal): Promise<VideoStreamCopyProbeResult> {
  try {
    const files = await requestJobFiles(job, false, signal);
    const inputs: ParsedInput[] = [];
    for (const file of files) inputs.push(await parseInput(file, audioMode, undefined, signal));
    if (!compareVideoStreamInputProfiles(inputs.map((input) => input.profile), audioMode === "copy")) {
      return { compatible: false, reasonCode: "CONCAT_TRACK_MISMATCH" };
    }
    return { compatible: true, codec: inputs[0].profile.codec, reasonCode: "READY" };
  } catch (error) {
    if (isAbortError(error)) throw error;
    const reasonCode = isReasonError(error) ? error.reasonCode : "NOT_ISO_BMFF";
    return { compatible: false, reasonCode };
  }
}

async function parseInput(
  file: File,
  audioMode: VideoAudioMode,
  onProgress?: (logicalPosition: number) => void,
  signal?: AbortSignal,
): Promise<ParsedInput> {
  if (!file.size) throw reasonError("NOT_ISO_BMFF");
  const parser = createFile(false) as ISOFile<unknown, unknown>;
  let info: Movie | undefined;
  let parserFailure = false;
  parser.onReady = (value) => { info = value; };
  parser.onError = () => { parserFailure = true; };

  let offset = 0;
  let bytesRead = 0;
  const visitedOffsets = new Set<number>();
  while (!info && offset < file.size) {
    throwIfAborted(signal);
    if (visitedOffsets.has(offset)) throw reasonError("NOT_ISO_BMFF");
    visitedOffsets.add(offset);
    const end = Math.min(file.size, offset + METADATA_CHUNK_BYTES);
    const buffer = await readInputSlice(file, offset, end, signal) as MP4BoxBuffer;
    buffer.fileStart = offset;
    bytesRead += buffer.byteLength;
    const nextOffset = parser.appendBuffer(buffer, end === file.size);
    if (parserFailure && !info) throw reasonError("NOT_ISO_BMFF");
    onProgress?.(Math.min(file.size, Math.max(end, Number.isFinite(nextOffset) ? nextOffset : end)));
    if (info) break;
    offset = Number.isFinite(nextOffset) && nextOffset > offset ? Math.min(file.size, nextOffset) : end;
  }
  if (!info) {
    parser.flush();
    if (!info) throw reasonError("NOT_ISO_BMFF");
  }
  if (info.isFragmented) throw reasonError("FRAGMENTED_INPUT");
  const videoTrack = info.videoTracks[0];
  if (!videoTrack) throw reasonError("VIDEO_TRACK_UNAVAILABLE");
  const video = parseTrack(parser, videoTrack);
  const videoEntry = firstSampleEntry(videoTrack, parser);
  const codec = classifyVideoCodec(videoTrack.codec);
  if (!codec) throw reasonError("VIDEO_CODEC_UNSUPPORTED");
  if ((codec === "h264" && videoEntry.type !== "avc1") || (codec === "hevc" && videoEntry.type !== "hvc1")) {
    throw reasonError("VIDEO_SAMPLE_ENTRY_UNSUPPORTED");
  }
  const videoBox = codec === "h264" ? videoEntry.avcC : videoEntry.hvcC;
  if (!videoBox) throw reasonError("VIDEO_CONFIGURATION_UNAVAILABLE");
  const videoConfiguration = await readBoxPayload(file, videoBox, "VIDEO_CONFIGURATION_UNAVAILABLE");

  let audio: ParsedTrack | undefined;
  let audioProfile: VideoStreamInputProfile["audio"];
  if (audioMode !== "remove" && info.audioTracks[0]) {
    const audioTrack = info.audioTracks[0];
    if (!audioTrack.codec.startsWith("mp4a.40.")) throw reasonError("AUDIO_CODEC_UNSUPPORTED");
    audio = parseTrack(parser, audioTrack);
    const audioEntry = firstSampleEntry(audioTrack, parser);
    if (audioEntry.type !== "mp4a") throw reasonError("AUDIO_CODEC_UNSUPPORTED");
    const audioConfiguration = decoderSpecificInfo(audioEntry);
    if (!audioConfiguration?.byteLength) throw reasonError("AUDIO_CONFIGURATION_UNAVAILABLE");
    audioProfile = {
      codecName: audioTrack.codec,
      sampleEntry: audioEntry.type,
      configuration: audioConfiguration.slice(),
      channelCount: audioTrack.audio?.channel_count,
      sampleRate: audioTrack.audio?.sample_rate,
    };
  }

  return {
    file,
    metadataBytesRead: bytesRead,
    video,
    audio,
    profile: {
      codec,
      video: {
        codecName: videoTrack.codec,
        sampleEntry: videoEntry.type,
        configuration: videoConfiguration,
        width: videoTrack.video?.width,
        height: videoTrack.video?.height,
      },
      audio: audioProfile,
    },
  };
}

function parseTrack(parser: ISOFile<unknown, unknown>, track: Track): ParsedTrack {
  const sourceSamples = parser.getTrackSamplesInfo(track.id);
  if (!sourceSamples.length) throw reasonError("SAMPLE_TABLE_UNAVAILABLE");
  const mediaTimeOffsetSeconds = simpleMediaTimeOffset(track);
  const samples = sourceSamples.map(normalizeSample);
  const firstDescriptionIndex = sourceSamples[0].description_index;
  if (sourceSamples.some((sample) => sample.description_index !== firstDescriptionIndex)) {
    throw reasonError(track.type === "audio" ? "AUDIO_CONFIGURATION_UNAVAILABLE" : "VIDEO_CONFIGURATION_UNAVAILABLE");
  }
  return { track, samples, mediaTimeOffsetSeconds };
}

function firstSampleEntry(track: Track, parser: ISOFile<unknown, unknown>) {
  const entry = parser.getTrackSamplesInfo(track.id)[0]?.description as SampleEntryLike | undefined;
  if (!entry?.type) throw reasonError("SAMPLE_TABLE_UNAVAILABLE");
  return entry as SampleEntryLike & { type: string };
}

function normalizeSample(sample: Sample): VideoStreamSampleInfo {
  if (!Number.isSafeInteger(sample.offset) || !Number.isSafeInteger(sample.size) || sample.offset < 0 || sample.size <= 0) {
    throw reasonError("SAMPLE_TABLE_UNAVAILABLE");
  }
  return {
    number: sample.number,
    offset: sample.offset,
    size: sample.size,
    dts: sample.dts,
    cts: sample.cts,
    duration: sample.duration,
    timescale: sample.timescale,
    isSync: sample.is_sync,
  };
}

function simpleMediaTimeOffset(track: Track) {
  const edits = (track.edits || []) as TrackEditLike[];
  if (!edits.length) return 0;
  if (edits.length !== 1) throw reasonError("EDIT_LIST_UNSUPPORTED");
  const edit = edits[0];
  if (!Number.isFinite(edit.media_time) || edit.media_time! < 0
    || (edit.media_rate_integer ?? 1) !== 1 || (edit.media_rate_fraction ?? 0) !== 0) {
    throw reasonError("EDIT_LIST_UNSUPPORTED");
  }
  return edit.media_time! / track.timescale;
}

async function muxJob(request: VideoStreamRunRequest, inputs: ParsedInput[], target: VideoResultRandomAccessTarget, signal?: AbortSignal) {
  const first = inputs[0];
  const includeAudio = request.task.audioMode === "copy" && Boolean(first.audio && first.profile.audio);
  const streamTarget = new StreamTarget({
    chunked: true,
    chunkSize: OUTPUT_CHUNK_BYTES,
    onData(data, position) {
      target.write(data, position);
    },
  });
  const muxer = new Muxer({
    target: streamTarget,
    video: {
      codec: first.profile.codec === "h264" ? "avc" : "hevc",
      width: first.profile.video.width!,
      height: first.profile.video.height!,
    },
    audio: includeAudio ? {
      codec: "aac",
      numberOfChannels: first.profile.audio!.channelCount!,
      sampleRate: first.profile.audio!.sampleRate!,
    } : undefined,
    fastStart: false,
    firstTimestampBehavior: "cross-track-offset",
  });

  const selections = inputs.map((input, inputIndex) => selectInputSamples(input, request.job.inputs[inputIndex], includeAudio));
  if (activeCopyMetrics) {
    activeCopyMetrics.segments = selections.map((selection, index) => ({
      requestedStartSeconds: request.job.inputs[index].start,
      requestedEndSeconds: request.job.inputs[index].end,
      snappedPresentationSeconds: selection.snappedPresentationSeconds,
      firstVideoDecodeSeconds: selection.firstVideoDecodeSeconds,
      firstAudioDecodeSeconds: selection.firstAudioDecodeSeconds,
    }));
  }
  const selectedBytes = selections.reduce((total, selection) => total + selection.records.reduce((sum, record) => sum + record.sample.size, 0), 0);
  let copiedBytes = 0;
  let segmentOffsetMicroseconds = 0;
  let sentVideoMetadata = false;
  let sentAudioMetadata = false;
  for (let inputIndex = 0; inputIndex < inputs.length; inputIndex += 1) {
    throwIfAborted(signal);
    const input = inputs[inputIndex];
    const selection = selections[inputIndex];
    await readSelectedRecords(input.file, selection.records, async (record, data) => {
      const decodeSeconds = record.sample.dts / record.sample.timescale - record.mediaTimeOffsetSeconds;
      const presentationSeconds = record.sample.cts / record.sample.timescale - record.mediaTimeOffsetSeconds;
      const decodeMicroseconds = Math.round((decodeSeconds - selection.originDecodeSeconds) * 1_000_000) + segmentOffsetMicroseconds;
      const presentationMicroseconds = Math.round((presentationSeconds - selection.originDecodeSeconds) * 1_000_000) + segmentOffsetMicroseconds;
      const durationMicroseconds = Math.max(1, Math.round(record.sample.duration / record.sample.timescale * 1_000_000));
      if (record.kind === "video") {
        const metadata = sentVideoMetadata ? undefined : {
          decoderConfig: {
            codec: first.profile.video.codecName,
            codedWidth: first.profile.video.width,
            codedHeight: first.profile.video.height,
            description: exactArrayBuffer(first.profile.video.configuration),
          },
        };
        muxer.addVideoChunkRaw(
          data,
          record.sample.isSync ? "key" : "delta",
          presentationMicroseconds,
          durationMicroseconds,
          metadata,
          presentationMicroseconds - decodeMicroseconds,
        );
        sentVideoMetadata = true;
      } else {
        const metadata = sentAudioMetadata ? undefined : {
          decoderConfig: {
            codec: first.profile.audio!.codecName,
            numberOfChannels: first.profile.audio!.channelCount!,
            sampleRate: first.profile.audio!.sampleRate!,
            description: exactArrayBuffer(first.profile.audio!.configuration),
          },
        };
        muxer.addAudioChunkRaw(data, "key", presentationMicroseconds, durationMicroseconds, metadata);
        sentAudioMetadata = true;
      }
      copiedBytes += record.sample.size;
      reportProgress(
        "mux",
        copiedBytes,
        Math.max(1, selectedBytes),
        workerMessage(request.language, "video.messages.video.copyingSelectedRange", { p0: inputIndex + 1, p1: inputs.length }),
      );
    }, target, signal);
    segmentOffsetMicroseconds += Math.max(1, Math.round(selection.durationSeconds * 1_000_000));
  }
  muxer.finalize();
  await target.flush();
  reportProgress("mux", selectedBytes, Math.max(1, selectedBytes), workerMessage(request.language, "video.messages.video.finalizingCompletedVideo"));
  const outputName = createVideoOutputName(request.job.name, request.task, request.job.mode === "concat", request.fileLabels as VideoFileLabels);
  const output = await target.complete(outputName, "video/mp4");
  reportProgress("write", output.size, output.size, workerMessage(request.language, "video.messages.video.resultReadyCheckingTheNextJob", { p0: 1, p1: 1 }));
  return output;
}

function selectInputSamples(input: ParsedInput, descriptor: VideoStreamInputDescriptor, includeAudio: boolean) {
  const video = selectVideoStreamSamples(
    input.video.samples,
    descriptor.start,
    descriptor.end,
    input.video.mediaTimeOffsetSeconds,
  );
  if (!video) throw reasonError("SAMPLE_TABLE_UNAVAILABLE");
  const audioSamples = includeAudio && input.audio
    ? selectAudioStreamSamples(
        input.audio.samples,
        video.firstDecodeSeconds,
        descriptor.end,
        input.audio.mediaTimeOffsetSeconds,
      )
    : [];
  const records: SelectedRecord[] = [
    ...video.samples.map((sample) => ({ kind: "video" as const, sample, mediaTimeOffsetSeconds: input.video.mediaTimeOffsetSeconds })),
    ...audioSamples.map((sample) => ({ kind: "audio" as const, sample, mediaTimeOffsetSeconds: input.audio!.mediaTimeOffsetSeconds })),
  ].sort((left, right) => left.sample.offset - right.sample.offset);
  const audioFirstDecode = audioSamples[0]
    ? audioSamples[0].dts / audioSamples[0].timescale - input.audio!.mediaTimeOffsetSeconds
    : Number.POSITIVE_INFINITY;
  const audioEndDecode = audioSamples.length
    ? (audioSamples[audioSamples.length - 1].dts + audioSamples[audioSamples.length - 1].duration) / audioSamples[audioSamples.length - 1].timescale - input.audio!.mediaTimeOffsetSeconds
    : Number.NEGATIVE_INFINITY;
  const originDecodeSeconds = Math.min(video.firstDecodeSeconds, audioFirstDecode);
  const endDecodeSeconds = Math.max(video.endDecodeSeconds, audioEndDecode);
  return {
    records,
    originDecodeSeconds,
    durationSeconds: endDecodeSeconds - originDecodeSeconds,
    snappedPresentationSeconds: video.snappedPresentationSeconds,
    firstVideoDecodeSeconds: video.firstDecodeSeconds,
    firstAudioDecodeSeconds: Number.isFinite(audioFirstDecode) ? audioFirstDecode : undefined,
  };
}

async function readSelectedRecords(
  file: File,
  records: readonly SelectedRecord[],
  onRecord: (record: SelectedRecord, data: Uint8Array) => void | Promise<void>,
  target: VideoResultRandomAccessTarget,
  signal?: AbortSignal,
) {
  let index = 0;
  while (index < records.length) {
    throwIfAborted(signal);
    const start = records[index].sample.offset;
    const windowLimit = Math.min(file.size, start + SAMPLE_READ_WINDOW_BYTES);
    let end = windowLimit;
    let endIndex = index;
    while (endIndex < records.length) {
      const recordEnd = records[endIndex].sample.offset + records[endIndex].sample.size;
      if (recordEnd > windowLimit) {
        if (endIndex === index) {
          end = recordEnd;
          endIndex += 1;
        }
        break;
      }
      endIndex += 1;
    }
    if (end > file.size || end <= start) throw reasonError("SAMPLE_TABLE_UNAVAILABLE");
    const bytes = new Uint8Array(await readInputSlice(file, start, end, signal));
    for (let recordIndex = index; recordIndex < endIndex; recordIndex += 1) {
      const record = records[recordIndex];
      throwIfAborted(signal);
      const relativeStart = record.sample.offset - start;
      const relativeEnd = relativeStart + record.sample.size;
      if (relativeStart < 0 || relativeEnd > bytes.byteLength) throw reasonError("SAMPLE_TABLE_UNAVAILABLE");
      await onRecord(record, bytes.subarray(relativeStart, relativeEnd));
    }
    await target.flush();
    index = endIndex;
  }
}

async function readBoxPayload(file: File, box: BoxLike, reasonCode: VideoStreamCopyReasonCode) {
  const start = box.start;
  const size = box.size;
  const headerSize = box.hdr_size ?? 8;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(size) || start! < 0 || size! <= headerSize || start! + size! > file.size) {
    throw reasonError(reasonCode);
  }
  return new Uint8Array(await readInputSlice(file, start! + headerSize, start! + size!));
}

function decoderSpecificInfo(entry: SampleEntryLike) {
  const esds = entry.esds || entry.wave?.esds || entry.wave?.esdss?.[0];
  const root = esds?.esd;
  const descriptor = root?.findDescriptor?.(5) || findDescriptor(root, 5);
  return descriptor?.data;
}

function findDescriptor(root: DescriptorLike | undefined, tag: number): DescriptorLike | undefined {
  if (!root) return undefined;
  if (root.tag === tag) return root;
  for (const child of root.descs || []) {
    const result = findDescriptor(child, tag);
    if (result) return result;
  }
  return undefined;
}

function classifyVideoCodec(codecName: string) {
  if (codecName.startsWith("avc1.")) return "h264" as const;
  if (codecName.startsWith("hvc1.")) return "hevc" as const;
  return undefined;
}

async function requestJobFiles(job: VideoStreamJobDescriptor, instrumentWholeReads = false, signal?: AbortSignal) {
  const files: File[] = [];
  for (const input of job.inputs) {
    throwIfAborted(signal);
    const file = await requestInputFile(input.fileId, input.fileName);
    if (instrumentWholeReads) instrumentWholeFileArrayBuffer(file);
    files.push(file);
  }
  return files;
}

function requestInputFile(fileId: string, fileName: string) {
  return new Promise<File>((resolve, reject) => {
    const timeout = worker.setTimeout(() => {
      pendingInputs.delete(fileId);
      reject(new Error("Input file request timed out"));
    }, INPUT_REQUEST_TIMEOUT_MS);
    pendingInputs.set(fileId, { resolve, reject, timeout });
    worker.postMessage({ type: "request-input-file", fileId, fileName });
  });
}

function reportProgress(stage: VideoProgressStage, completedUnits: number, totalUnits: number, message: string) {
  worker.postMessage({ type: "progress", stage, completedUnits, totalUnits, message });
}

function closeWorker() {
  for (const pending of pendingInputs.values()) {
    worker.clearTimeout(pending.timeout);
    pending.reject(new Error("Video operation ended"));
  }
  pendingInputs.clear();
  activeAbortController = undefined;
  worker.close();
}

function reasonError(reasonCode: VideoStreamCopyReasonCode) {
  return Object.assign(new Error(reasonCode), { reasonCode });
}

function isReasonError(error: unknown): error is Error & { reasonCode: VideoStreamCopyReasonCode } {
  return error instanceof Error && "reasonCode" in error;
}

function exactArrayBuffer(bytes: Uint8Array) {
  return bytes.slice().buffer;
}

function createMetrics(): VideoStreamCopyMetrics {
  return {
    inputWholeArrayBufferCalls: 0,
    inputSliceArrayBufferCalls: 0,
    inputBytesRead: 0,
    maxInputSliceBytes: 0,
    outputWriteCalls: 0,
    outputCumulativeBytesMonotonic: true,
    outputLastCumulativeBytes: 0,
    maxOutputWriteBytes: 0,
    outputFileSize: 0,
    segments: [],
  };
}

function createWebCodecsMetrics(): VideoWebCodecsMetrics {
  return {
    inputWholeArrayBufferCalls: 0,
    inputSliceArrayBufferCalls: 0,
    inputBytesRead: 0,
    maxInputSliceBytes: 0,
    outputWriteCalls: 0,
    outputCumulativeBytesMonotonic: true,
    outputLastCumulativeBytes: 0,
    maxOutputWriteBytes: 0,
    outputFileSize: 0,
    decodedVideoFrames: 0,
    closedVideoFrames: 0,
    encodedVideoFrames: 0,
    decodedAudioData: 0,
    closedAudioData: 0,
    encodedAudioData: 0,
    maxVideoDecodeQueueSize: 0,
    maxVideoEncodeQueueSize: 0,
    maxAudioDecodeQueueSize: 0,
    maxAudioEncodeQueueSize: 0,
  };
}

function instrumentWholeFileArrayBuffer(file: File) {
  const original = file.arrayBuffer.bind(file);
  try {
    Object.defineProperty(file, "arrayBuffer", {
      configurable: true,
      value: () => {
        const metrics = activeCopyMetrics || activeWebCodecsMetrics;
        if (metrics) metrics.inputWholeArrayBufferCalls += 1;
        return original();
      },
    });
  } catch {
    // This optional counter does not alter the bounded File.slice() production read path.
  }
}

type QueueCodec = EventTarget & {
  state: CodecState;
  decodeQueueSize?: number;
  encodeQueueSize?: number;
};

async function waitForCombinedDecodeCapacity(decoder: VideoDecoder, pending: () => number, signal: AbortSignal) {
  while (decoder.decodeQueueSize + pending() >= 8) await waitForCodecQueueSignal(decoder, signal);
}

async function waitForCombinedAudioDecodeCapacity(decoder: AudioDecoder, pending: () => number, signal: AbortSignal) {
  while (decoder.decodeQueueSize + pending() >= 12) await waitForCodecQueueSignal(decoder, signal);
}

async function waitForCodecQueue(
  codec: QueueCodec,
  property: "decodeQueueSize" | "encodeQueueSize",
  limit: number,
  signal: AbortSignal,
) {
  while ((codec[property] ?? 0) >= limit) await waitForCodecQueueSignal(codec, signal);
}

function waitForCodecQueueSignal(codec: QueueCodec, signal: AbortSignal) {
  throwIfAborted(signal);
  return new Promise<void>((resolve, reject) => {
    const timeout = worker.setTimeout(done, 8);
    const aborted = () => {
      cleanup();
      reject(new DOMException("Canceled", "AbortError"));
    };
    function cleanup() {
      worker.clearTimeout(timeout);
      codec.removeEventListener("dequeue", done);
      signal.removeEventListener("abort", aborted);
    }
    function done() {
      cleanup();
      resolve();
    }
    codec.addEventListener("dequeue", done, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
  });
}

async function flushAndCloseCodec(codec: { state: CodecState; flush: () => Promise<void>; close: () => void }) {
  if (codec.state === "closed") return;
  await codec.flush().catch(() => undefined);
  try { codec.close(); } catch { /* the error callback may have closed it */ }
}

function throwCodecFailure(error: unknown): asserts error is undefined {
  if (error) throw error;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Canceled", "AbortError");
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function readInputSlice(file: File, start: number, end: number, signal?: AbortSignal) {
  throwIfAborted(signal);
  const byteLength = Math.max(0, end - start);
  const metrics = activeCopyMetrics || activeWebCodecsMetrics;
  if (metrics) {
    metrics.inputSliceArrayBufferCalls += 1;
    metrics.inputBytesRead += byteLength;
    metrics.maxInputSliceBytes = Math.max(metrics.maxInputSliceBytes, byteLength);
  }
  const buffer = await file.slice(start, end).arrayBuffer();
  throwIfAborted(signal);
  return buffer;
}
