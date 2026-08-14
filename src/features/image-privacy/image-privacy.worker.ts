/// <reference lib="webworker" />

import ExifReader from "exifreader";

self.onmessage = async (event: MessageEvent<{ name: string; type: string; buffer: ArrayBuffer; language?: string }>) => {
  let bitmap: ImageBitmap | undefined;
  try {
    const tags = ExifReader.load(event.data.buffer, { async: false });
    const metadata = {
      make: tagText(tags, "Make"), model: tagText(tags, "Model"), software: tagText(tags, "Software"),
      dateTime: tagText(tags, "DateTimeOriginal") || tagText(tags, "DateTime"),
      latitude: tagText(tags, "GPSLatitude"), longitude: tagText(tags, "GPSLongitude"),
      orientation: tagText(tags, "Orientation"),
      foundCount: Object.keys(tags).length,
    };
    bitmap = await createImageBitmap(new Blob([event.data.buffer], { type: event.data.type }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error(event.data.language === "en" ? "The image-cleaning canvas could not be created." : "이미지 정리 캔버스를 만들 수 없습니다.");
    context.drawImage(bitmap, 0, 0);
    const mimeType = event.data.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await canvas.convertToBlob({ type: mimeType, quality: 0.94 });
    const buffer = await blob.arrayBuffer();
    const extension = mimeType === "image/png" ? "png" : "jpg";
    const base = event.data.name.replace(/\.[^.]+$/, "");
    self.postMessage({ type: "result", metadata, buffer, mimeType, fileName: `${base}-${event.data.language === "en" ? "metadata-removed" : "메타데이터제거"}.${extension}` }, [buffer]);
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : event.data.language === "en" ? "The photo metadata could not be processed." : "사진의 메타데이터를 처리하지 못했습니다." });
  } finally {
    bitmap?.close();
  }
};

function tagText(tags: Record<string, unknown>, name: string) {
  const tag = tags[name] as { description?: string; value?: unknown } | undefined;
  if (!tag) return "";
  if (typeof tag.description === "string") return tag.description;
  return Array.isArray(tag.value) ? tag.value.join(", ") : String(tag.value ?? "");
}

export {};
