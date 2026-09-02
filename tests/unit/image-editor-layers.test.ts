import assert from "node:assert/strict";
import test from "node:test";

import { Rect, type Canvas, type FabricObject } from "fabric";

import { alignEditorObjects, enforceEditorLayerInvariant, moveEditorLayer, orderEditorLayerBlock } from "../../src/features/image-studio/imageEditorLayers.ts";
import type { EditorAlignment } from "../../src/features/image-studio/imageEditorTypes.ts";

test("base and effect layers form a fixed lowest block", () => {
  const base = taggedRect("base");
  const firstEffect = taggedRect("region-effect");
  const secondEffect = taggedRect("region-effect");
  const text = taggedRect();
  const shape = taggedRect();
  const overlay = taggedRect("crop-overlay");
  assert.deepEqual(
    orderEditorLayerBlock([shape, firstEffect, overlay, base, text, secondEffect], base, (object) => object.worklazyRole),
    [base, firstEffect, secondEffect, shape, text, overlay],
  );

  base.visible = false;
  const canvas = mockCanvas([shape, firstEffect, base, text, secondEffect, overlay]);
  enforceEditorLayerInvariant(canvas, base);
  assert.deepEqual(canvas.getObjects(), [base, firstEffect, secondEffect, shape, text, overlay]);
  assert.equal(firstEffect.visible, false);
  assert.equal(secondEffect.visible, false);
});

test("front, back and indexed layer moves all clamp above the base block", () => {
  const base = taggedRect("base");
  const effect = taggedRect("region-effect");
  const first = taggedRect();
  const second = taggedRect();
  const third = taggedRect();
  const canvas = mockCanvas([base, effect, first, second, third]);

  assert.equal(moveEditorLayer(canvas, base, third, "back"), true);
  assert.deepEqual(canvas.getObjects(), [base, effect, third, first, second]);
  assert.equal(moveEditorLayer(canvas, base, third, "front"), true);
  assert.deepEqual(canvas.getObjects(), [base, effect, first, second, third]);
  assert.equal(moveEditorLayer(canvas, base, third, { additionalIndex: 1 }), true);
  assert.deepEqual(canvas.getObjects(), [base, effect, first, third, second]);
  assert.equal(moveEditorLayer(canvas, base, base, "front"), false);
  assert.equal(moveEditorLayer(canvas, base, effect, "front"), false);
  assert.deepEqual(canvas.getObjects().slice(0, 2), [base, effect]);
});

test("six alignments use scene bounding boxes for rotated and scaled objects", () => {
  const alignments: EditorAlignment[] = ["left", "center-horizontal", "right", "top", "center-vertical", "bottom"];
  for (const alignment of alignments) {
    const first = new Rect({ left: 80, top: 90, width: 70, height: 35, angle: 27, scaleX: 1.4, scaleY: 0.8 });
    const second = new Rect({ left: 260, top: 220, width: 45, height: 90, angle: -18, scaleX: 0.75, scaleY: 1.6 });
    first.setCoords();
    second.setCoords();
    assert.equal(alignEditorObjects([first, second], alignment), true);
    const [a, b] = [first.getBoundingRect(), second.getBoundingRect()];
    const values = alignment === "left" ? [a.left, b.left]
      : alignment === "center-horizontal" ? [a.left + a.width / 2, b.left + b.width / 2]
        : alignment === "right" ? [a.left + a.width, b.left + b.width]
          : alignment === "top" ? [a.top, b.top]
            : alignment === "center-vertical" ? [a.top + a.height / 2, b.top + b.height / 2]
              : [a.top + a.height, b.top + b.height];
    assert.ok(Math.abs(values[0] - values[1]) < 1e-7, `${alignment}: ${values.join(" / ")}`);
  }
});

type TaggedRect = Rect & { worklazyRole?: "base" | "region-effect" | "crop-overlay" };

function taggedRect(worklazyRole?: TaggedRect["worklazyRole"]) {
  const object = new Rect({ width: 10, height: 10 }) as TaggedRect;
  object.worklazyRole = worklazyRole;
  return object;
}

function mockCanvas(initial: FabricObject[]) {
  const objects = [...initial];
  return {
    getObjects: () => [...objects],
    moveObjectTo: (object: FabricObject, index: number) => {
      const previous = objects.indexOf(object);
      if (previous < 0 || previous === index) return false;
      objects.splice(previous, 1);
      objects.splice(index, 0, object);
      return true;
    },
  } as unknown as Canvas;
}
