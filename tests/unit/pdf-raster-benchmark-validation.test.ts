import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCompleteRawBenchmark,
  batchFiles,
  createLegacyStoredHeapPeak,
  createStoredHeapPeak,
  dpis,
  environmentIds,
  fixtureTypes,
  formats,
  pageCounts,
  summarizeCell,
} from "../pdf-raster-benchmark-validation.mjs";

const stages = ["load", "render", "encode", "embed", "save", "retain", "release"];

function samples() {
  return stages.map((name, index) => {
    const usedSize = index === 1 ? 200 : 100 + index;
    const backingStorageSize = index === 0 ? 1_000 : 10 + index;
    return {
      atMs: index + 1,
      boundary: { name },
      byTarget: {
        main: { usedSize: usedSize - 10, backingStorageSize: backingStorageSize - 5 },
        "worker-1": { usedSize: 10, backingStorageSize: 5 },
      },
      usedSize,
      backingStorageSize,
    };
  });
}

function run(finalPdfBytes = 100, batch = false) {
  const heapSamples = samples();
  return {
    finalPdfBytes,
    metrics: { totalMs: 10, peakRawRgbaBytes: 40, intermediateImageBytes: 20, cumulativePixels: 10 },
    hostWallMs: 12,
    heap: { peak: createLegacyStoredHeapPeak(heapSamples), samples: heapSamples },
    ...(batch ? {
      outputs: [
        { type: "blank", finalPdfBytes: 10 },
        { type: "text-vector", finalPdfBytes: 20 },
        { type: "photo-scan", finalPdfBytes: 30 },
      ],
      retainedBytes: 60,
    } : {}),
  };
}

function rawBenchmark() {
  const cells = [];
  for (const fixtureType of fixtureTypes) for (const pageCount of pageCounts) for (const dpi of dpis) for (const format of formats) for (const environment of environmentIds) {
    const finalPdfBytes = format === "png" ? 200 : 100;
    cells.push({
      fixtureType,
      pageCount,
      dpi,
      format,
      environment,
      warmup: run(finalPdfBytes),
      records: [run(finalPdfBytes), run(finalPdfBytes), run(finalPdfBytes)],
    });
  }
  const batches = environmentIds.map((environment) => ({
    environment,
    dpi: 150,
    format: "jpeg",
    files: [...batchFiles],
    warmup: run(60, true),
    records: [run(60, true), run(60, true), run(60, true)],
  }));
  return { schemaVersion: 1, warmupRuns: 1, recordedRuns: 3, cells, batches };
}

test("raster benchmark recomputes independent heap maxima from target-summed raw samples", () => {
  const raw = rawBenchmark();
  assert.doesNotThrow(() => assertCompleteRawBenchmark(raw));
  const summary = summarizeCell(raw.cells[0]);
  assert.equal(raw.cells[0].records[0].heap.peak.backingStorageSize, 16);
  assert.equal(summary.peakHeapUsedSizeMax, 200);
  assert.equal(summary.peakHeapBackingStorageSizeMax, 1_000);
  assert.equal(summary.peakHeapUsedSizeEvidence.sampleIndex, 1);
  assert.equal(summary.peakHeapBackingStorageSizeEvidence.sampleIndex, 0);

  const schema2 = structuredClone(raw);
  schema2.schemaVersion = 2;
  for (const entry of [...schema2.cells, ...schema2.batches]) {
    for (const record of [entry.warmup, ...entry.records]) record.heap.peak = createStoredHeapPeak(record.heap.samples);
  }
  assert.doesNotThrow(() => assertCompleteRawBenchmark(schema2));
});

test("raster benchmark gate rejects forged peaks, duplicated environments, and truncated batch outputs", () => {
  const cases = [
    {
      name: "forged-zero-peaks",
      mutate(raw) {
        for (const entry of [...raw.cells, ...raw.batches]) for (const record of [entry.warmup, ...entry.records]) {
          record.heap.peak.usedSize = 0;
          record.heap.peak.backingStorageSize = 0;
        }
      },
      message: /stored peak does not match/u,
    },
    {
      name: "missing-mobile-batch-duplicated-desktop",
      mutate(raw) { raw.batches[1] = structuredClone(raw.batches[0]); },
      message: /batch environments/u,
    },
    {
      name: "batch-with-only-two-outputs",
      mutate(raw) {
        for (const batch of raw.batches) for (const record of [batch.warmup, ...batch.records]) record.outputs.pop();
      },
      message: /exactly three outputs/u,
    },
  ];
  for (const current of cases) {
    const raw = rawBenchmark();
    current.mutate(raw);
    assert.throws(() => assertCompleteRawBenchmark(raw), current.message, current.name);
  }
});

test("raster benchmark gate preserves worker, stage, and target-sum negative checks", () => {
  const missingWorker = rawBenchmark();
  for (const sample of missingWorker.cells[0].records[0].heap.samples) delete sample.byTarget["worker-1"];
  assert.throws(() => assertCompleteRawBenchmark(missingWorker), /must equal the sum|worker heap sample/u);

  const missingStage = rawBenchmark();
  missingStage.cells[0].records[0].heap.samples = missingStage.cells[0].records[0].heap.samples.filter(({ boundary }) => boundary.name !== "render");
  missingStage.cells[0].records[0].heap.peak = createLegacyStoredHeapPeak(missingStage.cells[0].records[0].heap.samples);
  assert.throws(() => assertCompleteRawBenchmark(missingStage), /seven boundary samples/u);
});
