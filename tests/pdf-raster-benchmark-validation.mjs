import assert from "node:assert/strict";

export const fixtureTypes = Object.freeze(["blank", "text-vector", "photo-scan", "transparency"]);
export const pageCounts = Object.freeze([1, 4, 16]);
export const dpis = Object.freeze([150, 200, 300]);
export const formats = Object.freeze(["png", "jpeg"]);
export const environmentIds = Object.freeze(["desktop", "pixel7-emulation"]);
export const batchFiles = Object.freeze(["blank-4", "text-vector-4", "photo-scan-4"]);

const expectedStages = Object.freeze(["embed", "encode", "load", "release", "render", "retain", "save"]);
const heapMetrics = Object.freeze(["usedSize", "backingStorageSize"]);

export function median(values) {
  assert.equal(values.length, 3, "recorded medians require exactly three runs");
  return [...values].sort((left, right) => left - right)[1];
}

function assertFiniteNonnegative(value, message) {
  assert.ok(Number.isFinite(value) && value >= 0, message);
}

function peakEvidence(sample, sampleIndex) {
  return {
    sampleIndex,
    atMs: sample.atMs,
    ...(sample.boundary === undefined ? {} : { boundary: sample.boundary }),
    targetCount: Object.keys(sample.byTarget).length,
    byTarget: sample.byTarget,
  };
}

export function aggregateHeapSamples(samples) {
  assert.ok(Array.isArray(samples) && samples.length > 0, "every run requires raw CDP heap samples");
  for (const [sampleIndex, sample] of samples.entries()) {
    assertFiniteNonnegative(sample.atMs, `heap sample ${sampleIndex} requires a finite timestamp`);
    assert.ok(sample.byTarget && typeof sample.byTarget === "object", `heap sample ${sampleIndex} requires target details`);
    const targetNames = Object.keys(sample.byTarget);
    assert.ok(targetNames.length > 0, `heap sample ${sampleIndex} requires at least one target`);
    for (const [target, usage] of Object.entries(sample.byTarget)) {
      for (const metric of heapMetrics) {
        assertFiniteNonnegative(usage?.[metric], `heap sample ${sampleIndex}/${target} requires finite ${metric}`);
      }
    }
    for (const metric of heapMetrics) {
      const sum = Object.values(sample.byTarget).reduce((total, usage) => total + usage[metric], 0);
      assert.equal(sample[metric], sum, `heap sample ${sampleIndex} ${metric} must equal the sum of its targets`);
    }
  }

  const peakFor = (metric) => {
    let bestIndex = 0;
    for (let index = 1; index < samples.length; index += 1) {
      if (samples[index][metric] > samples[bestIndex][metric]) bestIndex = index;
    }
    return { value: samples[bestIndex][metric], evidence: peakEvidence(samples[bestIndex], bestIndex) };
  };
  return {
    usedSize: peakFor("usedSize"),
    backingStorageSize: peakFor("backingStorageSize"),
  };
}

export function createStoredHeapPeak(samples) {
  const aggregate = aggregateHeapSamples(samples);
  return {
    usedSize: aggregate.usedSize.value,
    backingStorageSize: aggregate.backingStorageSize.value,
    usedSizeEvidence: aggregate.usedSize.evidence,
    backingStorageSizeEvidence: aggregate.backingStorageSize.evidence,
  };
}

export function createLegacyStoredHeapPeak(samples) {
  let peak = { usedSize: 0, backingStorageSize: 0, targetCount: 0, byTarget: {} };
  for (const sample of samples) {
    if (sample.usedSize > peak.usedSize) {
      peak = {
        usedSize: sample.usedSize,
        backingStorageSize: sample.backingStorageSize,
        targetCount: Object.keys(sample.byTarget).length,
        byTarget: sample.byTarget,
      };
    } else if (sample.backingStorageSize > peak.backingStorageSize) {
      peak.backingStorageSize = sample.backingStorageSize;
    }
  }
  return peak;
}

