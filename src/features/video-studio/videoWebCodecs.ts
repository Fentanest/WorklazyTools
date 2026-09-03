import type { VideoTask, VideoWorkerInput } from "./types.ts";
import { outputDimensionsForSource, resolveAudioSampleRate } from "./videoEncoding.ts";
import {
  capabilityProbeCause,
  type VideoAudioAlternativeProbes,
  type VideoCapabilityReasonCode,
  type VideoProbeCause,
} from "./videoProbe.ts";

export type VideoWebCodecsReasonCode =
  | "READY"
  | "INPUT_UNSUPPORTED"
  | Exclude<VideoCapabilityReasonCode, "AUDIO_TRACK_UNAVAILABLE" | "AUDIO_ENCODER_SUPPORTED">;

export type VideoHybridReasonCode = VideoWebCodecsReasonCode
  | "AUDIO_TRACK_UNAVAILABLE"
  | "AUDIO_ENCODER_SUPPORTED";

export interface VideoWebCodecsProbeResult {
  compatible: boolean;
  reasonCode: VideoWebCodecsReasonCode;
  cause?: VideoProbeCause;
  audioAlternatives?: VideoAudioAlternativeProbes;
  sourceAudioBitratesBps?: Array<number | null | undefined>;
  dvBaseLayer?: { compatIds: number[] };
}

export interface VideoHybridProbeResult extends Omit<VideoWebCodecsProbeResult, "reasonCode"> {
  reasonCode: VideoHybridReasonCode;
}

export interface VideoWebCodecsMetrics {
  inputWholeArrayBufferCalls: number;
  inputSliceArrayBufferCalls: number;
  inputBytesRead: number;
  maxInputSliceBytes: number;
  outputWriteCalls: number;
  outputCumulativeBytesMonotonic: boolean;
  outputLastCumulativeBytes: number;
  maxOutputWriteBytes: number;
  outputFileSize: number;
  decodedVideoFrames: number;
  closedVideoFrames: number;
  encodedVideoFrames: number;
  decodedAudioData: number;
  closedAudioData: number;
  encodedAudioData: number;
  maxVideoDecodeQueueSize: number;
  maxVideoEncodeQueueSize: number;
  maxAudioDecodeQueueSize: number;
  maxAudioEncodeQueueSize: number;
}

export interface VideoWebCodecsSupportRequest {
  videoDecoderConfigs: VideoDecoderConfig[];
  videoEncoderConfig: VideoEncoderConfig;
  audioMode: "copy" | "remove" | "encode";
  audioDecoderConfigs: AudioDecoderConfig[];
  audioEncoderConfig?: AudioEncoderConfig;
  audioTracksCompatible?: boolean;
}

interface WebCodecsSupportConstructor<Config, Support> {
  isConfigSupported: (config: Config) => Promise<Support>;
}

export interface VideoWebCodecsSupportApi {
  offscreenCanvasAvailable: boolean;
  videoDecoder?: WebCodecsSupportConstructor<VideoDecoderConfig, VideoDecoderSupport>;
  videoEncoder?: WebCodecsSupportConstructor<VideoEncoderConfig, VideoEncoderSupport>;
  audioDecoder?: WebCodecsSupportConstructor<AudioDecoderConfig, AudioDecoderSupport>;
  audioEncoder?: WebCodecsSupportConstructor<AudioEncoderConfig, AudioEncoderSupport>;
}

export interface VideoFrameTransformLayout {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  destinationX: number;
  destinationY: number;
  destinationWidth: number;
  destinationHeight: number;
  baseWidth: number;
  baseHeight: number;
  outputWidth: number;
  outputHeight: number;
}

export function resolveVideoFrameCanvasTransform(
  rotation: 0 | 90 | 180 | 270,
  flipHorizontal: boolean,
  baseDimensions: readonly [number, number],
) {
  const [width, height] = baseDimensions;
  const outputWidth = rotation === 90 || rotation === 270 ? height : width;
  const rotated = rotation === 90
    ? [0, 1, -1, 0, height, 0] as const
    : rotation === 180
      ? [-1, 0, 0, -1, width, height] as const
      : rotation === 270
        ? [0, -1, 1, 0, 0, width] as const
        : [1, 0, 0, 1, 0, 0] as const;
  return flipHorizontal
    ? [negativeZeroSafe(rotated[0]), rotated[1], negativeZeroSafe(rotated[2]), rotated[3], outputWidth - rotated[4], rotated[5]] as const
    : rotated;
}

