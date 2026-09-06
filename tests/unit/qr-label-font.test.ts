import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import coverageInput from "../../scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/coverage.json" with { type: "json" };
import {
  createQrLabelFontLoader,
  qrCoverageSet,
  qrLabelFontAssets,
  selectQrLabelFont,
} from "../../src/features/qr-studio/qrLabelFont.ts";
import { createQrLabelPdf } from "../../src/features/qr-studio/qrLabelPdf.ts";
import { QrLabelFontInitError } from "../../src/features/qr-studio/qrLabelFont.ts";

const coverage = qrCoverageSet(coverageInput);

test("QR font coverage schema is exact, sorted and includes the ellipsis", () => {
  assert.ok(coverage);
  assert.equal(coverage.size, 3_394);
  assert.ok(coverage.has(0x2026));
  const valid = structuredClone(coverageInput) as typeof coverageInput;
  const malformed: unknown[] = [
    null,
    [],
    { ...valid, extra: true },
    { ...valid, schema: 2 },
    { ...valid, snapshot: "other" },
    { ...valid, codepoints: valid.codepoints.slice(1) },
    { ...valid, codepoints: [...valid.codepoints.slice(0, -1), valid.codepoints.at(-2)] },
    { ...valid, codepoints: [...valid.codepoints.slice(0, 20), 0xd800, ...valid.codepoints.slice(21)] },
    { ...valid, codepoints: valid.codepoints.filter((value) => value !== 0x2026).concat(0x10ffff).sort((a, b) => a - b) },
  ];
  malformed.forEach((value) => assert.equal(qrCoverageSet(value), undefined));
});

test("QR labels require coverage for both original and NFC text", async () => {
  assert.equal(await selectQrLabelFont([], undefined, coverage), "subset");
  assert.equal(await selectQrLabelFont([{ title: "한글 라벨 … café", description: "₩12,000" }], undefined, coverage), "subset");
  assert.equal(await selectQrLabelFont([{ title: "똠", description: "" }], undefined, coverage), "full");
  assert.equal(await selectQrLabelFont([{ title: "똠", description: "" }], undefined, coverage), "full", "NFC must reject a composed syllable outside the subset");
  assert.equal(await selectQrLabelFont([{ title: "e\u0301", description: "" }], undefined, coverage), "full", "original combining marks must not be hidden by NFC");
  assert.equal(await selectQrLabelFont([{ title: "😀", description: "" }], undefined, coverage), "full");
  assert.equal(await selectQrLabelFont([{ title: "漢", description: "" }], undefined, coverage), "full");
});

test("all 11,172 modern Hangul syllables select subset exactly when their NFD and NFC forms are covered", async () => {
  assert.ok(coverage);
  let expectedSubset = 0;
  for (let codepoint = 0xac00; codepoint <= 0xd7a3; codepoint += 1) {
    const syllable = String.fromCodePoint(codepoint);
    const expected = coverage.has(codepoint) ? "subset" : "full";
    if (expected === "subset") expectedSubset += 1;
    assert.equal(
      await selectQrLabelFont([{ title: syllable.normalize("NFD"), description: "" }], undefined, coverage),
      expected,
      `U+${codepoint.toString(16).toUpperCase()}`,
    );
  }
  assert.equal(expectedSubset, 2_350);
});

test("coverage scanning yields at the 8,192-codepoint boundary and observes abort", async () => {
  const controller = new AbortController();
  const originalNow = performance.now;
  let clock = 0;
  Object.defineProperty(performance, "now", { configurable: true, value: () => (clock += 9) });
  const pending = selectQrLabelFont([{ title: "가".repeat(8_192), description: "" }], controller.signal, coverage);
  controller.abort();
  await assert.rejects(pending, (error) => error instanceof Error && error.name === "AbortError");
  Object.defineProperty(performance, "now", { configurable: true, value: originalNow });
});

