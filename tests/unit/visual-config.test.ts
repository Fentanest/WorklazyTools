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
    "click",
    "click-option",
    "scroll-bottom",
    "scroll-into-view",
    "replace-text",
    "select",
    "select-index",
    "upload",
    "wait",
    "wait-enabled",
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
  assert.equal(names.length, 155);
  assert.equal(qaCaptureScenarios.length, 62);
  assert.equal(qaCaptureScenarios.flatMap(({ profiles }) => profiles).length, 484);
  const b1QaScenarios = qaCaptureScenarios.filter(({ toolId }) => [
    "text-formatter", "work-calculator", "payroll-calculator", "security-tools", "image-privacy", "text-tools",
  ].includes(toolId));
  assert.equal(b1QaScenarios.length, 18);
  assert.equal(b1QaScenarios.flatMap(({ profiles }) => profiles).length, 144);
  assert.deepEqual(new Set(b1QaScenarios.map(({ stateType }) => stateType)), new Set(["initial", "bottom", "interaction"]));
  assert.ok(b1QaScenarios.every(({ profiles }) => profiles.length === 8));
  const b2QaScenarios = qaCaptureScenarios.filter(({ toolId }) => [
    "data-converter", "timezone-calculator", "text-merger", "hwp-editor", "office-editor",
  ].includes(toolId));
  assert.equal(b2QaScenarios.length, 15);
  assert.equal(b2QaScenarios.flatMap(({ profiles }) => profiles).length, 108);
  assert.deepEqual(new Set(b2QaScenarios.map(({ stateType }) => stateType)), new Set(["initial", "bottom", "interaction"]));
  assert.equal(visualRegressionConfig.scenarios, visualRegressionScenarios);
  assert.equal(visualRegressionConfig.environment.maxCapturesPerBrowser, 12);
  assert.equal(visualRegressionConfig.environment.settleTimeMs, 200);
  assert.equal(visualRegressionConfig.environment.timezone, "UTC");
  assert.equal(visualRegressionConfig.viewports.every(({ deviceScaleFactor }) => deviceScaleFactor === 1), true);
});
