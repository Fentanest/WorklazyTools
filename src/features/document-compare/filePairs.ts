export function documentFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function reorderDocumentFiles<T>(items: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function deduplicateDocumentFiles(files: File[]) {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = documentFileKey(file);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function stripDocumentExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}
