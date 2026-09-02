export type EditorInteractionMode = "select" | "pencil" | "brush" | "erase" | "crop" | "effect";
export type EditorDrawTool = Extract<EditorInteractionMode, "pencil" | "brush" | "erase">;
export type EditorPanelName = "select" | "crop" | "effect" | "draw" | "text" | "shapes" | "stickers" | "canvas";
export type RegionEffect = "mosaic" | "blur";
export type EditorShapeKind = "line" | "circle" | "rounded-rect" | "triangle" | "star" | "hexagon" | "speech-bubble" | "arrow" | "double-arrow" | "highlighter";

export type EditorSelectionKind = "none" | "base" | "text" | "line" | "shape" | "drawing" | "sticker";

export interface EditorSelectionState {
  kind: EditorSelectionKind;
  color: string;
  strokeColor: string;
  width: number;
  colorEnabled: boolean;
  strokeColorEnabled: boolean;
  widthEnabled: boolean;
  isBase: boolean;
  shapeKind?: EditorShapeKind;
  geometry?: string;
  opacity?: number;
}

export interface EditorMinibarPosition {
  left: number;
  top: number;
}

export const EMPTY_EDITOR_SELECTION: EditorSelectionState = {
  kind: "none",
  color: "#1d1d1f",
  strokeColor: "#ffffff",
  width: 0,
  colorEnabled: false,
  strokeColorEnabled: false,
  widthEnabled: false,
  isBase: false,
};
