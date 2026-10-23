export declare const VIDEO_STUDIO_PUBLIC: boolean;
export declare const COMPARISON_PORT_PUBLIC: boolean;
export declare const COMPARISON_TOOL_IDS: readonly string[];
export declare function isComparisonToolPublished(id:string,enabled?:boolean):boolean;
export declare function comparisonToolForPath(pathname:string):string|null;
export declare function isComparisonPathPublished(pathname:string,enabled?:boolean):boolean;
