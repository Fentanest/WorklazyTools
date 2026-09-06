export interface TilePlacement {
  x: number;
  y: number;
  rotation: number;
}

export interface TileLayoutInput {
  pageWidth: number;
  pageHeight: number;
  tileWidth: number;
  tileHeight: number;
  gap: number;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
}

const MAXIMUM_TILES_PER_PAGE = 400 as const;

type AssertTrue<Condition extends true> = Condition;
type TileLayoutInputHasNoLimitOverride = AssertTrue<"maximumTiles" extends keyof TileLayoutInput ? false : true>;

export type TileLayoutResult =
  | { ok: true; count: number; placements: TilePlacement[] }
  | { ok: false; error: "invalid-geometry" | "tile-limit"; count?: number; maximumTiles: typeof MAXIMUM_TILES_PER_PAGE };

export function createTilePlacements(input: TileLayoutInput): TileLayoutResult {
  const values = [input.pageWidth, input.pageHeight, input.tileWidth, input.tileHeight, input.gap, input.offsetX ?? 0, input.offsetY ?? 0, input.rotation ?? 0];
  if (values.some((value) => !Number.isFinite(value))
      || input.pageWidth <= 0
      || input.pageHeight <= 0
      || input.tileWidth <= 0
      || input.tileHeight <= 0
      || input.gap < 0) {
    return { ok: false, error: "invalid-geometry", maximumTiles: MAXIMUM_TILES_PER_PAGE };
  }
  const stepX = input.tileWidth + input.gap;
  const stepY = input.tileHeight + input.gap;
  const offsetX = input.offsetX ?? 0;
  const offsetY = input.offsetY ?? 0;
  const columns = offsetX >= input.pageWidth ? 0 : Math.ceil((input.pageWidth - offsetX) / stepX);
  const rows = offsetY >= input.pageHeight ? 0 : Math.ceil((input.pageHeight - offsetY) / stepY);
  const count = Math.max(0, columns) * Math.max(0, rows);
  if (!Number.isSafeInteger(count)) return { ok: false, error: "invalid-geometry", maximumTiles: MAXIMUM_TILES_PER_PAGE };
  if (count > MAXIMUM_TILES_PER_PAGE) {
    return { ok: false, error: "tile-limit", count, maximumTiles: MAXIMUM_TILES_PER_PAGE };
  }
  const placements: TilePlacement[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      placements.push({
        x: offsetX + column * stepX,
        y: offsetY + row * stepY,
        rotation: input.rotation ?? 0,
      });
    }
  }
  return { ok: true, count, placements };
}