function negativeZeroSafe(value: number) {
  return value === 0 ? 0 : -value;
}

export async function assessVideoWebCodecsSupport(
  request: VideoWebCodecsSupportRequest,
  api: VideoWebCodecsSupportApi = browserWebCodecsSupportApi(),
): Promise<VideoWebCodecsProbeResult> {
  if (!api.offscreenCanvasAvailable) return unsupported("OFFSCREEN_CANVAS_UNAVAILABLE");
  if (!api.videoDecoder) return unsupported("VIDEO_DECODER_UNAVAILABLE");
  if (!api.videoEncoder) return unsupported("VIDEO_ENCODER_UNAVAILABLE");
  if (!await everyConfigSupported(request.videoDecoderConfigs, api.videoDecoder)) {
    return unsupported("VIDEO_DECODER_UNSUPPORTED");
  }
  if (!await configSupported(request.videoEncoderConfig, api.videoEncoder)) {
    return unsupported("VIDEO_ENCODER_UNSUPPORTED");
  }
  if (request.audioMode !== "remove" && request.audioTracksCompatible === false) {
    return unsupported("AUDIO_TRACK_MISMATCH");
  }
  const needsAudioEncoding = request.audioMode === "encode"
    && (request.audioDecoderConfigs.length > 0 || request.audioEncoderConfig !== undefined);
  if (needsAudioEncoding) {
    if (!api.audioDecoder) return unsupported("AUDIO_DECODER_UNAVAILABLE");
    if (!api.audioEncoder) return unsupported("AUDIO_ENCODER_UNAVAILABLE");
    if (!await everyConfigSupported(request.audioDecoderConfigs, api.audioDecoder)) {
      return unsupported("AUDIO_DECODER_UNSUPPORTED");
    }
    if (request.audioEncoderConfig && !await configSupported(request.audioEncoderConfig, api.audioEncoder)) {
      return unsupported("AUDIO_ENCODER_UNSUPPORTED");
    }
  }
  return { compatible: true, reasonCode: "READY" };
}

export async function assessVideoHybridSupport(
  request: Omit<VideoWebCodecsSupportRequest, "audioMode" | "audioDecoderConfigs" | "audioTracksCompatible"> & { hasAudio: boolean },
  api: VideoWebCodecsSupportApi = browserWebCodecsSupportApi(),
): Promise<VideoHybridProbeResult> {
  const video = await assessVideoWebCodecsSupport({
    ...request,
    audioMode: "remove",
    audioDecoderConfigs: [],
    audioTracksCompatible: true,
  }, api);
  if (!video.compatible) return video;
  if (!request.hasAudio || !request.audioEncoderConfig) {
    return {
      compatible: false,
      reasonCode: "AUDIO_TRACK_UNAVAILABLE",
      cause: capabilityProbeCause("AUDIO_TRACK_UNAVAILABLE"),
    };
  }
  if (api.audioEncoder && await configSupported(request.audioEncoderConfig, api.audioEncoder)) {
    return {
      compatible: false,
      reasonCode: "AUDIO_ENCODER_SUPPORTED",
      cause: capabilityProbeCause("AUDIO_ENCODER_SUPPORTED"),
    };
  }
  return { compatible: true, reasonCode: "READY" };
}

export function createVideoWebCodecsEncoderConfig(
  task: Extract<VideoTask, { kind: "encode" }>,
  width: number,
  height: number,
  frameRate: number,
): VideoEncoderConfig {
  const bitrate = parseVideoBitrate(task.bitrate);
  const config: VideoEncoderConfig = {
    codec: task.codec === "h264" ? h264CodecFor(width, height, frameRate, bitrate) : "hvc1.1.6.L93.B0",
    width,
    height,
    displayWidth: width,
    displayHeight: height,
    bitrate,
    bitrateMode: "variable",
    framerate: frameRate,
    hardwareAcceleration: "no-preference",
    latencyMode: "realtime",
  };
  if (task.codec === "h264") config.avc = { format: "avc" };
  return config;
}

