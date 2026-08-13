/// <reference lib="webworker" />

import { applyPalette, GIFEncoder, quantize } from "gifenc";
import JSZip from "jszip";

import type {
  BatchImageOptions,
  CollageOptions,
  GifOptions,
  ImageOutputFormat,
  ImageWorkerInput,
  ImageWorkerResult,
  WatermarkPosition,
} from "./types";

const worker = self as unknown as DedicatedWorkerGlobalScope;

type ImageWorkerRequest =
  | { type: "batch"; inputs: ImageWorkerInput[]; options: BatchImageOptions; archiveName: string }
  | { type: "collage"; inputs: ImageWorkerInput[]; options: CollageOptions; fileName: string }
  | { type: "gif"; inputs: ImageWorkerInput[]; options: GifOptions; fileName: string };

worker.onmessage = async (event: MessageEvent<ImageWorkerRequest>) => {
  try {
    ensureCanvasSupport();
    let result: ImageWorkerResult;
    if (event.data.type === "batch") result = await processBatch(event.data.inputs, event.data.options, event.data.archiveName);
    else if (event.data.type === "collage") result = await createCollage(event.data.inputs, event.data.options, event.data.fileName);
    else result = await createGif(event.data.inputs, event.data.options, event.data.fileName);
    worker.postMessage({ type: "result", result }, [result.buffer]);
  } catch (error) {
    worker.postMessage({ type: "error", error: normalizeError(error) });
  } finally {
    worker.close();
  }
};

async function processBatch(inputs: ImageWorkerInput[], options: BatchImageOptions, archiveName: string) {
  if (!inputs.length) throw new Error("일괄 처리할 이미지가 없습니다.");
  const zip = new JSZip();
  let watermark: ImageBitmap | undefined;
  try {
    if (options.watermarkImage) watermark = await decodeImage(options.watermarkImage);
    for (let index = 0; index < inputs.length; index += 1) {
      const input = inputs[index];
      const bitmap = await decodeImage(input);
      try {
        const size = calculateBatchSize(bitmap.width, bitmap.height, options);
        validateCanvasSize(size.width, size.height);
        const canvas = new OffscreenCanvas(size.width, size.height);
        const context = getContext(canvas);
        fillOutputBackground(context, size.width, size.height, options.background, options.format);
        context.drawImage(bitmap, size.sourceX, size.sourceY, size.sourceWidth, size.sourceHeight, size.destX, size.destY, size.destWidth, size.destHeight);
        drawWatermark(context, size.width, size.height, options, watermark);
        const blob = await canvas.convertToBlob({ type: formatMime(options.format), quality: options.quality });
        zip.file(`${String(index + 1).padStart(2, "0")}-${sanitizeName(stripExtension(input.name))}.${formatExtension(options.format)}`, await blob.arrayBuffer());
        canvas.width = 1;
        canvas.height = 1;
      } finally {
        bitmap.close();
      }
      progress(6 + ((index + 1) / inputs.length) * 74, `[${index + 1}/${inputs.length}] ${input.name} 처리 완료`);
    }
    progress(82, `${inputs.length}개 결과를 ZIP으로 묶는 중…`);
    const bytes = await zip.generateAsync(
      { type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } },
      (metadata) => progress(82 + metadata.percent * 0.17, `ZIP 압축 중… ${Math.round(metadata.percent)}%`),
    );
    return binaryResult(bytes, ensureExtension(archiveName, "zip"), "application/zip", []);
  } finally {
    watermark?.close();
  }
}

