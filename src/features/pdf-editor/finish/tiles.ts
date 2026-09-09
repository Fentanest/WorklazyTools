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
  | { ok: false; error: "invalid-geometry" | "empty-placement" | "tile-limit"; count?: number; maximumTiles: typeof MAXIMUM_TILES_PER_PAGE };

function visibleAxis(pageSize: number, tileSize: number, step: number, offset: number) {
  const first = Math.max(0, Math.floor((-offset - tileSize) / step) + 1);
  const end = Math.max(first, Math.ceil((pageSize - offset) / step));
  return { first, count: end - first };
}

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
  const columns = visibleAxis(input.pageWidth, input.tileWidth, stepX, offsetX);
  const rows = visibleAxis(input.pageHeight, input.tileHeight, stepY, offsetY);
  const count = columns.count * rows.count;
  if (!Number.isSafeInteger(count)) return { ok: false, error: "invalid-geometry", maximumTiles: MAXIMUM_TILES_PER_PAGE };
  if (count === 0) return { ok: false, error: "empty-placement", count, maximumTiles: MAXIMUM_TILES_PER_PAGE };
  if (count > MAXIMUM_TILES_PER_PAGE) {
    return { ok: false, error: "tile-limit", count, maximumTiles: MAXIMUM_TILES_PER_PAGE };
  }
  const placements: TilePlacement[] = [];
  for (let row = rows.first; row < rows.first + rows.count; row += 1) {
    for (let column = columns.first; column < columns.first + columns.count; column += 1) {
      placements.push({
        x: offsetX + column * stepX,
        y: offsetY + row * stepY,
        rotation: input.rotation ?? 0,
      });
    }
  }
  return { ok: true, count, placements };
}
