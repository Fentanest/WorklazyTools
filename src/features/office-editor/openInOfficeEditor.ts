import { PersistentHandoffError } from "../../app/persistentHandoff";
import { stagePendingOfficeFile } from "./pendingOfficeFile";

export const OFFICE_EXTENSIONS = new Set(["docx", "doc", "odt", "xlsx", "xls", "ods", "pptx", "ppt", "odp"]);
let opening = false;
// Both the guide and H1 use this sender. The caller supplies its localized,
// base-path-aware Office document URL; no file/token data is added to that URL.
export async function openInOfficeEditor(file: File, appDocumentPath: string): Promise<void> {
  if (opening || !OFFICE_EXTENSIONS.has(file.name.split(".").pop()?.toLowerCase() ?? "")) throw new PersistentHandoffError("unavailable");
  opening = true;
  try {
    await stagePendingOfficeFile(file);
    window.location.assign(appDocumentPath);
  } finally { opening = false; }
}
