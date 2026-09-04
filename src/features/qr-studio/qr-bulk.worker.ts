/// <reference lib="webworker" />
import QRCode from "qrcode";

import { compositeQrImageDataOnWhite, decodeQrImageData } from "./qrDecoder.ts";
import type { QrErrorCorrectionLevel } from "./qrBulk.ts";

interface RasterSettings {
  size: number;
  quietZone: number;
  errorCorrection: QrErrorCorrectionLevel;
  foreground: string;
  background: string;
  transparent: boolean;
}

type Request =
  | { type: "init"; settings: RasterSettings; logo?: ArrayBuffer; logoType?: string }
  | { type: "generate"; id: number; payload: string };

let settings: RasterSettings | undefined;
let logo: ImageBitmap | undefined;

self.onmessage = async (event: MessageEvent<Request>) => {
  if (event.data.type === "init") {
    logo?.close();
    logo = undefined;
    settings = event.data.settings;
    try {
      if (event.data.logo) logo = await createImageBitmap(new Blob([event.data.logo], { type: event.data.logoType || "image/png" }));
      self.postMessage({ type: "ready" });
    } catch {
      self.postMessage({ type: "error", code: "LOGO" });
    }
    return;
  }

  const { id, payload } = event.data;
  if (!settings) {
    self.postMessage({ type: "result", id, ok: false, code: "NOT_READY" });
    return;
  }
  try {
    const bytes = await rasterize(payload, settings, logo);
    self.postMessage({ type: "result", id, ok: true, bytes }, [bytes]);
  } catch (error) {
    const code = error instanceof QrRasterError ? error.code : "ENCODE";
    self.postMessage({ type: "result", id, ok: false, code });
  }
};

async function rasterize(payload: string, options: RasterSettings, logoImage?: ImageBitmap) {
  let model;
  try {
    model = QRCode.create(payload, { errorCorrectionLevel: options.errorCorrection });
  } catch {
    throw new QrRasterError("ENCODE");
  }
  const size = Math.max(128, Math.min(2048, Math.round(options.size)));
  const modules = model.modules.size;
  const totalModules = modules + options.quietZone * 2;
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
  if (!context) throw new QrRasterError("CANVAS");
  context.clearRect(0, 0, size, size);
  if (!options.transparent) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, size, size);
  }
  context.fillStyle = options.foreground;
  for (let row = 0; row < modules; row += 1) {
    for (let column = 0; column < modules; column += 1) {
      if (!model.modules.get(row, column)) continue;
      const left = Math.round(((column + options.quietZone) / totalModules) * size);
      const top = Math.round(((row + options.quietZone) / totalModules) * size);
      const right = Math.round(((column + options.quietZone + 1) / totalModules) * size);
      const bottom = Math.round(((row + options.quietZone + 1) / totalModules) * size);
      context.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
    }
  }

  if (logoImage) drawLogo(context, logoImage, size);

  const image = context.getImageData(0, 0, size, size);
  const decoded = decodeQrImageData(options.transparent ? compositeQrImageDataOnWhite(image) : image);
  if (decoded !== payload) throw new QrRasterError("RESCAN");
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return blob.arrayBuffer();
}

function drawLogo(context: OffscreenCanvasRenderingContext2D, image: ImageBitmap, size: number) {
  const box = Math.floor(size * 0.22);
  const x = Math.floor((size - box) / 2);
  const padding = Math.max(4, Math.round(size * 0.0125));
  context.fillStyle = "#ffffff";
  context.fillRect(x - padding, x - padding, box + padding * 2, box + padding * 2);
  const sourceSize = Math.min(image.width, image.height);
  const sourceX = (image.width - sourceSize) / 2;
  const sourceY = (image.height - sourceSize) / 2;
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, x, x, box, box);
}

class QrRasterError extends Error {
  constructor(readonly code: "ENCODE" | "RESCAN" | "CANVAS") {
    super(code);
  }
}

export {};
