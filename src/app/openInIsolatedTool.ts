import { isolatedFileAccepts, type IsolatedReceiverId } from "./fileAccepts";
import { PersistentHandoffError, replacePendingPersistentHandoff } from "./persistentHandoff";
let opening = false;
/** Call inside the approved leave action; no navigation occurs before storage succeeds. */
export async function openInIsolatedTool(receiverId: IsolatedReceiverId, files: File[], documentPath: string): Promise<void> {
  const definition = isolatedFileAccepts[receiverId];
  if (opening || !files.length || files.length > definition.max || files.some(file =>
    !(definition.extensions as readonly string[]).includes(file.name.split(".").pop()?.toLowerCase() ?? ""))) throw new PersistentHandoffError("invalid");
  opening = true;
  try {
    await replacePendingPersistentHandoff({ receiverId, entryPath: definition.path, files });
    window.location.assign(documentPath);
  } finally { opening = false; }
}
