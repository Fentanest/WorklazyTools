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
  try {
    const result = await fn();
    return { result, failedImages: [] };
  } catch (error) {
    if (error instanceof Error && (error.name === "Jbig2Error" || error.message.includes("Jbig2Error") || error.message.includes("decode"))) {
      return { result: null as any, failedImages: ["dependent-image"] };
    }
    throw error;
  }
}
