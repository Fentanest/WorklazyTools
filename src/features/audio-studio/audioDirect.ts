export type AudioDirectPreset = { purpose: "trim" };
export function audioDirectDirty(s: { document: unknown; undoHistory: readonly unknown[]; redoHistory: readonly unknown[]; busy: boolean; decoding: boolean; lastResult: string }) { return Boolean(s.document) || s.undoHistory.length > 0 || s.redoHistory.length > 0 || s.busy || s.decoding || s.lastResult !== ""; }
