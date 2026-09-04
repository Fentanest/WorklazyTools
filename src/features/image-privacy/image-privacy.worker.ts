/// <reference lib="webworker" />

import ExifReader from "exifreader";
import type { ExpandedTags } from "exifreader";
import JSZip from "jszip";

interface PrivacyInput { name: string; type: string; buffer: ArrayBuffer }
interface Metadata { make: string; model: string; software: string; dateTime: string; latitude: string; longitude: string; orientation: string; foundCount: number }

self.onmessage = async (event: MessageEvent<{ files: PrivacyInput[]; language?: string }>) => {
  try {
    if (!event.data.files.length) throw new Error(event.data.language === "en" ? "Choose at least one photo." : "사진을 한 장 이상 선택해 주세요.");
    const cleaned = [] as Array<{ blob: Blob; fileName: string; metadata: Metadata; sourceName: string }>;
    for (const input of event.data.files) cleaned.push(await cleanImage(input, event.data.language));
    if (cleaned.length === 1) {
      const only = cleaned[0];
      const buffer = await only.blob.arrayBuffer();
      self.postMessage({ type: "result", items: cleaned.map(({ metadata, sourceName }) => ({ metadata, sourceName })), metadata: only.metadata, buffer, mimeType: only.blob.type, fileName: only.fileName }, [buffer]);
      return;
    }
    const zip = new JSZip();
    cleaned.forEach((item, index) => zip.file(`${String(index + 1).padStart(2, "0")}-${item.fileName}`, item.blob));
    const buffer = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE", compressionOptions: { level: 6 }, streamFiles: true });
    const empty: Metadata = { make: "", model: "", software: "", dateTime: "", latitude: "", longitude: "", orientation: "", foundCount: cleaned.reduce((sum, item) => sum + item.metadata.foundCount, 0) };
    self.postMessage({ type: "result", items: cleaned.map(({ metadata, sourceName }) => ({ metadata, sourceName })), metadata: empty, buffer, mimeType: "application/zip", fileName: event.data.language === "en" ? "worklazy-metadata-removed.zip" : "worklazy-메타데이터제거.zip" }, [buffer]);
  } catch {
    self.postMessage({ type: "error", message: event.data.language === "en" ? "The photo metadata could not be processed." : "사진의 메타데이터를 처리하지 못했습니다." });
  }
};

async function cleanImage(input: PrivacyInput, language?: string) {
  const tags = ExifReader.load(input.buffer, { async: false, expanded: true });
  const exif = tags.exif || {};
  const metadata: Metadata = {
    make: tagText(exif, "Make"), model: tagText(exif, "Model"), software: tagText(exif, "Software"),
    dateTime: tagText(exif, "DateTimeOriginal") || tagText(exif, "DateTime"),
    latitude: coordinateText(tags.gps?.Latitude), longitude: coordinateText(tags.gps?.Longitude),
    orientation: tagText(exif, "Orientation"), foundCount: countMetadataTags(tags),
  };
  const bitmap = await createImageBitmap(new Blob([input.buffer], { type: input.type }), { imageOrientation: "from-image" });
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error(language === "en" ? "The image-cleaning canvas could not be created." : "이미지 정리 캔버스를 만들 수 없습니다.");
    context.drawImage(bitmap, 0, 0);
    const requestedMime = input.type === "image/png" ? "image/png" : input.type === "image/webp" ? "image/webp" : "image/jpeg";
    const blob = await canvas.convertToBlob({ type: requestedMime, quality: 0.94 });
    const mimeType = /image\/(?:png|webp|jpeg)/.test(blob.type) ? blob.type : "image/png";
    const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const base = sanitizeName(input.name.replace(/\.[^.]+$/, ""));
    return { blob, metadata, sourceName: input.name, fileName: `${base}-${language === "en" ? "metadata-removed" : "메타데이터제거"}.${extension}` };
  } finally { bitmap.close(); }
}

function tagText(tags: object, name: string) {
  const tag = (tags as Record<string, { description?: string; value?: unknown } | undefined>)[name];
  if (!tag) return "";
  if (typeof tag.description === "string") return tag.description;
  return Array.isArray(tag.value) ? tag.value.join(", ") : String(tag.value ?? "");
}

function coordinateText(value: number | undefined) {
  return Number.isFinite(value) ? Number(value).toFixed(6).replace(/0+$/, "").replace(/\.$/, "") : "";
}

function countMetadataTags(tags: ExpandedTags) {
  return [tags.exif, tags.gps, tags.xmp, tags.iptc].reduce((count, group) => count + (group ? Object.keys(group).filter((key) => key !== "_raw").length : 0), 0);
}

function sanitizeName(name: string) { return name.trim().replace(/[\\/:*?"<>|]+/g, "-") || "image"; }

export {};
