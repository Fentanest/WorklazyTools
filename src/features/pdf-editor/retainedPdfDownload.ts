/** A click owns its URL; React cleanup must not cancel a pending download. */
export function downloadRetainedPdf(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