function h264CodecFor(width: number, height: number, frameRate: number, bitrate: number) {
  const macroblocksPerFrame = Math.ceil(width / 16) * Math.ceil(height / 16);
  const macroblocksPerSecond = macroblocksPerFrame * frameRate;
  const levels = [
    { idc: 0x1f, maxFrame: 3_600, maxRate: 108_000, maxBitrate: 14_000_000 },
    { idc: 0x20, maxFrame: 5_120, maxRate: 216_000, maxBitrate: 20_000_000 },
    { idc: 0x28, maxFrame: 8_192, maxRate: 245_760, maxBitrate: 20_000_000 },
    { idc: 0x29, maxFrame: 8_192, maxRate: 245_760, maxBitrate: 50_000_000 },
    { idc: 0x2a, maxFrame: 8_704, maxRate: 522_240, maxBitrate: 50_000_000 },
    { idc: 0x32, maxFrame: 22_080, maxRate: 589_824, maxBitrate: 135_000_000 },
    { idc: 0x33, maxFrame: 36_864, maxRate: 983_040, maxBitrate: 240_000_000 },
    { idc: 0x34, maxFrame: 36_864, maxRate: 2_073_600, maxBitrate: 240_000_000 },
  ];
  const level = levels.find((candidate) => (
    macroblocksPerFrame <= candidate.maxFrame
    && macroblocksPerSecond <= candidate.maxRate
    && bitrate <= candidate.maxBitrate
  )) ?? levels[levels.length - 1];
  return `avc1.4200${level.idc.toString(16).padStart(2, "0")}`;
}

export function createVideoWebCodecsAudioEncoderConfig(
  task: Extract<VideoTask, { kind: "encode" }>,
  sourceSampleRate: number,
  sourceChannels: number,
  normalizeForConcat: boolean,
): AudioEncoderConfig {
  return {
    codec: "mp4a.40.2",
    sampleRate: normalizeForConcat
      ? 48_000
      : resolveAudioSampleRate(task.audioSampleRate, "aac") === "source"
        ? sourceSampleRate
        : resolveAudioSampleRate(task.audioSampleRate, "aac") as number,
    numberOfChannels: normalizeForConcat ? 2 : sourceChannels,
    bitrate: parseAudioBitrate(task.audioBitrate),
  };
}

export function resolveVideoWebCodecsFrameRate(
  job: { mode: "individual" | "concat"; inputs: readonly Pick<VideoWorkerInput, "frameRate">[] },
  measuredFrameRates: readonly number[] = [],
) {
  if (job.mode === "concat") {
    if (job.inputs.some((input) => !validFrameRate(input.frameRate))) return undefined;
    return Math.max(...job.inputs.map((input) => input.frameRate!));
  }
  const declared = job.inputs[0]?.frameRate;
  if (validFrameRate(declared)) return declared;
  const measured = measuredFrameRates.find(validFrameRate);
  return measured;
}

export function resolveVideoWebCodecsBaseDimensions(
  job: { mode: "individual" | "concat"; inputs: readonly Pick<VideoWorkerInput, "width" | "height">[] },
  task: Extract<VideoTask, { kind: "encode" }>,
) {
  const first = job.inputs[0];
  if (!first) return undefined;
  if (job.mode === "individual" && task.aspect === "source" && task.resolution === "source") {
    return [first.width, first.height] as const;
  }
  return outputDimensionsForSource(first.width, first.height, task.aspect, task.resolution);
}

export function resolveVideoWebCodecsOutputDimensions(
  baseDimensions: readonly [number, number],
  rotation: 0 | 90 | 180 | 270,
) {
  return rotation === 90 || rotation === 270
    ? [baseDimensions[1], baseDimensions[0]] as const
    : [baseDimensions[0], baseDimensions[1]] as const;
}

