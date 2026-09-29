import { seoByPath, toolSlugByPath } from "./seo";
import { stripLanguagePrefix } from "../i18n/languages";

// One publication decision is consumed by the catalog, router, static generator and tracking.
// The implementation remains in src/features/video-studio for a later reactivation.
export const VIDEO_STUDIO_PUBLIC = false;

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
): DocumentReadiness {
  if (isVideoUnavailablePath(pathname)) return "unavailable";
  const path = stripLanguagePrefix(pathname).replace(/\/+$/, "") || "/";
  const redactor = path === "/tools/document-redactor";
  const office = path === "/tools/office-editor/app";
  const excel = path === "/tools/excel-merger/xls-preserve";
  if (redactor !== markers.redactor || office !== markers.office || excel !== markers.excel) return "navigation";
  if ((office || excel) && !isolated) return "isolation-pending";
  return isKnownPublicPath(path) ? "ready" : "unavailable";
}

const ordinaryPages = new Set(["/", "/tools", "/about", "/privacy", "/terms", "/contact", "/licenses"]);
const workspacePages = new Set(["/tools/office-editor/app", "/tools/excel-merger/xls-preserve"]);

export function isKnownPublicPath(path: string) {
  if (isVideoUnavailablePath(path)) return false;
  if (ordinaryPages.has(path) || workspacePages.has(path)) return true;
  if (/^\/tools\/document-compare\/results\/[^/]+$/.test(path)) return true;
  return Object.hasOwn(seoByPath, path) || Object.hasOwn(toolSlugByPath, path);
}

/** An allowlisted, non-sensitive virtual page. Never use location.search, hash or document.title. */
export function safeAnalyticsPage(pathname: string) {
  const language = /^\/ko(?:\/|$)/.test(pathname) ? "ko" : /^\/en(?:\/|$)/.test(pathname) ? "en" : null;
  if (!language) return null;
  let path = stripLanguagePrefix(pathname).replace(/\/+$/, "") || "/";
  if (!isKnownPublicPath(path)) return null;
  if (/^\/tools\/document-compare\/results\/[^/]+$/.test(path)) path = "/tools/document-compare/results";
  return { path: `/${language}${path === "/" ? "/" : path + "/"}`, title: `Worklazy Tools · ${path === "/" ? "home" : path.split("/").filter(Boolean).join(" · ")}` };
}
