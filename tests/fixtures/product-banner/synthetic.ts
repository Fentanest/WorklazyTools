import * as XLSX from "xlsx";

export const headers = ["ProductId", "Image Url", "Video Url", "Product Desc", "Origin Price", "Discount Price", "Discount", "Currency", "Direct linking commission rate (%)", "Estimated direct linking commission", "Indirect linking commission rate (%)", "Estimated indirect linking commission", "Sales180Day", "Positive Feedback", "Promotion Url", "Code Name", "Code Start Time", "Code End Time", "Code Value", "Code Quantity", "Code Minimum Spend"];
export function syntheticRow(index: number): (string | number)[] {
  return [`100000000000000${index}`, `https://example.com/img/${index}.jpg`, index === 1 ? "https://example.com/video/1" : "", `합성 상품 ${index}, \"이름\"\n설명`, "USD 282.87", "USD 206.50", "27%", "USD", "99%", "88.88", "77%", "66.66", 100, "98%", `https://example.com/p/${index}?aff=test&x=1`, "SYNTHETIC", "", "", "50%", 2, 1];
}
export function syntheticBytes(format: "biff8" | "xlsx", rows: unknown[][] = [headers, ...[1, 2, 3].map(syntheticRow)], extraSheets: unknown[][][] = []): ArrayBuffer {
  const book = XLSX.utils.book_new();
  [rows, ...extraSheets].forEach((data, i) => XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(data), `Synthetic ${i + 1}`));
  const bytes = XLSX.write(book, { type: "array", bookType: format }) as ArrayBuffer;
  return bytes;
}
export const utf8 = (value: string) => new TextEncoder().encode(value).buffer;
