import { seoByPath, toolSlugByPath } from "./seo.ts";
import { stripLanguagePrefix } from "../i18n/languages.ts";
import { VIDEO_STUDIO_PUBLIC, isComparisonToolPublished, isComparisonPathPublished } from "./publicServiceConfig.mjs";
import { withSiteBasePath } from "./siteBasePath.ts";
import { parseCalendarSelection } from "../features/market-calendar/calendarSelection.ts";

// One publication decision is consumed by the catalog, router, static generator and tracking.
// The implementation remains in src/features/video-studio for a later reactivation.
export { VIDEO_STUDIO_PUBLIC };

export function isVideoUnavailablePath(pathname: string) {
  const path = stripLanguagePrefix(pathname).replace(/\/+$/, "") || "/";
  return /^\/(?:tools\/)?video-studio(?:\/|$)/.test(path);
}

export function isToolPublished(id: string) {
  return (id !== "video-studio" || VIDEO_STUDIO_PUBLIC) && isComparisonToolPublished(id);
}

export type DocumentReadiness = "ready" | "navigation" | "isolation-pending" | "unavailable";

export function documentReadiness(
  pathname: string,
  markers: { redactor: boolean; office: boolean; excel: boolean },
  isolated: boolean,
  search = "",
  controllerScriptUrl = "",
  baseUrl = "/",
): DocumentReadiness {
  if (isVideoUnavailablePath(pathname)) return "unavailable";
  const path = stripLanguagePrefix(pathname).replace(/\/+$/, "") || "/";
  const redactor = path === "/tools/document-redactor";
  const office = path === "/tools/office-editor/app" || path === "/tools/pdf-converter/document-to-pdf";
  const excel = path === "/tools/excel-merger/xls-preserve";
  if (path === "/tools/office-editor" && new URLSearchParams(search).get("guide") !== "1") return "navigation";
  if (redactor !== markers.redactor || office !== markers.office || excel !== markers.excel) return "navigation";
  if (office || excel) {
    const expectedWorkerPath = `${withSiteBasePath(pathname, baseUrl).replace(/\/+$/, "")}/coi-serviceworker.js`;
    let ownsDocument = false;
    try {
      const controllerPath = new URL(controllerScriptUrl).pathname;
      // A workspace reached from the main SPA may already be isolated by the
      // root worker. Direct entry instead uses the workspace-scoped worker.
      ownsDocument = controllerPath === expectedWorkerPath || controllerPath === withSiteBasePath("/service-worker.js", baseUrl);
    } catch { /* Uncontrolled bootstrap document. */ }
    if (!isolated || !ownsDocument) return "isolation-pending";
  }
  return isKnownPublicPath(path) ? "ready" : "unavailable";
}

const ordinaryPages = new Set(["/", "/tools", "/about", "/privacy", "/terms", "/contact", "/licenses", "/error"]);
const workspacePages = new Set(["/tools/office-editor/app", "/tools/excel-merger/xls-preserve"]);
export const toolFilterValues = {
  category: ["spreadsheets", "documents", "media", "text-data", "work", "security-share", "investment-research"],
  from: ["pdf", "image", "spreadsheet", "document", "hwp", "text", "audio"],
  do: ["cut", "merge", "convert", "clean", "compare", "protect", "create"],
} as const;

/** Strict decoding, duplicate rejection and fixed ordering before SDK eligibility. */
export function normalizeToolsSearch(search: string): string {
  const entries = new Map<string, string[]>();
  for (const part of search.replace(/^\?/, "").split("&")) {
    const equal = part.indexOf("=");
    try {
      const key = decodeURIComponent((equal < 0 ? part : part.slice(0, equal)).replace(/\+/g, " "));
      entries.set(key, [...(entries.get(key) ?? []), equal < 0 ? "" : part.slice(equal + 1)]);
    } catch { /* Malformed keys are discarded, never repaired by URLSearchParams. */ }
  }
  const result = new URLSearchParams();
  for (const key of ["category", "from", "do"] as const) {
    const values = entries.get(key);
    if (values?.length !== 1) continue;
    try {
      const value = decodeURIComponent(values[0].replace(/\+/g, " "));
      if ((toolFilterValues[key] as readonly string[]).includes(value)) result.set(key, value);
    } catch { /* Malformed values are discarded too. */ }
  }
  return result.size ? `?${result}` : "";
}

export function isKnownPublicPath(path: string) {
  if (isVideoUnavailablePath(path) || !isComparisonPathPublished(path)) return false;
  if (ordinaryPages.has(path) || workspacePages.has(path)) return true;
  if (/^\/tools\/document-compare\/results\/\d+$/.test(path)) return true;
  return Object.hasOwn(seoByPath, path) || Object.hasOwn(toolSlugByPath, path);
}

/** An allowlisted, non-sensitive virtual page. Never use location.search, hash or document.title. */
export function safeAnalyticsPage(pathname: string, search = "", hash = "") {
  const language = /^\/ko(?:\/|$)/.test(pathname) ? "ko" : /^\/en(?:\/|$)/.test(pathname) ? "en" : null;
  if (!language) return null;
  if (hash) return null;
  let path = stripLanguagePrefix(pathname).replace(/\/+$/, "") || "/";
  if (!isKnownPublicPath(path)) return null;
  const parameters = new URLSearchParams(search);
  const allowed = path === "/tools" && search === normalizeToolsSearch(search)
    || path === "/tools/market-calendar" && parseCalendarSelection(parameters) !== null
    || path === "/tools/office-editor" && parameters.size === 1 && parameters.get("guide") === "1"
    || path === "/tools/excel-merger/xls-preserve" && [...parameters].every(([key, value]) => (key === "formula" || key === "format") && (value === "0" || value === "1")) && parameters.size <= 2;
  if (search && !allowed) return null;
  if (/^\/tools\/document-compare\/results\/\d+$/.test(path)) path = "/tools/document-compare/results";
  return { path: `/${language}${path === "/" ? "/" : path + "/"}`, title: `Worklazy Tools · ${path === "/" ? "home" : path.split("/").filter(Boolean).join(" · ")}` };
}
