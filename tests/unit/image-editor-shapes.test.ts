import assert from "node:assert/strict";
import test from "node:test";

import { Path, Polygon, Rect, Triangle } from "fabric";

import {
  applyEditorShapeStyle,
  createEditorShape,
  getEditorShapeGeometry,
  getEditorShapeKind,
  getEditorShapeStyleCapabilities,
} from "../../src/features/image-studio/imageEditorShapes.ts";
import type { EditorShapeKind } from "../../src/features/image-studio/imageEditorTypes.ts";

const expandedShapes = [
  ["rounded-rect", Rect],
  ["triangle", Triangle],
  ["star", Polygon],
  ["hexagon", Polygon],
  ["speech-bubble", Path],
  ["arrow", Polygon],
  ["double-arrow", Polygon],
  ["highlighter", Rect],
] as const satisfies ReadonlyArray<readonly [EditorShapeKind, typeof Rect | typeof Triangle | typeof Polygon | typeof Path]>;

test("expanded editor shapes are single Fabric objects with serialized shape identity", () => {
  for (const [kind, Constructor] of expandedShapes) {
    const object = createEditorShape(kind, "#123456", 7);
    assert.ok(object instanceof Constructor, kind);
    assert.notEqual(object.type, "group", kind);
    assert.equal(getEditorShapeKind(object), kind);
    assert.equal((object.toJSON() as Record<string, unknown>).worklazyShapeKind, kind);
  }
});

test("shape style matrix applies supported values and ignores unsupported highlighter values", () => {
  for (const [kind] of expandedShapes) {
    const object = createEditorShape(kind, "#123456", 7);
    const capabilities = getEditorShapeStyleCapabilities(kind);
    assert.equal(applyEditorShapeStyle(object, "color", "#abcdef"), true, `${kind} fill`);
    assert.equal(object.fill, "#abcdef", `${kind} fill value`);

    const previousStroke = object.stroke;
    const previousWidth = object.strokeWidth;
    assert.equal(applyEditorShapeStyle(object, "stroke", "#010203"), capabilities.stroke, `${kind} stroke support`);
    assert.equal(object.stroke, capabilities.stroke ? "#010203" : previousStroke, `${kind} stroke value`);
    assert.equal(applyEditorShapeStyle(object, "width", 13), capabilities.strokeWidth, `${kind} width support`);
    assert.equal(object.strokeWidth, capabilities.strokeWidth ? 13 : previousWidth, `${kind} width value`);
  }

  const highlighter = createEditorShape("highlighter", "#123456", 7);
  applyEditorShapeStyle(highlighter, "stroke", "#000000");
  applyEditorShapeStyle(highlighter, "width", 30);
  assert.equal(highlighter.opacity, 0.45);
  assert.equal(highlighter.stroke, undefined);
  assert.equal(highlighter.strokeWidth, 0);
  assert.equal((highlighter.toJSON() as Record<string, unknown>).opacity, 0.45);
});

test("arrow border width never rewrites its fixed polygon geometry", () => {
  for (const kind of ["arrow", "double-arrow"] as const) {
    const object = createEditorShape(kind, "#123456", 4);
    const before = getEditorShapeGeometry(object);
    assert.equal(applyEditorShapeStyle(object, "width", 18), true);
    assert.equal(object.strokeWidth, 18);
    assert.equal(getEditorShapeGeometry(object), before, kind);
  }
});
