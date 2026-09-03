import assert from "node:assert/strict";
import test from "node:test";

import {
  assessDolbyVisionBaseLayer,
  collectDolbyVisionBaseLayers,
  createHevcCodecString,
  dolbyVisionBaseLayerGuidance,
  parseDolbyVisionConfiguration,
} from "../../src/features/video-studio/videoDolbyVision.ts";
import { assessVideoWebCodecsSupport, type VideoWebCodecsSupportApi } from "../../src/features/video-studio/videoWebCodecs.ts";

function doviConfiguration({
  major = 1,
  minor = 0,
  profile = 8,
  level = 9,
  rpu = true,
  enhancementLayer = false,
  baseLayer = true,
  compatibilityId = 1,
} = {}) {
  return Uint8Array.of(
    major,
    minor,
    (profile << 1) | (level >>> 5),
    ((level & 0x1f) << 3) | (rpu ? 4 : 0) | (enhancementLayer ? 2 : 0) | (baseLayer ? 1 : 0),
    compatibilityId << 4,
  );
}

function hevcConfiguration({
  profileSpace = 0,
  profile = 2,
  tierHigh = false,
  compatibility = 0x20000000,
  level = 30,
  constraints = [0x90],
} = {}) {
  const bytes = new Uint8Array(23);
  bytes[0] = 1;
  bytes[1] = (profileSpace << 6) | (tierHigh ? 0x20 : 0) | profile;
  bytes[2] = compatibility >>> 24;
  bytes[3] = compatibility >>> 16;
  bytes[4] = compatibility >>> 8;
  bytes[5] = compatibility;
  bytes.set(constraints, 6);
  bytes[12] = level;
  return bytes;
}

test("Dolby Vision records expose the five-byte policy fields", () => {
  assert.deepEqual(parseDolbyVisionConfiguration(doviConfiguration({
    level: 41,
    enhancementLayer: true,
    compatibilityId: 4,
  })), {
    majorVersion: 1,
    minorVersion: 0,
    profile: 8,
    level: 41,
    rpuPresent: true,
    enhancementLayerPresent: true,
    baseLayerPresent: true,
    compatibilityId: 4,
  });
  assert.equal(parseDolbyVisionConfiguration(Uint8Array.of(1, 0, 16, 0)), undefined);
});

test("Dolby Vision base-layer policy accepts only version 1.0, profile 8, BL, and compat 1/2/4", () => {
  const hevc = hevcConfiguration();
  for (const compatibilityId of [1, 2, 4]) {
    const result = assessDolbyVisionBaseLayer({ dvcC: doviConfiguration({ compatibilityId }), hevcConfiguration: hevc });
    assert.equal(result.compatible, true);
    if (result.compatible) assert.equal(result.compatibilityId, compatibilityId);
  }
  assert.equal(assessDolbyVisionBaseLayer({ dvvC: doviConfiguration({ compatibilityId: 2 }), hevcConfiguration: hevc }).compatible, true);
  const wrongVersion = assessDolbyVisionBaseLayer({ dvcC: doviConfiguration({ major: 2 }), hevcConfiguration: hevc });
  assert.equal(wrongVersion.compatible ? undefined : wrongVersion.reasonCode, "DOLBY_VISION_VERSION_UNSUPPORTED");
  const wrongMinorVersion = assessDolbyVisionBaseLayer({ dvcC: doviConfiguration({ minor: 1 }), hevcConfiguration: hevc });
  assert.equal(wrongMinorVersion.compatible ? undefined : wrongMinorVersion.reasonCode, "DOLBY_VISION_VERSION_UNSUPPORTED");
  const wrongProfile = assessDolbyVisionBaseLayer({ dvcC: doviConfiguration({ profile: 7 }), hevcConfiguration: hevc });
  assert.equal(wrongProfile.compatible ? undefined : wrongProfile.reasonCode, "DOLBY_VISION_PROFILE_UNSUPPORTED");
  const noBaseLayer = assessDolbyVisionBaseLayer({ dvcC: doviConfiguration({ baseLayer: false }), hevcConfiguration: hevc });
  assert.equal(noBaseLayer.compatible ? undefined : noBaseLayer.reasonCode, "DOLBY_VISION_BASE_LAYER_UNAVAILABLE");
  for (const compatibilityId of [0, 3, 15]) {
    const result = assessDolbyVisionBaseLayer({ dvcC: doviConfiguration({ compatibilityId }), hevcConfiguration: hevc });
    assert.deepEqual(result.compatible, false);
    if (!result.compatible) assert.equal(result.reasonCode, "DOLBY_VISION_COMPATIBILITY_UNSUPPORTED");
  }
  const missing = assessDolbyVisionBaseLayer({ hevcConfiguration: hevc });
  assert.equal(missing.compatible ? undefined : missing.reasonCode, "DOLBY_VISION_CONFIGURATION_UNAVAILABLE");
  const short = assessDolbyVisionBaseLayer({ dvcC: Uint8Array.of(1, 0, 16, 0), hevcConfiguration: hevc });
  assert.equal(short.compatible ? undefined : short.reasonCode, "DOLBY_VISION_CONFIGURATION_UNAVAILABLE");
  const missingBaseCodec = assessDolbyVisionBaseLayer({ dvcC: doviConfiguration() });
  assert.equal(missingBaseCodec.compatible ? undefined : missingBaseCodec.reasonCode, "VIDEO_CONFIGURATION_UNAVAILABLE");
  const dual = assessDolbyVisionBaseLayer({ dvcC: doviConfiguration(), dvvC: doviConfiguration(), hevcConfiguration: hevc });
  assert.deepEqual(dual, { compatible: false, reasonCode: "DOLBY_VISION_CONFIGURATION_AMBIGUOUS" });
});