function assertRun(run, schemaVersion, label) {
  assert.ok(run && typeof run === "object", `${label} is missing`);
  const aggregate = aggregateHeapSamples(run.heap?.samples);
  const storedPeak = schemaVersion === 1
    ? createLegacyStoredHeapPeak(run.heap.samples)
    : createStoredHeapPeak(run.heap.samples);
  assert.deepEqual(run.heap.peak, storedPeak, `${label} stored peak does not match its raw samples`);
  assert.ok(aggregate.usedSize.value > 0 && aggregate.backingStorageSize.value > 0, `${label} requires positive CDP resource maxima`);
  assert.ok(run.heap.samples.some(({ byTarget }) => Object.keys(byTarget).some((name) => name.startsWith("worker-"))), `${label} requires a PDF.js worker heap sample`);
  const stages = [...new Set(run.heap.samples.map(({ boundary }) => boundary?.name).filter(Boolean))].sort();
  assert.deepEqual(stages, expectedStages, `${label} requires exactly all seven boundary samples`);
}

function cellKey(cell) {
  return [cell.fixtureType, cell.pageCount, cell.dpi, cell.format, cell.environment].join("/");
}

function expectedCellKeys() {
  const keys = [];
  for (const fixtureType of fixtureTypes) for (const pageCount of pageCounts) for (const dpi of dpis) for (const format of formats) for (const environment of environmentIds) {
    keys.push([fixtureType, pageCount, dpi, format, environment].join("/"));
  }
  return keys.sort();
}

function selectedBatchFormat(cells) {
  const selected = (format) => cells.find((cell) => (
    cell.fixtureType === "photo-scan"
    && cell.pageCount === 1
    && cell.dpi === 300
    && cell.format === format
    && cell.environment === "pixel7-emulation"
  ));
  const png = selected("png");
  const jpeg = selected("jpeg");
  assert.ok(png && jpeg, "format decision cells are missing");
  const ratio = median(png.records.map((record, index) => record.finalPdfBytes / jpeg.records[index].finalPdfBytes));
  return ratio >= 2 ? "jpeg" : "png";
}

export function assertCompleteRawBenchmark(raw) {
  assert.ok(raw?.schemaVersion === 1 || raw?.schemaVersion === 2, "benchmark raw schema must be 1 or 2");
  assert.equal(raw.warmupRuns, 1, "benchmark requires one warm-up run");
  assert.equal(raw.recordedRuns, 3, "benchmark requires three recorded runs");
  assert.ok(Array.isArray(raw.cells), "benchmark cells must be an array");
  assert.deepEqual(raw.cells.map(cellKey).sort(), expectedCellKeys(), "benchmark matrix must equal the exact 144-cell Cartesian set");
  assert.ok(raw.cells.every((cell) => cell.warmup && Array.isArray(cell.records) && cell.records.length === 3), "every matrix cell must retain one warm-up and three records");

  for (const cell of raw.cells) {
    for (const [runIndex, run] of [cell.warmup, ...cell.records].entries()) {
      assertRun(run, raw.schemaVersion, `matrix ${cellKey(cell)} run ${runIndex}`);
    }
  }

  assert.ok(Array.isArray(raw.batches), "benchmark batches must be an array");
  assert.deepEqual(raw.batches.map(({ environment }) => environment).sort(), [...environmentIds].sort(), "batch environments must equal the exact configured set");
  const batchFormat = selectedBatchFormat(raw.cells);
  for (const batch of raw.batches) {
    assert.equal(batch.dpi, 150, `batch ${batch.environment} must use 150 DPI`);
    assert.equal(batch.format, batchFormat, `batch ${batch.environment} must use the selected format`);
    assert.deepEqual(batch.files, batchFiles, `batch ${batch.environment} must preserve the configured file order`);
    assert.ok(batch.warmup && Array.isArray(batch.records) && batch.records.length === 3, `batch ${batch.environment} must retain one warm-up and three records`);
    for (const [runIndex, run] of [batch.warmup, ...batch.records].entries()) {
      const label = `batch ${batch.environment} run ${runIndex}`;
      assertRun(run, raw.schemaVersion, label);
      assert.equal(run.outputs?.length, batchFiles.length, `${label} must contain exactly three outputs`);
      assert.deepEqual(run.outputs.map(({ type }) => type), ["blank", "text-vector", "photo-scan"], `${label} output order must match the input order`);
      const retainedBytes = run.outputs.reduce((sum, output) => sum + output.finalPdfBytes, 0);
      assert.equal(run.retainedBytes, retainedBytes, `${label} retained bytes must equal the sum of all outputs`);
    }
  }
}

