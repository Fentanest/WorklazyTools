export function normalizeMonotonicOperationProgress(previousProgress: number, nextProgress: number) {
  const previous = normalizeOperationProgress(previousProgress, 0);
  return Math.max(previous, normalizeOperationProgress(nextProgress, previous));
}

function normalizeOperationProgress(progress: number, fallback: number) {
  return Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : fallback;
}
