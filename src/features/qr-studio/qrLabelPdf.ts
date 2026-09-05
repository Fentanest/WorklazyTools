import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { QR_LABEL_PRESETS, qrLabelCell } from "./qrBulk.ts";

export interface QrLabelEntry {
  png: Blob;
  title: string;
  description: string;
}

export async function createQrLabelPdf(entries: QrLabelEntry[], preset: keyof typeof QR_LABEL_PRESETS, fontBytes: ArrayBuffer) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const font = await document.embedFont(fontBytes, { subset: false });
  const dimensions = QR_LABEL_PRESETS[preset];
  const pages: PDFPage[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const cell = qrLabelCell(index, preset);
    const page = pages[cell.page] ?? document.addPage([dimensions.width, dimensions.height]);
    pages[cell.page] = page;
    const image = await document.embedPng(await entries[index].png.arrayBuffer());
    const padding = 5;
    const textHeight = 27;
    const imageSize = Math.min(cell.width - padding * 2, cell.height - textHeight - padding * 2);
    const imageX = cell.x + (cell.width - imageSize) / 2;
    const imageY = cell.y + textHeight + padding;
    page.drawImage(image, { x: imageX, y: imageY, width: imageSize, height: imageSize });
    drawLabelCopy(page, font, entries[index].title, entries[index].description, cell.x + padding, cell.y + padding, cell.width - padding * 2);
  }
  return new Blob([await document.save()], { type: "application/pdf" });
}

function drawLabelCopy(page: PDFPage, font: PDFFont, title: string, description: string, x: number, y: number, maxWidth: number) {
  const titleSize = 6.5;
  const descriptionSize = 5.2;
  const safeTitle = fitLine(title, font, titleSize, maxWidth);
  if (safeTitle) page.drawText(safeTitle, { x, y: y + 16, size: titleSize, font, color: rgb(0.08, 0.08, 0.1) });
  const descriptionLines = wrapLines(description, font, descriptionSize, maxWidth, 2);
  descriptionLines.forEach((line, index) => page.drawText(line, {
    x,
    y: y + 8 - index * 7,
    size: descriptionSize,
    font,
    color: rgb(0.28, 0.28, 0.32),
  }));
}

function fitLine(value: string, font: PDFFont, size: number, maxWidth: number) {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized || font.widthOfTextAtSize(normalized, size) <= maxWidth) return normalized;
  const suffix = "…";
  let result = "";
  for (const character of normalized) {
    if (font.widthOfTextAtSize(result + character + suffix, size) > maxWidth) break;
    result += character;
  }
  return `${result}${suffix}`;
}

function wrapLines(value: string, font: PDFFont, size: number, maxWidth: number, limit: number) {
  const remaining = [...value.replace(/\s+/gu, " ").trim()];
  const lines: string[] = [];
  while (remaining.length && lines.length < limit) {
    let line = "";
    while (remaining.length && font.widthOfTextAtSize(line + remaining[0], size) <= maxWidth) line += remaining.shift();
    if (!line && remaining.length) line = remaining.shift() ?? "";
    if (lines.length === limit - 1 && remaining.length) line = fitLine(`${line}${remaining.join("")}`, font, size, maxWidth);
    lines.push(line.trim());
  }
  return lines.filter(Boolean);
}