async function createCollage(inputs: ImageWorkerInput[], options: CollageOptions, fileName: string) {
  if (inputs.length < 2) throw new Error("이어붙일 이미지를 두 개 이상 선택해 주세요.");
  progress(4, "이미지 크기를 확인하는 중…");
  const bitmaps = await Promise.all(inputs.map(decodeImage));
  try {
    const layout = calculateCollageLayout(bitmaps, options);
    validateCanvasSize(layout.width, layout.height);
    const canvas = new OffscreenCanvas(layout.width, layout.height);
    const context = getContext(canvas);
    fillOutputBackground(context, layout.width, layout.height, options.background, options.format);
    for (let index = 0; index < bitmaps.length; index += 1) {
      const bitmap = bitmaps[index];
      const cell = layout.cells[index];
      if (options.layout === "grid") drawCovered(context, bitmap, cell.x, cell.y, cell.width, cell.height);
      else drawContained(context, bitmap, cell.x, cell.y, cell.width, cell.height);
      progress(18 + ((index + 1) / bitmaps.length) * 68, `[${index + 1}/${bitmaps.length}] 이미지 배치 중…`);
    }
    progress(91, "콜라주 이미지를 저장하는 중…");
    const blob = await canvas.convertToBlob({ type: formatMime(options.format), quality: options.quality });
    const result = binaryResult(await blob.arrayBuffer(), ensureExtension(fileName, formatExtension(options.format)), blob.type, []);
    canvas.width = 1;
    canvas.height = 1;
    progress(100, "콜라주 생성 완료");
    return result;
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}

async function createGif(inputs: ImageWorkerInput[], options: GifOptions, fileName: string) {
  if (inputs.length < 2) throw new Error("GIF 프레임 이미지를 두 개 이상 선택해 주세요.");
  const bitmaps = await Promise.all(inputs.map(decodeImage));
  try {
    const maxWidth = Math.max(...bitmaps.map((bitmap) => bitmap.width));
    const maxHeight = Math.max(...bitmaps.map((bitmap) => bitmap.height));
    const scale = Math.min(1, options.width / maxWidth);
    const width = Math.max(1, Math.round(maxWidth * scale));
    const height = Math.max(1, Math.round(maxHeight * scale));
    validateCanvasSize(width, height);
    const canvas = new OffscreenCanvas(width, height);
    const context = getContext(canvas, true);
    const gif = GIFEncoder();
    for (let index = 0; index < bitmaps.length; index += 1) {
      context.clearRect(0, 0, width, height);
      drawContained(context, bitmaps[index], 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      const palette = quantize(pixels, options.qualityColors, { format: "rgba4444", oneBitAlpha: 20 });
      const indexed = applyPalette(pixels, palette, "rgba4444");
      gif.writeFrame(indexed, width, height, { palette, delay: options.delay, repeat: 0, transparent: true });
      progress(10 + ((index + 1) / bitmaps.length) * 80, `[${index + 1}/${bitmaps.length}] GIF 프레임 인코딩 중…`);
    }
    gif.finish();
    const bytes = gif.bytes();
    canvas.width = 1;
    canvas.height = 1;
    progress(100, "GIF 애니메이션 생성 완료");
    return binaryResult(bytes, ensureExtension(fileName, "gif"), "image/gif", ["GIF는 최대 256색 팔레트를 사용하므로 사진의 색상 그라데이션이 단순화될 수 있습니다."]);
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}

function calculateBatchSize(sourceWidth: number, sourceHeight: number, options: BatchImageOptions) {
  if (options.mode === "original") return drawPlan(sourceWidth, sourceHeight, sourceWidth, sourceHeight, "contain");
  if (options.mode === "fit-width") {
    const height = Math.max(1, Math.round(sourceHeight * options.width / sourceWidth));
    return drawPlan(sourceWidth, sourceHeight, options.width, height, "contain");
  }
  return drawPlan(sourceWidth, sourceHeight, options.width, options.height, options.mode);
}

function drawPlan(sourceWidth: number, sourceHeight: number, width: number, height: number, mode: "contain" | "cover") {
  const scale = mode === "cover" ? Math.max(width / sourceWidth, height / sourceHeight) : Math.min(width / sourceWidth, height / sourceHeight);
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  if (mode === "contain") {
    return { width, height, sourceX: 0, sourceY: 0, sourceWidth, sourceHeight, destX: (width - drawnWidth) / 2, destY: (height - drawnHeight) / 2, destWidth: drawnWidth, destHeight: drawnHeight };
  }
  const sourceRatio = width / height;
  const imageRatio = sourceWidth / sourceHeight;
  const cropWidth = imageRatio > sourceRatio ? sourceHeight * sourceRatio : sourceWidth;
  const cropHeight = imageRatio > sourceRatio ? sourceHeight : sourceWidth / sourceRatio;
  return { width, height, sourceX: (sourceWidth - cropWidth) / 2, sourceY: (sourceHeight - cropHeight) / 2, sourceWidth: cropWidth, sourceHeight: cropHeight, destX: 0, destY: 0, destWidth: width, destHeight: height };
}

function calculateCollageLayout(bitmaps: ImageBitmap[], options: CollageOptions) {
  const gap = Math.max(0, Math.round(options.gap));
  const outputWidth = Math.max(1, Math.round(options.width));
  if (options.layout === "vertical") {
    const width = outputWidth;
    const heights = bitmaps.map((bitmap) => Math.round(bitmap.height * width / bitmap.width));
    let y = 0;
    const cells = heights.map((height) => { const cell = { x: 0, y, width, height }; y += height + gap; return cell; });
    return { width, height: y - gap, cells };
  }
  if (options.layout === "horizontal") {
    if (outputWidth - gap * (bitmaps.length - 1) < bitmaps.length) throw new Error("전체 가로 크기에 비해 이미지 수와 간격이 너무 큽니다.");
    const cellWidth = Math.max(1, Math.floor((outputWidth - gap * (bitmaps.length - 1)) / bitmaps.length));
    const height = Math.max(...bitmaps.map((bitmap) => Math.round(bitmap.height * cellWidth / bitmap.width)));
    return { width: outputWidth, height, cells: bitmaps.map((_, index) => ({ x: index * (cellWidth + gap), y: 0, width: cellWidth, height })) };
  }
  const columns = Math.max(1, Math.min(Math.round(options.columns), bitmaps.length));
  if (outputWidth - gap * (columns - 1) < columns) throw new Error("전체 가로 크기에 비해 열 개수와 간격이 너무 큽니다.");
  const rows = Math.ceil(bitmaps.length / columns);
  const cellWidth = Math.floor((outputWidth - gap * (columns - 1)) / columns);
  const cellHeight = Math.round(cellWidth * 0.75);
  return { width: outputWidth, height: rows * cellHeight + (rows - 1) * gap, cells: bitmaps.map((_, index) => ({ x: (index % columns) * (cellWidth + gap), y: Math.floor(index / columns) * (cellHeight + gap), width: cellWidth, height: cellHeight })) };
}

function drawContained(context: OffscreenCanvasRenderingContext2D, bitmap: ImageBitmap, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / bitmap.width, height / bitmap.height);
  const drawnWidth = bitmap.width * scale;
  const drawnHeight = bitmap.height * scale;
  context.drawImage(bitmap, x + (width - drawnWidth) / 2, y + (height - drawnHeight) / 2, drawnWidth, drawnHeight);
}

function drawCovered(context: OffscreenCanvasRenderingContext2D, bitmap: ImageBitmap, x: number, y: number, width: number, height: number) {
  const targetRatio = width / height;
  const sourceRatio = bitmap.width / bitmap.height;
  const sourceWidth = sourceRatio > targetRatio ? bitmap.height * targetRatio : bitmap.width;
  const sourceHeight = sourceRatio > targetRatio ? bitmap.height : bitmap.width / targetRatio;
  context.drawImage(bitmap, (bitmap.width - sourceWidth) / 2, (bitmap.height - sourceHeight) / 2, sourceWidth, sourceHeight, x, y, width, height);
}

function drawWatermark(context: OffscreenCanvasRenderingContext2D, width: number, height: number, options: BatchImageOptions, watermark?: ImageBitmap) {
  context.save();
  context.globalAlpha = clamp(options.watermarkOpacity, 0, 1);
  const margin = Math.max(14, Math.round(Math.min(width, height) * 0.025));
  if (watermark) {
    const targetWidth = Math.min(width * 0.28, watermark.width);
    const targetHeight = watermark.height * targetWidth / watermark.width;
    const point = positionPoint(options.watermarkPosition, width, height, targetWidth, targetHeight, margin);
    context.drawImage(watermark, point.x, point.y, targetWidth, targetHeight);
  } else if (options.watermarkText.trim()) {
    const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.045));
    context.font = `700 ${fontSize}px sans-serif`;
    context.fillStyle = "#ffffff";
    context.strokeStyle = "rgba(0,0,0,.55)";
    context.lineWidth = Math.max(2, fontSize * 0.08);
    const metrics = context.measureText(options.watermarkText);
    const textHeight = fontSize * 1.2;
    const point = positionPoint(options.watermarkPosition, width, height, metrics.width, textHeight, margin);
    const baseline = point.y + fontSize;
    context.strokeText(options.watermarkText, point.x, baseline);
    context.fillText(options.watermarkText, point.x, baseline);
  }
  context.restore();
}

