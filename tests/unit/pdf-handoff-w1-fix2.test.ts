import assert from "node:assert/strict";
import test from "node:test";

import { isDevTestEnvironment } from "../../src/app/toolState.ts";
import {
  MAX_PDF_DISPLAY_EPOCHS,
  createDisplayEpochCounter,
  isWorkerSetupFailure,
  pdfDisplayEpoch,
} from "../../src/features/pdf-editor/pdfDisplayEpoch.ts";

test("display epoch: fresh counter serves the base URL with no suffix", () => {
  const counter = createDisplayEpochCounter();
  assert.equal(counter.peek(), 0);
  assert.equal(counter.url("https://x/assets/pdf-CCjkBPdx.mjs"), "https://x/assets/pdf-CCjkBPdx.mjs");
});

test("display epoch: resets mint epoch-suffixed URLs up to the cap, then refuse", () => {
  const counter = createDisplayEpochCounter(3);
  assert.equal(counter.reset(), true);
  assert.equal(counter.peek(), 1);
  assert.equal(counter.url("https://x/assets/pdf.mjs"), "https://x/assets/pdf.mjs?w1-pdfjs=1");
  assert.equal(counter.url("https://x/assets/a.mjs?v=2"), "https://x/assets/a.mjs?v=2&w1-pdfjs=1");
  assert.equal(counter.reset(), true);
  assert.equal(counter.reset(), true);
  assert.equal(counter.peek(), 3);
  assert.equal(counter.reset(), false);
  assert.equal(counter.reset(), false);
  assert.equal(counter.peek(), 3);
});

test("display epoch: counters are independent (no shared global in tests)", () => {
  const first = createDisplayEpochCounter(1);
  const second = createDisplayEpochCounter(1);
  assert.equal(first.reset(), true);
  assert.equal(first.reset(), false);
  assert.equal(second.reset(), true);
});

test("display epoch: production singleton honors the shipped cap", () => {
  assert.equal(MAX_PDF_DISPLAY_EPOCHS, 8);
  assert.equal(typeof pdfDisplayEpoch.peek(), "number");
  assert.equal(typeof pdfDisplayEpoch.reset(), "boolean");
});

test("worker-setup classification: runtime failures reset, content failures do not", () => {
  const displayLoad = new Error("Files needed");
  (displayLoad as { code?: string }).code = "pdf-display-load";
  assert.equal(isWorkerSetupFailure(displayLoad), true);
  assert.equal(isWorkerSetupFailure(new Error('Setting up fake worker failed: "oops"')), true);
  assert.equal(
    isWorkerSetupFailure(new Error("Failed to fetch dynamically imported module: http://x/pdf.worker.min.mjs")),
    true,
  );
  const password = new Error("This PDF is password protected. Try again with the password.");
  assert.equal(isWorkerSetupFailure(password), false);
  assert.equal(isWorkerSetupFailure(new Error("Invalid PDF structure")), false);
  assert.equal(isWorkerSetupFailure(new DOMException("PDF loading cancelled", "AbortError")), false);
  assert.equal(isWorkerSetupFailure(null), false);
  assert.equal(isWorkerSetupFailure(undefined), false);
  assert.equal(isWorkerSetupFailure("Setting up fake worker failed"), false);
});

test("isDevTestEnvironment honors NODE_ENV in plain node", () => {
  const previous = process.env.NODE_ENV;
  try {
    delete process.env.NODE_ENV;
    assert.equal(isDevTestEnvironment(), true);
    process.env.NODE_ENV = "production";
    assert.equal(isDevTestEnvironment(), false);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
