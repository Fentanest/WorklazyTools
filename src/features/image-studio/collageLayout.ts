import type { CollageOptions } from "./types";

export interface ImageDimensions { width: number; height: number }
export interface CollageCell { x: number; y: number; width: number; height: number }
export interface CollageLayout { width: number; height: number; cells: CollageCell[] }

export class CollageLayoutError extends Error {
  constructor(public readonly code: "COLLAGE_SIZE" | "COLLAGE_COLUMNS") {
    super(code);
  }
}

export function calculateCollageLayout(images: ImageDimensions[], options: CollageOptions): CollageLayout {
  const width = Math.max(1, Math.round(options.width));
  const gap = Math.max(0, Math.round(options.gap));
  if (options.layout === "vertical") {
    const heights = images.map((image) => Math.max(1, Math.round(image.height * width / image.width)));
    let y = 0;
    const cells = heights.map((height) => { const cell = { x: 0, y, width, height }; y += height + gap; return cell; });
    return { width, height: Math.max(1, y - gap), cells };
  }
  if (options.layout === "horizontal") {
    if (width - gap * (images.length - 1) < images.length) throw new CollageLayoutError("COLLAGE_SIZE");
    const cellWidth = Math.max(1, Math.floor((width - gap * (images.length - 1)) / images.length));
    const height = Math.max(1, ...images.map((image) => Math.max(1, Math.round(image.height * cellWidth / image.width))));
    return { width, height, cells: images.map((_, index) => ({ x: index * (cellWidth + gap), y: 0, width: cellWidth, height })) };
  }
  const columns = Math.max(1, Math.min(Math.round(options.columns), images.length));
  if (width - gap * (columns - 1) < columns) throw new CollageLayoutError("COLLAGE_COLUMNS");
  const rows = Math.ceil(images.length / columns);
  const cellWidth = Math.max(1, Math.floor((width - gap * (columns - 1)) / columns));
  const cellHeight = Math.max(1, Math.round(cellWidth * 0.75));
  return { width, height: rows * cellHeight + (rows - 1) * gap, cells: images.map((_, index) => ({ x: (index % columns) * (cellWidth + gap), y: Math.floor(index / columns) * (cellHeight + gap), width: cellWidth, height: cellHeight })) };
}
