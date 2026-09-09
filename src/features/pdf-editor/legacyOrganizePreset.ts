export const LEGACY_ORGANIZE_PDF_PRESET = {
  watermarkCanvas: {
    font: "600 46px system-ui, sans-serif",
    minWidth: 420,
    maxWidth: 1_800,
    horizontalPadding: 80,
    height: 92,
    fillStyle: "rgba(30, 30, 34, .82)",
    utf16SliceUnits: 120,
  },
  watermarkPlacement: { pageWidthRatio: 0.72, imageWidthRatio: 0.55, rotation: -32, opacity: 0.2 },
  pageNumber: { size: 9, y: 12, color: [0.35, 0.35, 0.38] as const, opacity: 0.9 },
} as const;
