/// <reference lib="webworker" />

import { createFile, type ISOFile, type MP4BoxBuffer, type Movie, type Sample, type Track } from "mp4box";
import { Muxer, StreamTarget } from "mp4-muxer";

import { workerMessage } from "../../i18n/workerMessages.ts";
import { createVideoWorkerResult, createVideoOutputName, type VideoFileLabels } from "./videoProcessingShared.ts";
import { createVideoResultRandomAccessTarget, type VideoResultRandomAccessTarget } from "./videoResultStorage.worker.ts";
import {
  compareVideoStreamInputProfiles,
  selectAudioStreamSamples,
  selectVideoStreamSamples,
  type VideoStreamCopyMetrics,
  type VideoStreamCopyProbeResult,
  type VideoStreamInputProfile,
  type VideoStreamSampleInfo,
  type VideoStreamCopyReasonCode,
} from "./videoStreamCopy.ts";
import type {
  VideoStreamInputDescriptor,
  VideoStreamJobDescriptor,
  VideoStreamPreflightRequest,
  VideoStreamRunRequest,
} from "./videoStreamWorkerClient.ts";
import type { VideoProgressStage } from "./videoProcessingProgress.ts";
import type { VideoAudioMode } from "./types.ts";

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
let activeMetrics: VideoStreamCopyMetrics | undefined;

worker.onmessage = (event: MessageEvent) => {
  if (event.data?.type === "input-file") {
    const pending = pendingInputs.get(event.data.fileId);
    if (!pending || !(event.data.file instanceof File)) return;
    pendingInputs.delete(event.data.fileId);
    worker.clearTimeout(pending.timeout);
    pending.resolve(event.data.file);
    return;
  }
  if (active || (event.data?.type !== "preflight" && event.data?.type !== "start")) return;
  active = true;
  void (event.data.type === "preflight"
    ? handlePreflight(event.data.request as VideoStreamPreflightRequest)
    : handleStart(event.data.request as VideoStreamRunRequest)
  ).catch(() => {
    worker.postMessage({ type: "error" });
    closeWorker();
  });
};

worker.postMessage({ type: "ready" });

async function handlePreflight(request: VideoStreamPreflightRequest) {
  const probe = await inspectJob(request.job, request.audioMode);
  worker.postMessage({ type: "preflight-result", probe });
  closeWorker();
}

async function handleStart(request: VideoStreamRunRequest) {
  if (request.task.bitrate !== "copy" || request.task.container !== "mp4" || !request.resultStorage) {
    throw new Error("Unsupported direct-copy request");
  }
  activeMetrics = request.collectMetrics ? createMetrics() : undefined;
  const files = await requestJobFiles(request.job, Boolean(activeMetrics));
  const parsedInputs: ParsedInput[] = [];
  let metadataCompleted = 0;
  const metadataTotal = Math.max(1, files.reduce((total, file) => total + file.size, 0));
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const parsed = await parseInput(file, request.task.audioMode, (logicalPosition) => {
      reportProgress(
        "demux",
        metadataCompleted + logicalPosition,
        metadataTotal,
        workerMessage(request.language, "video.messages.video.checkingSourceForDirectCopy", { p0: index + 1, p1: files.length }),
      );
    });
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
        if (activeMetrics) {
          activeMetrics.outputCumulativeBytesMonotonic &&= cumulativeBytes >= activeMetrics.outputLastCumulativeBytes;
          activeMetrics.outputLastCumulativeBytes = cumulativeBytes;
          activeMetrics.outputWriteCalls += 1;
          activeMetrics.maxOutputWriteBytes = Math.max(activeMetrics.maxOutputWriteBytes, byteLength);
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
    const output = await muxJob(request, parsedInputs, target);
    if (activeMetrics) activeMetrics.outputFileSize = output.size;
    worker.postMessage({ type: "output", output });
    worker.postMessage({
      type: "result",
      result: {
        ...createVideoWorkerResult(1, request.task, (key, values) => workerMessage(request.language, key, values)),
        metrics: activeMetrics,
      },
    });
    closeWorker();
  } catch (error) {
    await target?.discard().catch(() => undefined);
    throw error;
  }
}

async function inspectJob(job: VideoStreamJobDescriptor, audioMode: VideoAudioMode): Promise<VideoStreamCopyProbeResult> {
  try {
    const files = await requestJobFiles(job);
    const inputs: ParsedInput[] = [];
    for (const file of files) inputs.push(await parseInput(file, audioMode));
    if (!compareVideoStreamInputProfiles(inputs.map((input) => input.profile), audioMode === "copy")) {
      return { compatible: false, reasonCode: "CONCAT_TRACK_MISMATCH" };
    }
    return { compatible: true, codec: inputs[0].profile.codec, reasonCode: "READY" };
  } catch (error) {
    const reasonCode = isReasonError(error) ? error.reasonCode : "NOT_ISO_BMFF";
    return { compatible: false, reasonCode };
  }
}

async function parseInput(file: File, audioMode: VideoAudioMode, onProgress?: (logicalPosition: number) => void): Promise<ParsedInput> {
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
    if (visitedOffsets.has(offset)) throw reasonError("NOT_ISO_BMFF");
    visitedOffsets.add(offset);
    const end = Math.min(file.size, offset + METADATA_CHUNK_BYTES);
    const buffer = await readInputSlice(file, offset, end) as MP4BoxBuffer;
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
  if (audioMode === "copy" && info.audioTracks[0]) {
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

async function muxJob(request: VideoStreamRunRequest, inputs: ParsedInput[], target: VideoResultRandomAccessTarget) {
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
  if (activeMetrics) {
    activeMetrics.segments = selections.map((selection, index) => ({
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
    }, target);
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
) {
  let index = 0;
  while (index < records.length) {
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
    const bytes = new Uint8Array(await readInputSlice(file, start, end));
    for (let recordIndex = index; recordIndex < endIndex; recordIndex += 1) {
      const record = records[recordIndex];
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

async function requestJobFiles(job: VideoStreamJobDescriptor, instrumentWholeReads = false) {
  const files: File[] = [];
  for (const input of job.inputs) {
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

function instrumentWholeFileArrayBuffer(file: File) {
  const original = file.arrayBuffer.bind(file);
  try {
    Object.defineProperty(file, "arrayBuffer", {
      configurable: true,
      value: () => {
        if (activeMetrics) activeMetrics.inputWholeArrayBufferCalls += 1;
        return original();
      },
    });
  } catch {
    // This optional counter does not alter the bounded File.slice() production read path.
  }
}

function readInputSlice(file: File, start: number, end: number) {
  const byteLength = Math.max(0, end - start);
  if (activeMetrics) {
    activeMetrics.inputSliceArrayBufferCalls += 1;
    activeMetrics.inputBytesRead += byteLength;
    activeMetrics.maxInputSliceBytes = Math.max(activeMetrics.maxInputSliceBytes, byteLength);
  }
  return file.slice(start, end).arrayBuffer();
}