test("Dolby Vision compat IDs propagate once in stable order for single and mixed jobs", () => {
  assert.deepEqual(collectDolbyVisionBaseLayers([2]), { compatIds: [2] });
  assert.deepEqual(collectDolbyVisionBaseLayers([4, undefined, 1, 4, 2]), { compatIds: [1, 2, 4] });
  assert.equal(collectDolbyVisionBaseLayers([undefined, 0, 3]), undefined);
  assert.equal(dolbyVisionBaseLayerGuidance([1]), "hdr10");
  assert.equal(dolbyVisionBaseLayerGuidance([2]), "sdr");
  assert.equal(dolbyVisionBaseLayerGuidance([4]), "hlg");
  assert.equal(dolbyVisionBaseLayerGuidance([1, 4]), "mixed");
});

test("HEVC codec strings reverse compatibility bits as unsigned and retain ordered constraints", () => {
  assert.equal(createHevcCodecString(hevcConfiguration()), "hvc1.2.4.L30.90");
  assert.equal(createHevcCodecString(hevcConfiguration({
    profileSpace: 2,
    profile: 5,
    tierHigh: true,
    compatibility: 0xa0000001,
    level: 123,
    constraints: [0x12, 0x34, 0, 0, 0, 0],
  })), "hvc1.B5.80000005.H123.12.34");
});

test("the derived base-layer decoder configuration still passes the capability gate", async () => {
  const result = assessDolbyVisionBaseLayer({ dvcC: doviConfiguration(), hevcConfiguration: hevcConfiguration() });
  assert.equal(result.compatible, true);
  if (!result.compatible) return;
  const request = {
    videoDecoderConfigs: [{ codec: result.decoderCodec, description: hevcConfiguration().buffer }],
    videoEncoderConfig: { codec: "avc1.42001f", width: 1280, height: 720 },
    audioMode: "remove" as const,
    audioDecoderConfigs: [],
  };
  const supported = async <Config>(config: Config) => ({ config, supported: true });
  const api: VideoWebCodecsSupportApi = {
    offscreenCanvasAvailable: true,
    videoDecoder: { isConfigSupported: supported },
    videoEncoder: { isConfigSupported: supported },
  };
  assert.equal((await assessVideoWebCodecsSupport(request, api)).compatible, true);
  assert.deepEqual(await assessVideoWebCodecsSupport(request, {
    ...api,
    videoDecoder: { isConfigSupported: async (config) => ({ config, supported: false }) },
  }), {
    compatible: false,
    reasonCode: "VIDEO_DECODER_UNSUPPORTED",
    cause: { causeKind: "capability", reasonCode: "VIDEO_DECODER_UNSUPPORTED" },
  });
});
