// Shared intake contract. Keep this module independent of feature/page code.
const spreadsheets = ["xlsx", "xlsm", "xls", "xlsb", "csv"];
const images = ["jpg", "jpeg", "png", "webp"];
export const fileAccepts = {
  "excel-cleaner": { paths: ["/tools/excel-cleaner"], extensions: spreadsheets, max: 50, kind: "inspection" },
  "excel-merger": { paths: ["/tools/excel-merger"], extensions: spreadsheets, max: 50, kind: "inspection" },
  "document-generator": { paths: ["/tools/document-generator"], extensions: ["docx", "xlsx", "csv"], max: 50, kind: "inspection" },
  "image-privacy": { paths: ["/tools/image-privacy"], extensions: images, max: 50, kind: "selection" },
  "pdf-organize": { paths: ["/tools/pdf-editor", "/tools/pdf-editor/merge"], extensions: ["pdf"], max: 50, kind: "inspection" },
  "pdf-finish": { paths: ["/tools/pdf-editor/watermark"], extensions: ["pdf"], max: 50, kind: "inspection" },
  "image-edit": { paths: ["/tools/image-studio", "/tools/image-studio/resize", "/tools/image-studio/mosaic", "/tools/image-studio/watermark"], extensions: images, max: 1, kind: "inspection" },
  "image-batch": { paths: ["/tools/image-studio"], extensions: images, max: 50, kind: "selection" },
} as const;
export type ReceiverId = keyof typeof fileAccepts;
export function acceptsFile(receiverId: ReceiverId, file: File): boolean {
  return (fileAccepts[receiverId].extensions as readonly string[]).includes(file.name.split(".").pop()?.toLowerCase() ?? "");
}
