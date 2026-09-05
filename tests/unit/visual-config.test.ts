import assert from "node:assert/strict";
import test from "node:test";

import { availableToolRoutes } from "../tool-registry-routes.mjs";
import { visualRegressionConfig } from "../visual-regression.config.mjs";
import {
  interactionCoveredToolIds,
  interactionNotApplicableReasons,
  qaCaptureScenarios,
  visualRegressionScenarios,
} from "../visual-regression.scenarios.mjs";

test("visual regression scenario manifest covers every available tool and state contract", () => {
  assert.equal(availableToolRoutes.length, 20);
  const availableToolIds = new Set(availableToolRoutes.map(({ toolId }) => toolId));
  assert.equal(availableToolIds.size, 20);

  const requiredFields = [
    "scenarioId",
    "routeId",
    "stateId",
    "profiles",
    "profileReductionReason",
    "fixture",
    "actions",
    "readySelector",
    "assertSelector",
    "bottomTargetSelector",
    "localeNotApplicableReason",
  ];
  const supportedActionTypes = new Set([
    "assert-path",
    "assert-scroll-overflow",
    "assert-truncated",
    "click",
    "click-option",
    "scroll-bottom",
    "scroll-into-view",
    "scan-canvas-qr",
    "replace-text",
    "select",
    "select-index",
    "upload",
    "wait",
    "wait-enabled",
    "wait-canvas",
    "wait-value-includes",
    "wait-shadow-canvas",
  ]);
  for (const scenario of visualRegressionScenarios) {
    for (const field of requiredFields) assert.ok(Object.hasOwn(scenario, field), `${scenario.scenarioId} is missing ${field}`);
    assert.ok(scenario.profiles.length > 0, `${scenario.scenarioId} has no profiles`);
    assert.ok(scenario.profileReductionReason, `${scenario.scenarioId} has no profile reduction reason`);
    assert.ok(Array.isArray(scenario.actions), `${scenario.scenarioId} actions must be an array`);
    assert.ok(scenario.actions.every(({ type }) => supportedActionTypes.has(type)), `${scenario.scenarioId} uses an unsupported action`);
  }

  const toolScenarios = visualRegressionScenarios.filter(({ kind }) => kind === "tool");
  const initialToolIds = new Set(toolScenarios.filter(({ stateType }) => stateType === "initial").map(({ toolId }) => toolId));
  const bottomScenarios = toolScenarios.filter(({ stateType }) => stateType === "bottom");
  const bottomToolIds = new Set(bottomScenarios.map(({ toolId }) => toolId));
  assert.deepEqual(initialToolIds, availableToolIds);
  assert.deepEqual(bottomToolIds, availableToolIds);
  assert.equal(bottomScenarios.length, 20);
  assert.ok(bottomScenarios.every(({ profiles }) => profiles.every(({ viewport }) => viewport === "mobile")));
  assert.ok(bottomScenarios.every(({ bottomTargetSelector }) => Boolean(bottomTargetSelector)));

  const interactionToolIds = new Set(toolScenarios.filter(({ stateType }) => stateType === "interaction").map(({ toolId }) => toolId));
  assert.deepEqual(interactionToolIds, new Set(interactionCoveredToolIds));
  assert.deepEqual(
    new Set([...interactionToolIds, ...Object.keys(interactionNotApplicableReasons)]),
    availableToolIds,
  );

  const hwpBottom = bottomScenarios.find(({ toolId }) => toolId === "hwp-editor");
  assert.deepEqual(new Set(hwpBottom?.profiles.map(({ locale }) => locale)), new Set(["ko"]));
  assert.ok(hwpBottom?.localeNotApplicableReason);
  const hwpRedirect = visualRegressionScenarios.find(({ stateType, toolId }) => stateType === "redirect" && toolId === "hwp-editor");
  assert.deepEqual(new Set(hwpRedirect?.profiles.map(({ locale }) => locale)), new Set(["en"]));
  assert.ok(hwpRedirect?.actions.some(({ type }) => type === "assert-path"));

  const names = visualRegressionScenarios.flatMap((scenario) => scenario.profiles.map((profile) => (
    `${scenario.routeId}__${scenario.stateId}__${profile.locale}__${profile.theme}__${profile.viewport}.png`
  )));
  assert.equal(new Set(names).size, names.length, "stateId must prevent scenario captures from overwriting each other");
  assert.equal(names.length, 172);
  assert.equal(qaCaptureScenarios.length, 79);
  assert.equal(qaCaptureScenarios.flatMap(({ profiles }) => profiles).length, 620);
  const b1QaScenarios = qaCaptureScenarios.filter(({ toolId }) => [
    "text-formatter", "work-calculator", "payroll-calculator", "security-tools", "image-privacy", "text-tools",
  ].includes(toolId));
  assert.equal(b1QaScenarios.length, 18);
  assert.equal(b1QaScenarios.flatMap(({ profiles }) => profiles).length, 144);
  assert.deepEqual(new Set(b1QaScenarios.map(({ stateType }) => stateType)), new Set(["initial", "bottom", "interaction"]));
  const b6QaScenarios = qaCaptureScenarios.filter(({ toolId }) => toolId === "image-studio");
  assert.equal(b6QaScenarios.length, 8);
  assert.equal(b6QaScenarios.flatMap(({ profiles }) => profiles).length, 64);
  assert.deepEqual(new Set(b6QaScenarios.map(({ stateId }) => stateId)), new Set([
    "initial",
    "bottom",
    "interaction-canvas-loaded",
    "interaction-size-panel",
    "interaction-layers-panel",
    "interaction-batch-mode",
    "interaction-collage-mode",
    "interaction-gif-mode",
  ]));
  assert.ok(b1QaScenarios.every(({ profiles }) => profiles.length === 8));
  const b2QaScenarios = qaCaptureScenarios.filter(({ toolId }) => [
    "data-converter", "timezone-calculator", "text-merger", "hwp-editor", "office-editor",
  ].includes(toolId));
  assert.equal(b2QaScenarios.length, 15);
  assert.equal(b2QaScenarios.flatMap(({ profiles }) => profiles).length, 108);
  assert.deepEqual(new Set(b2QaScenarios.map(({ stateType }) => stateType)), new Set(["initial", "bottom", "interaction"]));
  const b3QaScenarios = qaCaptureScenarios.filter(({ toolId }) => ["document-compare", "excel-cleaner"].includes(toolId));
  assert.equal(b3QaScenarios.length, 10);
  assert.equal(b3QaScenarios.flatMap(({ profiles }) => profiles).length, 80);
  assert.deepEqual(new Set(b3QaScenarios.map(({ stateType }) => stateType)), new Set(["initial", "bottom", "interaction"]));
  assert.deepEqual(new Set(b3QaScenarios.filter(({ stateType }) => stateType === "interaction").map(({ stateId }) => stateId)), new Set([
    "interaction-toggle-on", "interaction-toggle-off", "interaction-docx-result", "interaction-hwp-result",
    "interaction-rule", "interaction-result",
  ]));
  const b4QaScenarios = qaCaptureScenarios.filter(({ toolId }) => ["excel-merger", "excel-compare", "qr-studio"].includes(toolId));
  assert.equal(b4QaScenarios.length, 12);
  assert.equal(b4QaScenarios.flatMap(({ profiles }) => profiles).length, 96);
  assert.deepEqual(Object.fromEntries(["initial", "bottom", "interaction"].map((stateType) => [
    stateType,
    b4QaScenarios.filter((scenario) => scenario.stateType === stateType).flatMap(({ profiles }) => profiles).length,
  ])), { initial: 24, bottom: 24, interaction: 48 });
  assert.deepEqual(new Set(b4QaScenarios.filter(({ stateType }) => stateType === "interaction").map(({ stateId }) => stateId)), new Set([
    "interaction-sheet-selection", "interaction-key-mode", "interaction-pair",
    "interaction-bulk-mode", "interaction-create", "interaction-scan",
  ]));
  const b5aQaScenarios = qaCaptureScenarios.filter(({ toolId }) => ["audio-studio", "pdf-editor"].includes(toolId));
  assert.equal(b5aQaScenarios.length, 10);
  assert.equal(b5aQaScenarios.flatMap(({ profiles }) => profiles).length, 80);
  assert.deepEqual(Object.fromEntries(["initial", "bottom", "interaction"].map((stateType) => [
    stateType,
    b5aQaScenarios.filter((scenario) => scenario.stateType === stateType).flatMap(({ profiles }) => profiles).length,
  ])), { initial: 16, bottom: 16, interaction: 48 });
  assert.deepEqual(new Set(b5aQaScenarios.filter(({ stateType }) => stateType === "interaction").map(({ stateId }) => stateId)), new Set([
    "interaction-waveform", "interaction-effect-robot", "interaction-organize-thumbnails",
    "interaction-image-to-pdf-thumbnails", "interaction-pdf-to-image-thumbnails", "interaction-convert-thumbnails",
  ]));
  const b5bQaScenarios = qaCaptureScenarios.filter(({ toolId }) => toolId === "video-studio");
  assert.equal(b5bQaScenarios.length, 4);
  assert.equal(b5bQaScenarios.flatMap(({ profiles }) => profiles).length, 32);
  assert.deepEqual(Object.fromEntries(["initial", "bottom", "interaction"].map((stateType) => [
    stateType,
    b5bQaScenarios.filter((scenario) => scenario.stateType === stateType).flatMap(({ profiles }) => profiles).length,
  ])), { initial: 8, bottom: 8, interaction: 16 });
  assert.deepEqual(new Set(b5bQaScenarios.filter(({ stateType }) => stateType === "interaction").map(({ stateId }) => stateId)), new Set([
    "interaction-group-editing", "interaction-trim-range",
  ]));
  assert.equal(visualRegressionConfig.scenarios, visualRegressionScenarios);
  assert.equal(visualRegressionConfig.environment.maxCapturesPerBrowser, 12);
  assert.equal(visualRegressionConfig.environment.settleTimeMs, 200);
  assert.equal(visualRegressionConfig.environment.timezone, "UTC");
  assert.equal(visualRegressionConfig.viewports.every(({ deviceScaleFactor }) => deviceScaleFactor === 1), true);
});