export function resolveVideoFrameTransformLayout(
  input: Pick<VideoWorkerInput, "width" | "height">,
  task: Extract<VideoTask, { kind: "encode" }>,
  baseDimensions: readonly [number, number],
  normalizeForConcat: boolean,
): VideoFrameTransformLayout {
  const [baseWidth, baseHeight] = baseDimensions;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = input.width;
  let sourceHeight = input.height;
  let destinationX = 0;
  let destinationY = 0;
  let destinationWidth = baseWidth;
  let destinationHeight = baseHeight;

  if (task.aspect !== "source") {
    const targetRatio = baseWidth / baseHeight;
    const sourceRatio = input.width / input.height;
    if (sourceRatio > targetRatio) {
      sourceWidth = input.height * targetRatio;
      sourceX = (input.width - sourceWidth) / 2;
    } else if (sourceRatio < targetRatio) {
      sourceHeight = input.width / targetRatio;
      sourceY = (input.height - sourceHeight) / 2;
    }
  } else if (normalizeForConcat) {
    const scale = Math.min(baseWidth / input.width, baseHeight / input.height);
    destinationWidth = input.width * scale;
    destinationHeight = input.height * scale;
    destinationX = (baseWidth - destinationWidth) / 2;
    destinationY = (baseHeight - destinationHeight) / 2;
  }

  const [outputWidth, outputHeight] = resolveVideoWebCodecsOutputDimensions(baseDimensions, task.rotation);
  return {
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    destinationX,
    destinationY,
    destinationWidth,
    destinationHeight,
    baseWidth,
    baseHeight,
    outputWidth,
    outputHeight,
  };
}

export function parsedVideoTrackFrameRate(samples: readonly { duration: number; timescale: number }[]) {
  const durations = samples
    .map((sample) => sample.timescale > 0 ? sample.duration / sample.timescale : 0)
    .filter((duration) => Number.isFinite(duration) && duration > 0);
  if (!durations.length) return undefined;
  durations.sort((left, right) => left - right);
  const medianDuration = durations[Math.floor(durations.length / 2)];
  const rate = 1 / medianDuration;
  return validFrameRate(rate) ? rate : undefined;
}

export function validFrameRate(value: number | undefined): value is number {
  return Number.isFinite(value) && (value ?? 0) > 0 && (value ?? 0) <= 240;
}

function browserWebCodecsSupportApi(): VideoWebCodecsSupportApi {
  return {
    offscreenCanvasAvailable: typeof OffscreenCanvas !== "undefined",
    videoDecoder: typeof VideoDecoder === "undefined" ? undefined : VideoDecoder,
    videoEncoder: typeof VideoEncoder === "undefined" ? undefined : VideoEncoder,
    audioDecoder: typeof AudioDecoder === "undefined" ? undefined : AudioDecoder,
    audioEncoder: typeof AudioEncoder === "undefined" ? undefined : AudioEncoder,
  };
}

async function everyConfigSupported<Config, Support extends { supported?: boolean }>(
  configs: readonly Config[],
  constructor: WebCodecsSupportConstructor<Config, Support>,
) {
  for (const config of configs) if (!await configSupported(config, constructor)) return false;
  return true;
}

async function configSupported<Config, Support extends { supported?: boolean }>(
  config: Config,
  constructor: WebCodecsSupportConstructor<Config, Support>,
) {
  try {
    return (await constructor.isConfigSupported(config)).supported === true;
  } catch {
    return false;
  }
}

function unsupported(reasonCode: VideoWebCodecsReasonCode): VideoWebCodecsProbeResult {
  return reasonCode === "READY" || reasonCode === "INPUT_UNSUPPORTED"
    ? { compatible: false, reasonCode }
    : { compatible: false, reasonCode, cause: capabilityProbeCause(reasonCode) };
}

function parseVideoBitrate(value: string) {
  const match = /^(\d+(?:\.\d+)?)M$/i.exec(value);
  if (!match) throw new Error("Invalid target video bitrate");
  return Math.round(Number(match[1]) * 1_000_000);
}

function parseAudioBitrate(value: string) {
  const match = /^(\d+)k$/i.exec(value);
  if (!match) throw new Error("Invalid target audio bitrate");
  return Number(match[1]) * 1_000;
}
