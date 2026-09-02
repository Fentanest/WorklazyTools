import { Circle, FabricObject, Line, Path, Polygon, Rect, Triangle } from "fabric";

import type { EditorShapeKind } from "./imageEditorTypes";

export interface EditorShapeStyleCapabilities {
  fill: boolean;
  stroke: boolean;
  strokeWidth: boolean;
}

export type EditorShapeObject = FabricObject & { worklazyShapeKind?: EditorShapeKind };

const SHAPE_KINDS = new Set<EditorShapeKind>([
  "line", "circle", "rounded-rect", "triangle", "star", "hexagon", "speech-bubble", "arrow", "double-arrow", "highlighter",
]);

if (!FabricObject.customProperties.includes("worklazyShapeKind")) FabricObject.customProperties.push("worklazyShapeKind");

export function createEditorShape(kind: EditorShapeKind, color: string, width: number): FabricObject {
  const common = { left: 120, top: 120, strokeLineJoin: "round" as const };
  let object: FabricObject;
  switch (kind) {
    case "line":
      object = new Line([130, 150, 430, 300], { stroke: color, strokeWidth: width, strokeLineCap: "round" });
      break;
    case "circle":
      object = new Circle({ ...common, radius: 90, fill: "#ff375f", stroke: "#ffffff", strokeWidth: 2 });
      break;
    case "rounded-rect":
      object = new Rect({ ...common, width: 220, height: 140, rx: 24, ry: 24, fill: "#0a84ff", stroke: "#ffffff", strokeWidth: 2 });
      break;
    case "triangle":
      object = new Triangle({ ...common, width: 200, height: 174, fill: "#34c759", stroke: "#ffffff", strokeWidth: 2 });
      break;
    case "star":
      object = new Polygon(radialPoints(10, 100, 46, -Math.PI / 2), { ...common, fill: "#ffd60a", stroke: "#ffffff", strokeWidth: 2 });
      break;
    case "hexagon":
      object = new Polygon(radialPoints(6, 100, 100, 0), { ...common, fill: "#af52de", stroke: "#ffffff", strokeWidth: 2 });
      break;
    case "speech-bubble":
      object = new Path("M 12 12 H 208 Q 228 12 228 32 V 112 Q 228 132 208 132 H 88 L 48 170 L 55 132 H 32 Q 12 132 12 112 V 32 Q 12 12 32 12 Z", {
        ...common,
        fill: "#64d2ff",
        stroke: "#ffffff",
        strokeWidth: 2,
      });
      break;
    case "arrow":
      object = new Polygon([
        { x: 0, y: 45 }, { x: 140, y: 45 }, { x: 140, y: 10 }, { x: 220, y: 70 },
        { x: 140, y: 130 }, { x: 140, y: 95 }, { x: 0, y: 95 },
      ], { ...common, fill: "#ff9f0a", stroke: "#ffffff", strokeWidth: 2 });
      break;
    case "double-arrow":
      object = new Polygon([
        { x: 0, y: 70 }, { x: 70, y: 10 }, { x: 70, y: 45 }, { x: 150, y: 45 }, { x: 150, y: 10 },
        { x: 220, y: 70 }, { x: 150, y: 130 }, { x: 150, y: 95 }, { x: 70, y: 95 }, { x: 70, y: 130 },
      ], { ...common, fill: "#ff453a", stroke: "#ffffff", strokeWidth: 2 });
      break;
    case "highlighter":
      object = new Rect({ left: 100, top: 160, width: 300, height: 44, fill: "#ffd60a", stroke: undefined, strokeWidth: 0, opacity: 0.45 });
      break;
  }
  (object as EditorShapeObject).worklazyShapeKind = kind;
  return object;
}

export function getEditorShapeKind(object: FabricObject): EditorShapeKind | undefined {
  const kind = (object as EditorShapeObject).worklazyShapeKind;
  return kind && SHAPE_KINDS.has(kind) ? kind : undefined;
}

export function getEditorShapeStyleCapabilities(kind: EditorShapeKind): EditorShapeStyleCapabilities {
  if (kind === "highlighter") return { fill: true, stroke: false, strokeWidth: false };
  if (kind === "line") return { fill: false, stroke: true, strokeWidth: true };
  return { fill: true, stroke: true, strokeWidth: true };
}

export function applyEditorShapeStyle(object: FabricObject, property: "color" | "stroke" | "width", value: string | number) {
  const kind = getEditorShapeKind(object);
  if (!kind) return false;
  const capabilities = getEditorShapeStyleCapabilities(kind);
  if (kind === "highlighter") object.set({ opacity: 0.45, stroke: undefined, strokeWidth: 0 });
  if (property === "color") {
    if (capabilities.fill) object.set("fill", value);
    else if (capabilities.stroke) object.set("stroke", value);
    else return false;
    return true;
  }
  if (property === "stroke" && capabilities.stroke) {
    object.set("stroke", value);
    return true;
  }
  if (property === "width" && capabilities.strokeWidth) {
    object.set("strokeWidth", value);
    return true;
  }
  return false;
}

export function getEditorShapeGeometry(object: FabricObject) {
  const points = object instanceof Polygon
    ? object.points.map(({ x, y }) => [roundGeometry(x), roundGeometry(y)])
    : undefined;
  return JSON.stringify({
    width: roundGeometry(object.width),
    height: roundGeometry(object.height),
    ...(points ? { points } : {}),
  });
}

function radialPoints(count: number, outerRadius: number, innerRadius: number, startAngle: number) {
  return Array.from({ length: count }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = startAngle + index * Math.PI * 2 / count;
    return { x: outerRadius + Math.cos(angle) * radius, y: outerRadius + Math.sin(angle) * radius };
  });
}

function roundGeometry(value: number) {
  return Math.round(value * 1_000) / 1_000;
}
