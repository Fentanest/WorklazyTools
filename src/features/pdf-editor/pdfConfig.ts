export const PDF_JS_VERSION = "6.2.108";

export const getPdfWorkerOptions = () => ({
  cMapUrl: `/vendor/pdfjs/${PDF_JS_VERSION}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `/vendor/pdfjs/${PDF_JS_VERSION}/standard_fonts/`,
  wasmUrl: `/vendor/pdfjs/${PDF_JS_VERSION}/wasm/`,
  enableXfa: true,
  useSystemFonts: true,
});

/**
 * Intercepts console.warn during a callback to detect PDF.js image decode
 * failures. PDF.js 6.x silently warns and paints nothing when CCITT/JBIG2/
 * JPEG2000 image decoding fails (e.g. missing wasm). This utility captures
 * those warnings so callers can surface a real error instead of silently
 * delivering a blank image.
 *
 * Returns the list of failed image object IDs (e.g. "img_p0_1").
 */
export async function withImageDecodeCheck<T>(fn: () => Promise<T>): Promise<{ result: T; failedImages: string[] }> {
  const failedImages: string[] = [];
  const origWarn = console.warn;

  console.warn = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    // PDF.js main thread emits "Warning: Dependent image isn't ready yet"
    // when a CCITT/JBIG2/JPEG2000 image object failed to decode in the worker.
    // It also forwards "Warning: Unable to decode image ..." from the worker.
    if (msg.includes("Dependent image isn't ready yet")) {
      failedImages.push("dependent-image");
    }
    const decodeMatch = msg.match(/Unable to decode image "([^"]+)"/);
    if (decodeMatch) failedImages.push(decodeMatch[1]);
    origWarn.apply(console, args);
  };

  try {
    const result = await fn();
    return { result, failedImages };
  } finally {
    console.warn = origWarn;
  }
}
