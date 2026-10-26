import { selectWorkingResolution } from "./memory.ts";
import { IMAGE_LIMITS, type Matrix, type Transform } from "./types.ts";

export function validateDimensions(width: number, height: number, output = false) {
  if (![width, height].every((v) => Number.isInteger(v) && v > 0 && v <= IMAGE_LIMITS.dimension) || width * height > (output ? IMAGE_LIMITS.outputPixels : IMAGE_LIMITS.sourcePixels)) throw new Error("IMAGE_SIZE_LIMIT");
}
export function transformMatrix(width: number, height: number, transform: Transform): Matrix {
  const scaleY = transform.scaleY ?? transform.scale;
  if (![transform.x, transform.y, transform.degrees, transform.scale, scaleY].every(Number.isFinite) || [transform.scale, scaleY].some(value => value < 0.05 || value > 20)) throw new Error("INVALID_TRANSFORM");
  const angle = transform.degrees * Math.PI / 180;
  const sx = transform.scale * (transform.flipX ? -1 : 1), sy = scaleY * (transform.flipY ? -1 : 1);
  const a = Math.cos(angle) * sx, b = Math.sin(angle) * sx, c = -Math.sin(angle) * sy, d = Math.cos(angle) * sy;
  return [a, b, c, d, transform.x + width / 2 - a * width / 2 - c * height / 2, transform.y + height / 2 - b * width / 2 - d * height / 2].map((value) => Math.abs(value - Math.round(value)) < 1e-10 ? Math.round(value) || 0 : value) as Matrix;
}
export function applyMatrix(matrix: Matrix, x: number, y: number) { return { x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5] }; }
export function inverseMatrix([a, b, c, d, x, y]: Matrix): Matrix {
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-10) throw new Error("INVALID_TRANSFORM");
  return [d / determinant, -b / determinant, -c / determinant, a / determinant, (c * y - d * x) / determinant, (b * x - a * y) / determinant];
}
export function workingGeometry(leftWidth: number, leftHeight: number, rightWidth: number, rightHeight: number, transform: Transform, encodedBytes = 0, previousViewBytes = 0) {
  validateDimensions(leftWidth, leftHeight); validateDimensions(rightWidth, rightHeight);
  const rightMatrix = transformMatrix(rightWidth, rightHeight, transform);
  const points = [[0, 0], [rightWidth, 0], [rightWidth, rightHeight], [0, rightHeight]].map(([x, y]) => applyMatrix(rightMatrix, x, y));
  const originX = Math.floor(Math.min(0, ...points.map((p) => p.x))), originY = Math.floor(Math.min(0, ...points.map((p) => p.y)));
  const width = Math.ceil(Math.max(leftWidth, ...points.map((p) => p.x))) - originX;
  const height = Math.ceil(Math.max(leftHeight, ...points.map((p) => p.y))) - originY;
  if(![width,height].every(v=>Number.isSafeInteger(v)&&v>0&&v<=160000))throw new Error('IMAGE_SIZE_LIMIT');
  const working=selectWorkingResolution(leftWidth*leftHeight+rightWidth*rightHeight,width,height,encodedBytes,previousViewBytes);
  rightMatrix[4] -= originX; rightMatrix[5] -= originY;
  const scale=working.scale;
  return { ...working, originalWidth:width,originalHeight:height,originX,originY,leftMatrix:[scale,0,0,scale,(-originX||0)*scale,(-originY||0)*scale] as Matrix,rightMatrix:rightMatrix.map(v=>v*scale) as Matrix };
}

export function sourcePolygon(matrix: Matrix, bounds: { x: number; y: number; width: number; height: number }) {
  const inverse = inverseMatrix(matrix);
  return [[bounds.x, bounds.y], [bounds.x + bounds.width, bounds.y], [bounds.x + bounds.width, bounds.y + bounds.height], [bounds.x, bounds.y + bounds.height]].map(([x, y]) => applyMatrix(inverse, x, y));
}
