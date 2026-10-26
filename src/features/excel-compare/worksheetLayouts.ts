export const WORKSHEET_LAYOUTS=['split','threeColumns','full','left','right','top','bottom','horizontalSplit','verticalSplit','threeRows'] as const;
export type WorksheetLayout=typeof WORKSHEET_LAYOUTS[number];
export type WorksheetPane='left'|'right'|'changes';
/** Pane placement only. Worksheet contents and compare record identities are never transformed. */
export function worksheetLayout(layout:WorksheetLayout,full:WorksheetPane='changes',secondary:'left'|'right'='left',ratio=50){
 const bounded=Math.max(20,Math.min(80,Number.isFinite(ratio)?ratio:50));
 const configs:Record<WorksheetLayout,{panes:WorksheetPane[];areas:string;columns:string}>={
 split:{panes:['left','right'],areas:'"left right"',columns:'repeat(2,minmax(0,1fr))'},
 threeColumns:{panes:['left','right','changes'],areas:'"left right changes"',columns:'repeat(3,minmax(0,1fr))'},
 full:{panes:[full],areas:`"${full}"`,columns:'minmax(0,1fr)'},
 left:{panes:['changes','left','right'],areas:'"changes left" "changes right"',columns:'repeat(2,minmax(0,1fr))'},
 right:{panes:['left','right','changes'],areas:'"left changes" "right changes"',columns:'repeat(2,minmax(0,1fr))'},
 top:{panes:['changes','left','right'],areas:'"changes changes" "left right"',columns:'repeat(2,minmax(0,1fr))'},
 bottom:{panes:['left','right','changes'],areas:'"left right" "changes changes"',columns:'repeat(2,minmax(0,1fr))'},
 horizontalSplit:{panes:['changes',secondary],areas:`"changes ${secondary}"`,columns:`minmax(0,${bounded}fr) minmax(0,${100-bounded}fr)`},
 verticalSplit:{panes:['changes',secondary],areas:`"changes" "${secondary}"`,columns:'minmax(0,1fr)'},
 threeRows:{panes:['left','right','changes'],areas:'"left" "right" "changes"',columns:'minmax(0,1fr)'},
 };
 return {...configs[layout],ratio:bounded};
}