function positionPoint(position: WatermarkPosition, width: number, height: number, itemWidth: number, itemHeight: number, margin: number) {
  const left = margin;
  const centerX = (width - itemWidth) / 2;
  const right = width - itemWidth - margin;
  const top = margin;
  const centerY = (height - itemHeight) / 2;
  const bottom = height - itemHeight - margin;
  if (position === "top-left") return { x: left, y: top };
  if (position === "top-right") return { x: right, y: top };
  if (position === "center") return { x: centerX, y: centerY };
  if (position === "bottom-left") return { x: left, y: bottom };
  return { x: right, y: bottom };
}

async function decodeImage(input: ImageWorkerInput) {
  return createImageBitmap(new Blob([input.buffer], { type: input.mimeType || "application/octet-stream" }));
}

function getContext(canvas: OffscreenCanvas, readFrequently = false) {
  const context = canvas.getContext("2d", { alpha: true, willReadFrequently: readFrequently });
  if (!context) throw new Error("이미지 캔버스를 만들지 못했습니다.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return context;
}

function fillOutputBackground(
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  background: string,
  format: ImageOutputFormat,
) {
  context.clearRect(0, 0, width, height);
  const color = format === "jpeg" ? "#ffffff" : background;
  if (color === "transparent") return;
  context.fillStyle = color;
  context.fillRect(0, 0, width, height);
}

function ensureCanvasSupport() {
  if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") throw new Error("이 브라우저는 백그라운드 이미지 처리를 지원하지 않습니다. 최신 Chrome, Edge 또는 Firefox를 사용해 주세요.");
}

function validateCanvasSize(width: number, height: number) {
  if (width < 1 || height < 1) throw new Error("출력 이미지 크기가 올바르지 않습니다.");
  if (width > 12_000 || height > 12_000 || width * height > 80_000_000) throw new Error("출력 이미지가 브라우저 한도를 넘습니다. 크기 또는 이미지 수를 줄여 주세요.");
}

function binaryResult(data: Uint8Array | ArrayBuffer, fileName: string, mimeType: string, warnings: string[]): ImageWorkerResult {
  const buffer = data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  return { buffer, fileName, mimeType, warnings };
}

function progress(value: number, message: string) {
  worker.postMessage({ type: "progress", progress: Math.round(value), message });
}

function formatMime(format: ImageOutputFormat) {
  return `image/${format}`;
}

function formatExtension(format: ImageOutputFormat) {
  return format === "jpeg" ? "jpg" : format;
}

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function sanitizeName(name: string) {
  return name.trim().replace(/[\\/:*?"<>|]+/g, "-") || "image";
}

function ensureExtension(name: string, extension: string) {
  return `${sanitizeName(stripExtension(name))}.${extension}`;
}

function normalizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/memory|allocation|canvas.*size|브라우저 한도/i.test(message)) return { message: "이미지 크기나 개수가 브라우저 메모리 한도를 넘었습니다. 출력 크기 또는 파일 수를 줄여 주세요.", code: "OUT_OF_MEMORY" };
  return { message, code: "IMAGE_PROCESSING_ERROR" };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export {};
