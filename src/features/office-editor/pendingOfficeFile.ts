import { cancelPersistentHandoff, consumePersistentHandoff, PersistentHandoffError, stagePersistentHandoff } from "../../app/persistentHandoff";

const TOKEN_KEY = "worklazy-handoff-token:office-editor";

export async function stagePendingOfficeFile(file: File) {
  const token = await stagePersistentHandoff(file);
  try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token)); }
  catch {
    // If the tab cannot retain its token, do not leave an unreachable file behind.
    await cancelPersistentHandoff(token).catch(() => undefined);
    throw new PersistentHandoffError("unavailable");
  }
}

export async function takePendingOfficeFile(): Promise<File | undefined> {
  const raw = sessionStorage.getItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY); // One attempt, before any asynchronous work.
  if (raw === null) return undefined;
  let token: { id: string; nonce: string };
  try {
    token = JSON.parse(raw);
    if (!token || typeof token.id !== "string" || typeof token.nonce !== "string") throw new Error();
  } catch { throw new PersistentHandoffError("notReceived"); }
  const file = await consumePersistentHandoff(token);
  if (!file) throw new PersistentHandoffError("notReceived");
  return file;
}
