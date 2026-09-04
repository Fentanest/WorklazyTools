import { documentFileKey } from "./filePairs";

export function DocumentPairingPreview({ beforeFiles, afterFiles, language }: { beforeFiles: File[]; afterFiles: File[]; language: "ko" | "en" }) {
  return (
    <div className="mt-3.5 rounded-2xl border border-border bg-muted p-3" data-testid="document-pairing-preview">
      <div className="flex items-center justify-between gap-2.5 px-0.5 pb-2 max-[620px]:items-start max-[620px]:flex-col">
        <strong className="text-sm">{language === "en" ? `${beforeFiles.length} comparison pairs` : `${beforeFiles.length}개 비교 쌍`}</strong>
        <small className="text-xs text-muted-foreground">{language === "en" ? "Paired in list order." : "목록 순서대로 연결됩니다."}</small>
      </div>
      <ol className="flex list-none flex-col gap-1.5 p-0">{beforeFiles.map((file, index) => <li className="grid min-h-8 grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-lg bg-background px-2 py-1" key={documentFileKey(file)}><b className="text-[13px] text-blue-700 dark:text-blue-300">{index + 1}</b><span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">{file.name}</span><i className="text-sm text-muted-foreground not-italic">↔</i><span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">{afterFiles[index].name}</span></li>)}</ol>
    </div>
  );
}
