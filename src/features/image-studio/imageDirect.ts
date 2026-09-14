export type ImageDirectPreset =
 | { purpose: "resize"; tab: "editor"; panel: "size"; interactionMode: "select" }
 | { purpose: "mosaic"; tab: "editor"; panel: "effect"; interactionMode: "effect"; regionEffect: "mosaic" }
 | { purpose: "watermark"; tab: "editor"; panel: "text"; interactionMode: "select"; text: "" };
export function imageDirectDirty(s: { file: unknown; historyLength: number; emptyReadyHistoryLength: number; regionEffectBusy: boolean; stickerBusy: boolean; status: string; result: unknown; otherTabHasInput: boolean; otherTabHasResult: boolean; otherTabRunning: boolean }) { return Boolean(s.file) || s.historyLength > s.emptyReadyHistoryLength || s.regionEffectBusy || s.stickerBusy || s.status === "running" || Boolean(s.result) || s.otherTabHasInput || s.otherTabHasResult || s.otherTabRunning; }