test("font loader validates size and SHA, caches at most the two named assets, and supports an omitted signal", async () => {
  await withAssetMocks(async ({ requests }) => {
    const loader = createQrLabelFontLoader("/base/", "https://example.test");
    const subset = await loader.load("subset");
    const full = await loader.load("full");
    assert.equal(subset.bytes.byteLength, qrLabelFontAssets.subset.size);
    assert.equal(full.bytes.byteLength, qrLabelFontAssets.full.size);
    assert.equal((await loader.load("subset")).bytes, subset.bytes);
    assert.equal((await loader.load("full")).bytes, full.bytes);
    assert.deepEqual(requests, [
      `https://example.test/base/${qrLabelFontAssets.subset.path}`,
      `https://example.test/base/${qrLabelFontAssets.full.path}`,
    ]);
  });
});

test("every subset asset failure falls back once to full and failed subset bytes are never cached", async () => {
  for (const failure of ["http", "network", "body", "empty", "truncated", "html", "sha"] as const) {
    await withAssetMocks(async ({ requests, setFailure }) => {
      setFailure("subset", failure);
      const loader = createQrLabelFontLoader("/", "https://example.test");
      assert.equal((await loader.acquire("subset")).kind, "full", failure);
      assert.equal((await loader.acquire("subset")).kind, "full", failure);
      assert.deepEqual(requests.map((url) => new URL(url).pathname), [
        `/${qrLabelFontAssets.subset.path}`,
        `/${qrLabelFontAssets.full.path}`,
        `/${qrLabelFontAssets.subset.path}`,
      ], failure);
    });
  }
});

test("full asset failure and failure of both assets do not retry", async () => {
  await withAssetMocks(async ({ requests, setFailure }) => {
    setFailure("full", "http");
    const loader = createQrLabelFontLoader("/", "https://example.test");
    await assert.rejects(loader.load("full"));
    assert.equal(requests.length, 1);
  });
  await withAssetMocks(async ({ requests, setFailure }) => {
    setFailure("subset", "sha");
    setFailure("full", "network");
    const loader = createQrLabelFontLoader("/", "https://example.test");
    await assert.rejects(loader.acquire("subset"));
    assert.equal(requests.length, 2);
  });
});

test("abort and dispose prevent stale fetch or digest completion from reviving cache", async () => {
  const controller = new AbortController();
  await withAssetMocks(async ({ requests, deferBody, releaseBody }) => {
    deferBody();
    const loader = createQrLabelFontLoader("/", "https://example.test");
    const pending = loader.load("subset", controller.signal);
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    releaseBody();
    await assert.rejects(pending, (error) => error instanceof Error && error.name === "AbortError");
    assert.equal(requests.length, 1);
  });

  await withAssetMocks(async ({ requests, deferDigest, releaseDigest }) => {
    deferDigest();
    const loader = createQrLabelFontLoader("/", "https://example.test");
    const pending = loader.load("subset");
    await new Promise((resolve) => setImmediate(resolve));
    loader.dispose();
    releaseDigest();
    await assert.rejects(pending, (error) => error instanceof Error && error.name === "AbortError");
    assert.equal(requests.length, 1);
  });
});

test("only font registration or embedding failures cross the typed font-init boundary", async () => {
  await assert.rejects(
    createQrLabelPdf([], "a4", new ArrayBuffer(0)),
    (error) => error instanceof QrLabelFontInitError,
  );
  const compressed = fs.readFileSync(new URL(
    "../../scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/NotoSansKR-Regular.ksx1001.otf.gz",
    import.meta.url,
  ));
  const font = gunzipSync(compressed);
  const exactFont = font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength);
  await assert.rejects(
    createQrLabelPdf([{ png: new Blob(["not a png"]), title: "한글", description: "" }], "a4", exactFont),
    (error) => !(error instanceof QrLabelFontInitError),
  );
});

