export type OperationLogStatus = "running" | "success" | "error";

export interface OperationLogEntryValue {
  id: number;
  stageKey?: string;
  message: string;
  progress: number;
  elapsedMs: number;
  status: OperationLogStatus;
}

export function upsertOperationLogEntry(
  current: readonly OperationLogEntryValue[],
  next: OperationLogEntryValue,
) {
  if (next.stageKey) {
    const index = current.findIndex((entry) => entry.stageKey === next.stageKey);
    if (index >= 0) {
      const existing = current[index];
      return {
        logs: [...current.slice(0, index), { ...next, id: existing.id }, ...current.slice(index + 1)],
        activeLogId: existing.id,
      };
    }
  } else {
    const last = current.at(-1);
    if (last && !last.stageKey && last.message === next.message && last.status === next.status) {
      return {
        logs: [...current.slice(0, -1), { ...next, id: last.id }],
        activeLogId: last.id,
      };
    }
  }
  return { logs: [...current, next], activeLogId: next.id };
}

export function replaceOperationLogEntry(
  current: readonly OperationLogEntryValue[],
  activeLogId: number | undefined,
  update: Omit<OperationLogEntryValue, "id" | "stageKey">,
) {
  const index = current.findIndex((entry) => entry.id === activeLogId);
  if (index < 0) return [...current];
  return [...current.slice(0, index), { ...current[index], ...update }, ...current.slice(index + 1)];
}

export function normalizeMonotonicOperationProgress(previousProgress: number, nextProgress: number) {
  const previous = normalizeOperationProgress(previousProgress, 0);
  return Math.max(previous, normalizeOperationProgress(nextProgress, previous));
}

function normalizeOperationProgress(progress: number, fallback: number) {
  return Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : fallback;
}
