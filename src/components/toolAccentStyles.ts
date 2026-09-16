import type { ToolAccent } from "../app/toolRegistry";

export type IconTone = "documents" | "sheets" | "media" | "utility";

export function getToolIconTone(toolId: string): IconTone {
  const toneMap: Record<string, IconTone> = {
    "pdf-editor": "documents",
    "document-generator": "documents",
    "document-compare": "documents",
    "pdf-compare": "documents",
    "hwp-editor": "documents",
    "office-editor": "documents",

    "excel-merger": "sheets",
    "excel-compare": "sheets",
    "excel-cleaner": "sheets",
    "data-converter": "sheets",

    "image-studio": "media",
    "video-studio": "media",
    "audio-studio": "media",

    "text-merger": "utility",
    "text-tools": "utility",
    "text-formatter": "utility",
    "work-calculator": "utility",
    "timezone-calculator": "utility",
    "payroll-calculator": "utility",
    "document-redactor": "utility",
    "image-privacy": "utility",
    "security-tools": "utility",
    "qr-studio": "utility",
  };
  return toneMap[toolId] || "utility";
}

// Retained for any generic fallback, but tools should use getToolIconTone and data-icon-tone
export const toolIconAccentClasses = {
  green: "tone-icon-badge",
  blue: "tone-icon-badge",
  violet: "tone-icon-badge",
  orange: "tone-icon-badge",
  pink: "tone-icon-badge",
  sky: "tone-icon-badge",
  coral: "tone-icon-badge",
} satisfies Record<ToolAccent, string>;
