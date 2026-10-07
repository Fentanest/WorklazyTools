import { seoByPath, toolSlugByPath } from "./seo.ts";
import { stripLanguagePrefix } from "../i18n/languages.ts";
import { VIDEO_STUDIO_PUBLIC } from "./publicServiceConfig.mjs";
import { withSiteBasePath } from "./siteBasePath.ts";

// One publication decision is consumed by the catalog, router, static generator and tracking.
// The implementation remains in src/features/video-studio for a later reactivation.
export { VIDEO_STUDIO_PUBLIC };

export function isVideoUnavailablePath(pathname: string) {
  const path = stripLanguagePrefix(pathname).replace(/\/+$/, "") || "/";
  return /^\/(?:tools\/)?video-studio(?:\/|$)/.test(path);
}

export function isToolPublished(id: string) {
  return id !== "video-studio" || VIDEO_STUDIO_PUBLIC;
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
  if (path === "/tools/hwp-editor" && /^\/en(?:\/|$)/.test(pathname)) return "navigation";
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
const publicToolCategories = new Set(["spreadsheets", "documents", "media", "text-data", "work", "security-share", "investment-research"]);

export function isKnownPublicPath(path: string) {
  if (isVideoUnavailablePath(path)) return false;
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
  if (path === "/tools/hwp-editor" && language === "en") return null;
  if (!isKnownPublicPath(path)) return null;
  const parameters = new URLSearchParams(search);
  const allowed = path === "/tools" && parameters.size === 1 && publicToolCategories.has(parameters.get("category") ?? "")
    || path === "/tools/office-editor" && parameters.size === 1 && parameters.get("guide") === "1"
    || path === "/tools/excel-merger/xls-preserve" && [...parameters].every(([key, value]) => (key === "formula" || key === "format") && (value === "0" || value === "1")) && parameters.size <= 2;
  if (search && !allowed) return null;
  if (/^\/tools\/document-compare\/results\/\d+$/.test(path)) path = "/tools/document-compare/results";
  return { path: `/${language}${path === "/" ? "/" : path + "/"}`, title: `Worklazy Tools · ${path === "/" ? "home" : path.split("/").filter(Boolean).join(" · ")}` };
}
