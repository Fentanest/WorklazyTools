import { blobBytes, checkAbort, pathIssue } from './core.ts';
import type { Admission, FolderEntry, FolderSource } from './core.ts';
/** Structural read-only subset; no write or permission-request API is exposed. */
export interface ReadonlyDirectory {
  kind: 'directory'; name: string;
  values(): AsyncIterable<ReadonlyDirectory | { kind: 'file'; name: string; getFile(): Promise<File> }>;
}
export async function directorySource(root: ReadonlyDirectory, revision: string, admission: Admission, signal: AbortSignal): Promise<FolderSource> {
  const entries: FolderEntry[] = [];
  // Iterative traversal avoids a call-stack limit on deeply nested directories.
  const pending: { handle: ReadonlyDirectory; prefix: string }[] = [{ handle: root, prefix: '' }];
  while (pending.length) {
    checkAbort(signal); const { handle, prefix } = pending.pop()!;
    for await (const child of handle.values()) {
      checkAbort(signal); const rawPath = prefix + child.name;
      const issue = pathIssue(rawPath) ?? (child.name.includes('/') ? 'unsafe-path' : undefined);
      if (child.kind === 'directory') {
        admission.add(0);
        entries.push(Object.freeze({ id: `${revision}:directory:${entries.length}`, rawPath, size: 0, directory: true, issue,
          open() { throw new Error('directory'); } }));
        if (!issue) pending.push({ handle: child, prefix: rawPath + '/' });
      } else {
        const file = await child.getFile(); checkAbort(signal); admission.add(file.size);
        entries.push(Object.freeze({ id: `${revision}:directory:${entries.length}`, rawPath, size: file.size, directory: false, issue,
          open: (readSignal: AbortSignal) => blobBytes(file, readSignal) }));
      }
    }
  }
  return { entries: Object.freeze(entries), warnings: ['snapshot-only', 'directory-metadata-unavailable'], close: async () => {} };
}
