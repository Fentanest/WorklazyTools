// Shared by the browser catalog/router and Node static/vendor generators.
export const VIDEO_STUDIO_PUBLIC = false;

// Static rollback: WORKLAZY_COMPARISON_PORT=off npm run build.
// The affected document tool closes as one unit; screen and DOCX never use different engines.
export const COMPARISON_TOOL_IDS=Object.freeze(['text-compare','image-compare','folder-compare','document-compare','excel-compare','pdf-compare']);
export const COMPARISON_PORT_PUBLIC=typeof __COMPARISON_PORT_PUBLIC__!=='undefined'
  ? __COMPARISON_PORT_PUBLIC__ : !(typeof process!=='undefined'&&process.env.WORKLAZY_COMPARISON_PORT==='off');
export function isComparisonToolPublished(id,enabled=COMPARISON_PORT_PUBLIC){return enabled||!COMPARISON_TOOL_IDS.includes(id);}
export function comparisonToolForPath(pathname){
 const parts=pathname.split('/').filter(Boolean);if(parts[0]==='ko'||parts[0]==='en')parts.shift();if(parts[0]==='tools')parts.shift();
 const id=['word-compare','hwp-compare'].includes(parts[0])?'document-compare':parts[0];return COMPARISON_TOOL_IDS.includes(id)?id:null;
}
export function isComparisonPathPublished(pathname,enabled=COMPARISON_PORT_PUBLIC){const id=comparisonToolForPath(pathname);return id===null||isComparisonToolPublished(id,enabled);}
