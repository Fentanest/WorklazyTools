import type { VideoCodec } from "./types";

export type VideoStreamCopyReasonCode =
  | "READY"
  | "NOT_ISO_BMFF"
  | "FRAGMENTED_INPUT"
  | "VIDEO_TRACK_UNAVAILABLE"
  | "VIDEO_CODEC_UNSUPPORTED"
  | "VIDEO_SAMPLE_ENTRY_UNSUPPORTED"
  | "VIDEO_CONFIGURATION_UNAVAILABLE"
  | "AUDIO_CODEC_UNSUPPORTED"
  | "AUDIO_CONFIGURATION_UNAVAILABLE"
  | "EDIT_LIST_UNSUPPORTED"
  | "SAMPLE_TABLE_UNAVAILABLE"
  | "CONCAT_TRACK_MISMATCH";

export interface VideoStreamTrackProfile {
  codecName: string;
  sampleEntry: string;
  configuration: Uint8Array;
  width?: number;
  height?: number;
  channelCount?: number;
  sampleRate?: number;
}

export interface VideoStreamInputProfile {
  codec: Extract<VideoCodec, "h264" | "hevc">;
  video: VideoStreamTrackProfile;
  audio?: VideoStreamTrackProfile;
}

export interface VideoStreamCopyProbeResult {
  compatible: boolean;
  codec?: Extract<VideoCodec, "h264" | "hevc">;
  reasonCode: VideoStreamCopyReasonCode;
}

export interface VideoStreamCopyMetrics {
  inputWholeArrayBufferCalls: number;
  inputSliceArrayBufferCalls: number;
  inputBytesRead: number;
  maxInputSliceBytes: number;
  outputWriteCalls: number;
  outputCumulativeBytesMonotonic: boolean;
  outputLastCumulativeBytes: number;
  maxOutputWriteBytes: number;
  outputFileSize: number;
  segments: Array<{
    requestedStartSeconds: number;
    requestedEndSeconds: number;
    snappedPresentationSeconds: number;
    firstVideoDecodeSeconds: number;
    firstAudioDecodeSeconds?: number;
  }>;
}

export interface VideoStreamSampleInfo {
  number: number;
  offset: number;
  size: number;
  dts: number;
  cts: number;
  duration: number;
  timescale: number;
  isSync: boolean;
}

export interface VideoStreamSampleSelection {
  samples: VideoStreamSampleInfo[];
  snappedPresentationSeconds: number;
  firstDecodeSeconds: number;
  endDecodeSeconds: number;
}

export function compareVideoStreamInputProfiles(profiles: readonly VideoStreamInputProfile[], includeAudio: boolean) {
  const first = profiles[0];
  if (!first) return false;
  return profiles.every((profile) => (
    profile.codec === first.codec
    && equalTrackProfile(profile.video, first.video)
    && (!includeAudio || equalOptionalTrackProfile(profile.audio, first.audio))
  ));
}

export function selectVideoStreamSamples(
  samples: readonly VideoStreamSampleInfo[],
  startSeconds: number,
  endSeconds: number,
  mediaTimeOffsetSeconds: number,
): VideoStreamSampleSelection | undefined {
  let keyframeIndex = -1;
  let keyframePresentation = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (!sample.isSync) continue;
    const presentation = sample.cts / sample.timescale - mediaTimeOffsetSeconds;
    if (presentation <= startSeconds + 1e-9 && presentation >= keyframePresentation) {
      keyframeIndex = index;
      keyframePresentation = presentation;
    }
  }
  if (keyframeIndex < 0) keyframeIndex = samples.findIndex((sample) => sample.isSync);
  if (keyframeIndex < 0) return undefined;

  const keyframe = samples[keyframeIndex];
  const selected = samples.slice(keyframeIndex).filter((sample) => (
    sample.dts / sample.timescale - mediaTimeOffsetSeconds < endSeconds - 1e-9
  ));
  if (!selected.length) return undefined;
  const last = selected[selected.length - 1];
  return {
    samples: selected,
    snappedPresentationSeconds: keyframe.cts / keyframe.timescale - mediaTimeOffsetSeconds,
    firstDecodeSeconds: keyframe.dts / keyframe.timescale - mediaTimeOffsetSeconds,
    endDecodeSeconds: (last.dts + last.duration) / last.timescale - mediaTimeOffsetSeconds,
  };
}

export function selectAudioStreamSamples(
  samples: readonly VideoStreamSampleInfo[],
  startDecodeSeconds: number,
  endSeconds: number,
  mediaTimeOffsetSeconds: number,
) {
  return samples.filter((sample) => {
    const decodeSeconds = sample.dts / sample.timescale - mediaTimeOffsetSeconds;
    return decodeSeconds >= startDecodeSeconds - 1e-9 && decodeSeconds < endSeconds - 1e-9;
  });
}

function equalOptionalTrackProfile(left: VideoStreamTrackProfile | undefined, right: VideoStreamTrackProfile | undefined) {
  if (!left || !right) return left === right;
  return equalTrackProfile(left, right);
}

function equalTrackProfile(left: VideoStreamTrackProfile, right: VideoStreamTrackProfile) {
  return left.codecName === right.codecName
    && left.sampleEntry === right.sampleEntry
    && left.width === right.width
    && left.height === right.height
    && left.channelCount === right.channelCount
    && left.sampleRate === right.sampleRate
    && equalBytes(left.configuration, right.configuration);
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
