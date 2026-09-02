import type { Canvas, FabricObject } from "fabric";

import type { EditorAlignment } from "./imageEditorTypes";

type EditorLayerRole = "base" | "region-effect" | "crop-overlay" | string | undefined;

export interface EditorLayerObject extends FabricObject {
  worklazyRole?: EditorLayerRole;
}

export type EditorLayerDestination = "front" | "back" | { additionalIndex: number };

export function isEditorBase(object: FabricObject | undefined) {
  return Boolean(object && (object as EditorLayerObject).worklazyRole === "base");
}

export function isEditorRegionEffect(object: FabricObject | undefined) {
  return Boolean(object && (object as EditorLayerObject).worklazyRole === "region-effect");
}

export function isEditorOverlay(object: FabricObject | undefined) {
  return Boolean(object && (object as EditorLayerObject).worklazyRole === "crop-overlay");
}

export function isEditorAdditionalLayer(object: FabricObject | undefined, base?: FabricObject) {
  return Boolean(object && object !== base && !isEditorBase(object) && !isEditorRegionEffect(object) && !isEditorOverlay(object));
}

export function orderEditorLayerBlock<T>(objects: readonly T[], base: T | undefined, roleOf: (object: T) => EditorLayerRole) {
  const effects = objects.filter((object) => roleOf(object) === "region-effect");
  const overlays = objects.filter((object) => roleOf(object) === "crop-overlay");
  const additional = objects.filter((object) => object !== base && !effects.includes(object) && !overlays.includes(object));
  return [...(base && objects.includes(base) ? [base] : []), ...effects, ...additional, ...overlays];
}

export function enforceEditorLayerInvariant(instance: Canvas, base?: FabricObject) {
  const desired = orderEditorLayerBlock(instance.getObjects(), base, (object) => (object as EditorLayerObject).worklazyRole);
  if (base) {
    desired.forEach((object) => {
      if (isEditorRegionEffect(object) && object.visible !== base.visible) object.set("visible", base.visible);
    });
  }
  applyEditorObjectOrder(instance, desired);
  return desired;
}

export function moveEditorLayer(instance: Canvas, base: FabricObject | undefined, object: FabricObject, destination: EditorLayerDestination) {
  const ordered = enforceEditorLayerInvariant(instance, base);
  if (!isEditorAdditionalLayer(object, base)) return false;
  const block = ordered.filter((candidate) => candidate === base || isEditorRegionEffect(candidate));
  const overlays = ordered.filter(isEditorOverlay);
  const additional = ordered.filter((candidate) => isEditorAdditionalLayer(candidate, base));
  const previousIndex = additional.indexOf(object);
  if (previousIndex < 0) return false;
  additional.splice(previousIndex, 1);
  const requestedIndex = destination === "back"
    ? 0
    : destination === "front" ? additional.length : destination.additionalIndex;
  const nextIndex = Math.max(0, Math.min(additional.length, requestedIndex));
  additional.splice(nextIndex, 0, object);
  if (previousIndex === nextIndex) return false;
  applyEditorObjectOrder(instance, [...block, ...additional, ...overlays]);
  return true;
}

export function alignEditorObjects(objects: readonly FabricObject[], alignment: EditorAlignment) {
  if (objects.length < 2) return false;
  const bounds = objects.map((object) => object.getBoundingRect());
  const selection = bounds.reduce((result, bound) => ({
    left: Math.min(result.left, bound.left),
    top: Math.min(result.top, bound.top),
    right: Math.max(result.right, bound.left + bound.width),
    bottom: Math.max(result.bottom, bound.top + bound.height),
  }), { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY });
  const horizontalCenter = (selection.left + selection.right) / 2;
  const verticalCenter = (selection.top + selection.bottom) / 2;
  objects.forEach((object, index) => {
    const bound = bounds[index];
    const deltaX = alignment === "left"
      ? selection.left - bound.left
      : alignment === "center-horizontal" ? horizontalCenter - (bound.left + bound.width / 2)
        : alignment === "right" ? selection.right - (bound.left + bound.width) : 0;
    const deltaY = alignment === "top"
      ? selection.top - bound.top
      : alignment === "center-vertical" ? verticalCenter - (bound.top + bound.height / 2)
        : alignment === "bottom" ? selection.bottom - (bound.top + bound.height) : 0;
    object.set({ left: object.left + deltaX, top: object.top + deltaY });
    object.setCoords();
  });
  return true;
}

function applyEditorObjectOrder(instance: Canvas, desired: readonly FabricObject[]) {
  desired.forEach((object, index) => {
    if (instance.getObjects()[index] !== object) instance.moveObjectTo(object, index);
  });
}
