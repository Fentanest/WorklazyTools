import coverageInput from "../../../scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/coverage.json" with { type: "json" };
import { QR_LABEL_FONT_PATH } from "./qrBulk.ts";

export const QR_LABEL_SUBSET_FONT_PATH = "vendor/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/NotoSansKR-Regular.ksx1001.otf";
const snapshot = "noto-cjk-sans-2.004-ksx1001-v1";
export type QrLabelFontKind = "subset" | "full";
export type QrLabelCopy = Readonly<{ title: string; description: string }>;

export class QrLabelFontInitError extends Error {
  constructor(cause: unknown) {
    super("QR_LABEL_FONT_INIT", { cause });
    this.name = "QrLabelFontInitError";
  }
}

class QrLabelFontAssetError extends Error {}

export const qrLabelFontAssets = {
  subset: {
    path: QR_LABEL_SUBSET_FONT_PATH,
    size: 931_704,
    sha256: "b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be",
  },
  full: {
    path: QR_LABEL_FONT_PATH,
    size: 4_644_748,
    sha256: "69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68",
  },
} as const;

export function qrCoverageSet(input: unknown): ReadonlySet<number> | undefined {
  if (!input || typeof input !== "object") return;
  const value = input as { schema?: unknown; snapshot?: unknown; codepoints?: unknown };
  if (
    Object.keys(value).sort().join(",") !== "codepoints,schema,snapshot"
    || value.schema !== 1
    || value.snapshot !== snapshot
    || !Array.isArray(value.codepoints)
    || value.codepoints.length !== 3_394
  ) return;
  let previous = -1;
  for (const codepoint of value.codepoints) {
    if (
      !Number.isInteger(codepoint)
      || codepoint <= previous
      || codepoint > 0x10ffff
      || (codepoint >= 0xd800 && codepoint <= 0xdfff)
    ) return;
    previous = codepoint;
  }
  if (!value.codepoints.includes(0x2026)) return;
  return new Set(value.codepoints as number[]);
}

const coverage = qrCoverageSet(coverageInput);

export async function selectQrLabelFont(
  entries: readonly QrLabelCopy[],
  signal?: AbortSignal,
  supported = coverage,
): Promise<QrLabelFontKind> {
  signal?.throwIfAborted();
  if (!supported) return "full";
  let processed = 0;
  let started = performance.now();
  for (const entry of entries) {
    for (const value of [entry.title, entry.description]) {
      const cleaned = value.replace(/\s+/gu, " ").trim();
      for (const text of [cleaned, cleaned.normalize("NFC")]) {
        for (const character of text) {
          if (!supported.has(character.codePointAt(0)!)) return "full";
          if (++processed % 8_192 === 0) {
            signal?.throwIfAborted();
            if (performance.now() - started > 8) {
              await new Promise<void>((resolve) => setTimeout(resolve, 0));
              signal?.throwIfAborted();
              started = performance.now();
            }
          }
        }
      }
    }
  }
  signal?.throwIfAborted();
  return "subset";
}

// Created lazily per mounted panel; PDFDocument and PDFFont are never cached.
export function createQrLabelFontLoader(baseUrl: string, origin: string) {
  const cache = new Map<QrLabelFontKind, ArrayBuffer>();
  let disposed = false;

  function check(signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (disposed) throw new DOMException("Aborted", "AbortError");
  }

  async function load(kind: QrLabelFontKind, signal?: AbortSignal) {
    check(signal);
    const cached = cache.get(kind);
    if (cached) return { kind, bytes: cached };
    const asset = qrLabelFontAssets[kind];
    try {
      const response = await fetch(new URL(`${baseUrl}${asset.path}`, origin), { signal });
      check(signal);
      if (!response.ok) throw new QrLabelFontAssetError("HTTP");
      const bytes = await response.arrayBuffer();
      check(signal);
      if (bytes.byteLength !== asset.size) throw new QrLabelFontAssetError("SIZE");
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      check(signal);
      const hash = [...new Uint8Array(digest)]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
      if (hash !== asset.sha256) throw new QrLabelFontAssetError("SHA");
      cache.set(kind, bytes);
      return { kind, bytes };
    } catch (error) {
      check(signal);
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new QrLabelFontAssetError("ASSET", { cause: error });
    }
  }

  return {
    load,
    async acquire(kind: QrLabelFontKind, signal?: AbortSignal) {
      try {
        return await load(kind, signal);
      } catch (error) {
        check(signal);
        if (kind !== "subset" || !(error instanceof QrLabelFontAssetError)) throw error;
        return load("full", signal);
      }
    },
    evict(kind: QrLabelFontKind) {
      cache.delete(kind);
    },
    dispose() {
      disposed = true;
      cache.clear();
    },
  };
}
