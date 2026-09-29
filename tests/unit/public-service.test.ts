import assert from "node:assert/strict";
import test from "node:test";

import { documentReadiness, isKnownPublicPath, isVideoUnavailablePath, safeAnalyticsPage, VIDEO_STUDIO_PUBLIC } from "../../src/app/publicService.ts";

const noMarkers = { redactor: false, office: false, excel: false };

test("public tools are eligible by readiness, not an old tool-type ad or analytics blacklist", () => {
  for (const route of [
    "/ko/tools/pdf-editor/", "/ko/tools/pdf-compare/", "/ko/tools/document-compare/",
    "/ko/tools/hwp-editor/", "/ko/tools/excel-merger/", "/ko/tools/audio-studio/",
  ]) {
    assert.equal(documentReadiness(route, noMarkers, false), "ready", route);
    assert.ok(safeAnalyticsPage(route), route);
  }
  assert.equal(documentReadiness("/ko/tools/document-redactor/", noMarkers, false), "navigation");
  assert.equal(documentReadiness("/ko/tools/document-redactor/", { ...noMarkers, redactor: true }, false), "ready");
  assert.equal(documentReadiness("/ko/tools/office-editor/app/", noMarkers, false), "navigation");
  assert.equal(documentReadiness("/ko/tools/office-editor/app/", { ...noMarkers, office: true }, false), "isolation-pending");
  assert.equal(documentReadiness("/ko/tools/office-editor/app/", { ...noMarkers, office: true }, true), "isolation-pending");
  assert.equal(documentReadiness("/ko/tools/office-editor/app/", { ...noMarkers, office: true }, true, "", "https://worklazy.net/ko/tools/office-editor/app/coi-serviceworker.js"), "ready");
  assert.equal(documentReadiness("/ko/tools/office-editor/app/", { ...noMarkers, office: true }, true, "", "https://worklazy.net/service-worker.js"), "ready");
  assert.equal(documentReadiness("/ko/tools/excel-merger/xls-preserve/", { ...noMarkers, excel: true }, true, "", "https://worklazy.net/ko/tools/excel-merger/xls-preserve/coi-serviceworker.js"), "ready");
  assert.equal(documentReadiness("/ko/tools/excel-merger/xls-preserve/", { ...noMarkers, excel: true }, true, "", "https://worklazy.net/service-worker.js"), "ready");
  assert.equal(documentReadiness("/ko/tools/office-editor/", noMarkers, false), "navigation");
  assert.equal(documentReadiness("/ko/tools/office-editor/", noMarkers, false, "?guide=1"), "ready");
  assert.equal(documentReadiness("/en/tools/hwp-editor/", noMarkers, false), "navigation");
});

test("analytics metadata accepts only known routes and fixed parameters", () => {
  assert.deepEqual(safeAnalyticsPage("/en/tools/pdf-editor/merge/"), {
    path: "/en/tools/pdf-editor/merge/", title: "Worklazy Tools · tools · pdf-editor · merge",
  });
  assert.equal(safeAnalyticsPage("/ko/tools/pdf-editor/", "?file=secret.pdf"), null);
  assert.equal(safeAnalyticsPage("/en/tools/hwp-editor/"), null);
  assert.equal(safeAnalyticsPage("/ko/tools/pdf-editor/", "", "#secret"), null);
  assert.equal(safeAnalyticsPage("/ko/tools/office-editor/", "?guide=1")?.path, "/ko/tools/office-editor/");
  assert.equal(safeAnalyticsPage("/ko/tools/excel-merger/xls-preserve/", "?formula=1&format=0")?.path, "/ko/tools/excel-merger/xls-preserve/");
  assert.equal(safeAnalyticsPage("/ko/tools/excel-merger/xls-preserve/", "?formula=secret"), null);
  assert.equal(safeAnalyticsPage("/ko/tools/document-compare/results/my-file"), null);
  assert.equal(safeAnalyticsPage("/ko/tools/document-compare/results/1/")?.path, "/ko/tools/document-compare/results/");
  assert.equal(safeAnalyticsPage("/ko/error/")?.path, "/ko/error/");
  assert.equal(isKnownPublicPath("/tools/unknown-tool"), false);
});

test("Video Studio and aliases are unpublished without removing implementation source", () => {
  assert.equal(VIDEO_STUDIO_PUBLIC, false);
  for (const route of ["/ko/tools/video-studio/", "/en/tools/video-studio/trim/", "/ko/video-studio/other/"]) {
    assert.equal(isVideoUnavailablePath(route), true);
    assert.equal(documentReadiness(route, noMarkers, false), "unavailable");
    assert.equal(safeAnalyticsPage(route), null);
  }
});
