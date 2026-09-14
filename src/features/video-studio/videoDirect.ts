export type VideoDirectPreset =
 | { purpose: "trim"; allGroupsOneFile: false; outputMode: "individual"; outputFormat: "mp4"; audioMode: "copy" }
 | { purpose: "merge"; allGroupsOneFile: true; outputMode: "individual"; outputFormat: "mp4"; audioMode: "copy" }
 | { purpose: "extract-audio"; allGroupsOneFile: false; outputMode: "individual"; outputFormat: "mp3"; audioMode: "copy" };
export function videoDirectDirty(s: { items: readonly unknown[]; status: string; probing: boolean; outputs: readonly unknown[] }) { return s.items.length > 0 || s.status === "running" || s.probing || s.outputs.length > 0; }