function maximumRecordEvidence(records, metric) {
  const candidates = records.map((record, index) => {
    const aggregate = aggregateHeapSamples(record.heap.samples)[metric];
    return { value: aggregate.value, evidence: { record: index + 1, ...aggregate.evidence } };
  });
  return candidates.reduce((best, candidate) => candidate.value > best.value ? candidate : best);
}

export function summarizeCell(cell) {
  const used = maximumRecordEvidence(cell.records, "usedSize");
  const backing = maximumRecordEvidence(cell.records, "backingStorageSize");
  return {
    fixtureType: cell.fixtureType,
    pageCount: cell.pageCount,
    dpi: cell.dpi,
    format: cell.format,
    environment: cell.environment,
    finalPdfBytesMedian: median(cell.records.map(({ finalPdfBytes }) => finalPdfBytes)),
    totalMsMedian: median(cell.records.map(({ metrics }) => metrics.totalMs)),
    hostWallMsMedian: median(cell.records.map(({ hostWallMs }) => hostWallMs)),
    peakHeapUsedSizeMax: used.value,
    peakHeapUsedSizeEvidence: used.evidence,
    peakHeapBackingStorageSizeMax: backing.value,
    peakHeapBackingStorageSizeEvidence: backing.evidence,
    peakRawRgbaBytesMax: Math.max(...cell.records.map(({ metrics }) => metrics.peakRawRgbaBytes)),
    intermediateImageBytesMedian: median(cell.records.map(({ metrics }) => metrics.intermediateImageBytes)),
  };
}

export function summarizeBatches(batches) {
  return batches.map((batch) => {
    const used = maximumRecordEvidence(batch.records, "usedSize");
    const backing = maximumRecordEvidence(batch.records, "backingStorageSize");
    return {
      environment: batch.environment,
      dpi: batch.dpi,
      format: batch.format,
      retainedBytesMedian: median(batch.records.map(({ retainedBytes }) => retainedBytes)),
      hostWallMsMedian: median(batch.records.map(({ hostWallMs }) => hostWallMs)),
      peakHeapUsedSizeMax: used.value,
      peakHeapUsedSizeEvidence: used.evidence,
      peakHeapBackingStorageSizeMax: backing.value,
      peakHeapBackingStorageSizeEvidence: backing.evidence,
    };
  });
}

export function formatDecision(summary, environment) {
  const png = summary.find((cell) => cell.fixtureType === "photo-scan" && cell.pageCount === 1 && cell.dpi === 300 && cell.format === "png" && cell.environment === environment);
  const jpeg = summary.find((cell) => cell.fixtureType === "photo-scan" && cell.pageCount === 1 && cell.dpi === 300 && cell.format === "jpeg" && cell.environment === environment);
  assert.ok(png && jpeg, `format decision cells are missing for ${environment}`);
  const ratios = png.raw.records.map((record, index) => record.finalPdfBytes / jpeg.raw.records[index].finalPdfBytes);
  const ratio = median(ratios);
  return { environment, pairedRatios: ratios, medianPairedRatio: ratio, format: ratio >= 2 ? "jpeg" : "png" };
}

export function warningCoefficients(summary) {
  return Object.fromEntries(dpis.flatMap((dpi) => formats.map((format) => {
    const candidates = summary.filter((cell) => cell.fixtureType === "photo-scan" && cell.dpi === dpi && cell.format === format);
    const coefficient = Math.max(...candidates.flatMap(({ raw }) => raw.records.map((record) => record.finalPdfBytes / record.metrics.cumulativePixels)));
    return [`${dpi}-${format}`, coefficient];
  })));
}
