import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { targets, assertRenderingResults, installRenderingObservers } from "../rendering-baseline.mjs";

const results = () => targets.map(({ id }) => ({ id, samples: [1, 2, 3].map((run) => ({ run, cls: 0.1 })) }));

test("CLS 0.1 passes; 0.100001 (and 1) fails using the worst run, not median", () => {
  assert.doesNotThrow(() => assertRenderingResults(results()));
  for (const value of [0.100001, 1, NaN, undefined]) {
    const injected = results(); injected[1].samples[2].cls = value;
    assert.throws(() => assertRenderingResults(injected), /CLS|Invalid/);
  }
});

test("rendering registration and all three samples are required", () => {
  assert.deepEqual(targets.map(({ id }) => id), ["home", "document-compare", "pdf-editor"]);
  assert.throws(() => assertRenderingResults(results().slice(1)), /registration/);
  const duplicate = results(); duplicate[1] = duplicate[0];
  assert.throws(() => assertRenderingResults(duplicate), /registration/);
  const incomplete = results(); incomplete[0].samples.pop();
  assert.throws(() => assertRenderingResults(incomplete), /samples/);
});

test("actual browser observer collects element and before/after rects, excluding recent input from CLS", () => {
  const observers = new Map();
  const sandbox = { localStorage: { setItem() {} }, PerformanceObserver: class {
    callback; constructor(callback) { this.callback = callback; }
    observe({ type }) { observers.set(type, this.callback); }
  } };
  vm.runInNewContext(`(${installRenderingObservers.toString()})()`, sandbox);
  const rect = { x: 2, y: 3, width: 100, height: 20, top: 3, right: 102, bottom: 23, left: 2 };
  const source = { node: { tagName: "FOOTER", id: "", className: "global-footer", getAttribute: () => null }, previousRect: rect, currentRect: { ...rect, y: 800, top: 800, bottom: 820 } };
  observers.get("layout-shift")({ getEntries: () => [
    { value: 0.1, startTime: 100, hadRecentInput: false, sources: [source] },
    { value: 1, startTime: 200, hadRecentInput: true, sources: [{ ...source, node: null }] },
  ] });
  const metrics = JSON.parse(JSON.stringify(sandbox.__worklazyRenderingMetrics));
  assert.equal(metrics.cls, 0.1);
  assert.equal(metrics.layoutShifts.length, 2);
  assert.equal(metrics.layoutShifts[0].sources[0].element.className, "global-footer");
  assert.equal(metrics.layoutShifts[0].sources[0].element.tagName, "footer");
  assert.deepEqual(metrics.layoutShifts[0].sources[0].previousRect, rect);
  assert.equal(metrics.layoutShifts[0].sources[0].currentRect.y, 800);
  assert.equal(metrics.layoutShifts[1].sources[0].element, null);
});
