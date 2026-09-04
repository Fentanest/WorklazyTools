import jsQR from "jsqr";

export interface QrImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export function decodeQrImageData(image: QrImageData) {
  return jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" })?.data ?? "";
}

export function compositeQrImageDataOnWhite(image: QrImageData): QrImageData {
  const result = new Uint8ClampedArray(image.data.length);
  for (let index = 0; index < image.data.length; index += 4) {
    const alpha = image.data[index + 3] / 255;
    result[index] = Math.round(image.data[index] * alpha + 255 * (1 - alpha));
    result[index + 1] = Math.round(image.data[index + 1] * alpha + 255 * (1 - alpha));
    result[index + 2] = Math.round(image.data[index + 2] * alpha + 255 * (1 - alpha));
    result[index + 3] = 255;
  }
  return { data: result, width: image.width, height: image.height };
}
