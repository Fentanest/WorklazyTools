export function normalizeOutputName(value: string, fallback: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-") || fallback;
}

export function finishOutputName(
  sourceName: string,
  locale: string,
  copy?: { suffix: string; fallback: string },
) {
  const korean = locale.toLowerCase().startsWith("ko");
  const suffix = normalizeOutputName(copy?.suffix ?? (korean ? "마무리" : "finished"), korean ? "마무리" : "finished")
    .replace(/(?:\.pdf)+$/iu, "");
  const fallback = normalizeOutputName(copy?.fallback ?? (korean ? "Worklazy-PDF-마무리" : "Worklazy-PDF-finished"), "Worklazy-PDF")
    .replace(/(?:\.pdf)+$/iu, "");
  const base = normalizeOutputName(sourceName, "")
    .replace(/(?:\.pdf)+$/iu, "")
    .replace(/(?:-(?:finished|마무리))+$/iu, "");
  return `${base ? `${base}-${suffix}` : fallback}.pdf`;
}