test("QR panel keeps one synchronous ZIP/PDF export lease and invalidates it at every stale-result boundary", () => {
  const source = fs.readFileSync(new URL("../../src/features/qr-studio/QrBulkPanel.tsx", import.meta.url), "utf8");
  assert.equal(source.match(/activeExportRef\.current\) return;/g)?.length, 2);
  assert.match(source, /const active = beginExport\("zip"\);[\s\S]*?await Promise\.all/);
  assert.match(source, /const active = beginExport\("pdf"\);[\s\S]*?const fontTask/);
  assert.match(source, /disabled=\{busy \|\| !results\.length/);
  assert.equal(source.match(/storageRef\.current = undefined;\n\s+await storage\.clear\(\);/g)?.length, 2);
  assert.match(source, /function invalidateExport\(\)[\s\S]*?controller\.abort\(\)[\s\S]*?fontLoaderRef\.current\?\.dispose\(\)/);
  assert.match(source, /selected\.kind !== "subset" \|\| !\(error instanceof QrLabelFontInitError\)/);
  assert.match(source, /loader\.evict\("subset"\)[\s\S]*?loader\.load\("full"[\s\S]*?createQrLabelPdf\(entries/);
  assert.match(source, /setTimeout\(resolve, 0\)[\s\S]*?assertExport\(active\);[\s\S]*?downloadBlob/);
});

type Failure = "http" | "network" | "body" | "empty" | "truncated" | "html" | "sha";

async function withAssetMocks(
  run: (control: {
    requests: string[];
    setFailure: (kind: "subset" | "full", failure: Failure) => void;
    deferBody: () => void;
    releaseBody: () => void;
    deferDigest: () => void;
    releaseDigest: () => void;
  }) => Promise<void>,
) {
  const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const requests: string[] = [];
  const failures = new Map<"subset" | "full", Failure>();
  let bodyDeferred: Promise<void> | undefined;
  let releaseBody = () => {};
  let digestDeferred: Promise<void> | undefined;
  let releaseDigest = () => {};
  const bytesByKind = {
    subset: new ArrayBuffer(qrLabelFontAssets.subset.size),
    full: new ArrayBuffer(qrLabelFontAssets.full.size),
  };

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (input: URL | RequestInfo) => {
      const url = String(input);
      requests.push(url);
      const kind = url.endsWith(qrLabelFontAssets.subset.path) ? "subset" : "full";
      const failure = failures.get(kind);
      if (failure === "network") throw new TypeError("network");
      return {
        ok: failure !== "http",
        async arrayBuffer() {
          if (bodyDeferred) await bodyDeferred;
          if (failure === "body") throw new TypeError("body");
          if (failure === "empty") return new ArrayBuffer(0);
          if (failure === "truncated" || failure === "html") return new ArrayBuffer(13);
          return bytesByKind[kind];
        },
      };
    },
  });
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      subtle: {
        async digest(_algorithm: string, data: BufferSource) {
          if (digestDeferred) await digestDeferred;
          const kind = data.byteLength === qrLabelFontAssets.subset.size ? "subset" : "full";
          const hash = failures.get(kind) === "sha" ? "00".repeat(32) : qrLabelFontAssets[kind].sha256;
          return Uint8Array.from(hash.match(/../g)!, (byte) => Number.parseInt(byte, 16)).buffer;
        },
      },
    },
  });

  try {
    await run({
      requests,
      setFailure(kind, failure) {
        failures.set(kind, failure);
      },
      deferBody() {
        bodyDeferred = new Promise<void>((resolve) => {
          releaseBody = resolve;
        });
      },
      releaseBody() {
        releaseBody();
      },
      deferDigest() {
        digestDeferred = new Promise<void>((resolve) => {
          releaseDigest = resolve;
        });
      },
      releaseDigest() {
        releaseDigest();
      },
    });
  } finally {
    if (fetchDescriptor) Object.defineProperty(globalThis, "fetch", fetchDescriptor);
    else Reflect.deleteProperty(globalThis, "fetch");
    if (cryptoDescriptor) Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
    else Reflect.deleteProperty(globalThis, "crypto");
  }
}
