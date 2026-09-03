export const DOLBY_VISION_BASE_LAYER_COMPAT_IDS = [1, 2, 4] as const;

export type DolbyVisionBaseLayerCompatId = typeof DOLBY_VISION_BASE_LAYER_COMPAT_IDS[number];

export type VideoDolbyVisionReasonCode =
  | "DOLBY_VISION_CONFIGURATION_UNAVAILABLE"
  | "DOLBY_VISION_CONFIGURATION_AMBIGUOUS"
  | "DOLBY_VISION_VERSION_UNSUPPORTED"
  | "DOLBY_VISION_PROFILE_UNSUPPORTED"
  | "DOLBY_VISION_BASE_LAYER_UNAVAILABLE"
  | "DOLBY_VISION_COMPATIBILITY_UNSUPPORTED";

export interface DolbyVisionConfiguration {
  majorVersion: number;
  minorVersion: number;
  profile: number;
  level: number;
  rpuPresent: boolean;
  enhancementLayerPresent: boolean;
  baseLayerPresent: boolean;
  compatibilityId: number;
}

export type DolbyVisionBaseLayerAssessment =
  | {
      compatible: true;
      compatibilityId: DolbyVisionBaseLayerCompatId;
      decoderCodec: string;
      configuration: DolbyVisionConfiguration;
    }
  | {
      compatible: false;
      reasonCode: VideoDolbyVisionReasonCode | "VIDEO_CONFIGURATION_UNAVAILABLE";
      configuration?: DolbyVisionConfiguration;
    };

export function parseDolbyVisionConfiguration(bytes: Uint8Array): DolbyVisionConfiguration | undefined {
  if (bytes.byteLength < 5) return undefined;
  return {
    majorVersion: bytes[0],
    minorVersion: bytes[1],
    profile: bytes[2] >>> 1,
    level: ((bytes[2] & 1) << 5) | (bytes[3] >>> 3),
    rpuPresent: Boolean(bytes[3] & 0b100),
    enhancementLayerPresent: Boolean(bytes[3] & 0b010),
    baseLayerPresent: Boolean(bytes[3] & 0b001),
    compatibilityId: bytes[4] >>> 4,
  };
}

export function assessDolbyVisionBaseLayer({
  dvcC,
  dvvC,
  hevcConfiguration,
}: {
  dvcC?: Uint8Array;
  dvvC?: Uint8Array;
  hevcConfiguration?: Uint8Array;
}): DolbyVisionBaseLayerAssessment {
  if (dvcC && dvvC) return { compatible: false, reasonCode: "DOLBY_VISION_CONFIGURATION_AMBIGUOUS" };
  const bytes = dvcC ?? dvvC;
  if (!bytes) return { compatible: false, reasonCode: "DOLBY_VISION_CONFIGURATION_UNAVAILABLE" };
  const configuration = parseDolbyVisionConfiguration(bytes);
  if (!configuration) return { compatible: false, reasonCode: "DOLBY_VISION_CONFIGURATION_UNAVAILABLE" };
  if (configuration.majorVersion !== 1 || configuration.minorVersion !== 0) {
    return { compatible: false, reasonCode: "DOLBY_VISION_VERSION_UNSUPPORTED", configuration };
  }
  if (configuration.profile !== 8) {
    return { compatible: false, reasonCode: "DOLBY_VISION_PROFILE_UNSUPPORTED", configuration };
  }
  if (!configuration.baseLayerPresent) {
    return { compatible: false, reasonCode: "DOLBY_VISION_BASE_LAYER_UNAVAILABLE", configuration };
  }
  if (!isDolbyVisionBaseLayerCompatId(configuration.compatibilityId)) {
    return { compatible: false, reasonCode: "DOLBY_VISION_COMPATIBILITY_UNSUPPORTED", configuration };
  }
  const decoderCodec = hevcConfiguration ? createHevcCodecString(hevcConfiguration) : undefined;
  if (!decoderCodec) return { compatible: false, reasonCode: "VIDEO_CONFIGURATION_UNAVAILABLE", configuration };
  return {
    compatible: true,
    compatibilityId: configuration.compatibilityId,
    decoderCodec,
    configuration,
  };
}

export function createHevcCodecString(configuration: Uint8Array) {
  if (configuration.byteLength < 13 || configuration[0] !== 1) return undefined;
  const profileSpace = ["", "A", "B", "C"][configuration[1] >>> 6];
  const tier = configuration[1] & 0x20 ? "H" : "L";
  const profile = configuration[1] & 0x1f;
  const compatibility = reverseBits32(readUint32(configuration, 2)).toString(16).toUpperCase();
  const level = configuration[12];
  const constraints = Array.from(configuration.subarray(6, 12));
  while (constraints.at(-1) === 0) constraints.pop();
  const constraintString = constraints.map((value) => `.${value.toString(16).toUpperCase()}`).join("");
  return `hvc1.${profileSpace}${profile}.${compatibility}.${tier}${level}${constraintString}`;
}

export function collectDolbyVisionBaseLayers(compatibilityIds: readonly (number | undefined)[]) {
  const compatIds = [...new Set(compatibilityIds.filter(isDolbyVisionBaseLayerCompatId))].sort((left, right) => left - right);
  return compatIds.length ? { compatIds } : undefined;
}

export function dolbyVisionBaseLayerGuidance(compatibilityIds: readonly number[]) {
  if (compatibilityIds.length !== 1) return "mixed" as const;
  if (compatibilityIds[0] === 1) return "hdr10" as const;
  if (compatibilityIds[0] === 2) return "sdr" as const;
  if (compatibilityIds[0] === 4) return "hlg" as const;
  return "mixed" as const;
}

function isDolbyVisionBaseLayerCompatId(value: number | undefined): value is DolbyVisionBaseLayerCompatId {
  return typeof value === "number" && (DOLBY_VISION_BASE_LAYER_COMPAT_IDS as readonly number[]).includes(value);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] * 0x1000000
    + bytes[offset + 1] * 0x10000
    + bytes[offset + 2] * 0x100
    + bytes[offset + 3]
  ) >>> 0;
}

function reverseBits32(value: number) {
  let input = value >>> 0;
  let reversed = 0;
  for (let index = 0; index < 32; index += 1) {
    reversed = ((reversed << 1) | (input & 1)) >>> 0;
    input >>>= 1;
  }
  return reversed >>> 0;
}
