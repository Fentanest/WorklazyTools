import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pdfOrganizeDirty } from "../../src/features/pdf-editor/pdfOrganizeDirect.ts";
import { pdfConvertDirty } from "../../src/features/pdf-editor/pdfConvertDirect.ts";
import { imageDirectDirty } from "../../src/features/image-studio/imageDirect.ts";
import { audioDirectDirty } from "../../src/features/audio-studio/audioDirect.ts";
import { videoDirectDirty } from "../../src/features/video-studio/videoDirect.ts";
import { directEntryRouteKey, restoreDirectEntryLocation } from "../../src/utils/directEntryLocation.ts";
import { isVideoDirectPath, videoParentAssetUrl } from "../../src/features/video-studio/videoDirectPaths.ts";

test("route keys ignore only language/trailing slash; reject retains prior search/hash in current language", () => {
  assert.equal(directEntryRouteKey("/ko/tools/pdf-editor/split///"), directEntryRouteKey("/en/tools/pdf-editor/split"));
  assert.notEqual(directEntryRouteKey("/en/tools/pdf-editor/split"), directEntryRouteKey("/en/tools/pdf-editor/merge"));
  assert.equal(restoreDirectEntryLocation({ pathname: "/ko/tools/pdf-editor/split/", search: "?old=1", hash: "#old" }, "en"), "/en/tools/pdf-editor/split/?old=1#old");
});
const cases: Array<[string, (s: any) => boolean, Record<string, unknown>, Record<string, unknown>]> = [
  ["organize", pdfOrganizeDirty, { sources: [], pages: [], inspecting: false, status: "idle", result: null }, { sources: [{}], pages: [{}], inspecting: true, status: "running", result: {} }],
  ["convert", pdfConvertDirty, { file: null, loading: false, status: "idle", result: null }, { file: {}, loading: true, status: "running", result: {} }],
  ["image", imageDirectDirty, { file: null, historyLength: 1, emptyReadyHistoryLength: 1, regionEffectBusy: false, stickerBusy: false, status: "idle", result: null, otherTabHasInput: false, otherTabHasResult: false, otherTabRunning: false }, { file: {}, historyLength: 2, regionEffectBusy: true, stickerBusy: true, status: "running", result: {}, otherTabHasInput: true, otherTabHasResult: true, otherTabRunning: true }],
  ["audio", audioDirectDirty, { document: null, undoHistory: [], redoHistory: [], busy: false, decoding: false, lastResult: "" }, { document: {}, undoHistory: [{}], redoHistory: [{}], busy: true, decoding: true, lastResult: "downloaded" }],
  ["video", videoDirectDirty, { items: [], status: "idle", probing: false, outputs: [] }, { items: [{}], status: "running", probing: true, outputs: [{}] }],
];
for (const [name, dirty, empty, triggers] of cases) {
  test(`${name}: empty/options-only is clean; every independent dirty owner triggers confirmation`, () => {
    assert.equal(dirty(empty), false);
    assert.equal(dirty({ ...empty, format: "user-option", panel: "text" }), false);
    for (const [key, value] of Object.entries(triggers)) assert.equal(dirty({ ...empty, [key]: value }), true, key);
  });
}
test("video family is exact under locales/base; assets stay in localized parent", () => {
  for (const suffix of ["", "/trim", "/merge", "/extract-audio"]) for (const lang of ["ko", "en"]) {
    const path = `/probe/${lang}/tools/video-studio${suffix}/`;
    assert.equal(isVideoDirectPath(path, "/probe/"), true);
    assert.equal(videoParentAssetUrl(path, "/probe/", "https://example.test", "workers/core.js").pathname, `/probe/${lang}/tools/video-studio/workers/core.js`);
  }
  for (const path of ["/ko/tools/video-studio/unknown", "/ko/tools/video-studio/trim/child", "/ko/tools/video-studio2", "/tools/audio-studio"]) assert.equal(isVideoDirectPath(path), false);
});
test("independent fixture fixes fourteen rows, twelve static additions, eleven React additions and no tool ID", () => {
  const rows = JSON.parse(readFileSync(new URL("../fixtures/direct-entry-contract.json", import.meta.url), "utf8"));
  assert.equal(rows.length, 14);
  assert.equal(new Set(rows.map((row: any) => row.path)).size, 14);
  const existing = ["/tools/pdf-editor/convert", "/tools/excel-merger"];
  assert.equal(rows.filter((row: any) => !existing.includes(row.path)).length, 12);
  assert.equal(rows.filter((row: any) => ![...existing, "/tools/pdf-editor/split"].includes(row.path)).length, 11);
  for (const row of rows) { assert.deepEqual(row.locales, ["ko", "en"]); assert.equal(row.canonical, "self"); assert.equal(row.redirectTarget, `/ko${row.path}`); }
});
