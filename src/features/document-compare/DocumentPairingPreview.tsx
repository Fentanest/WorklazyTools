import { documentFileKey } from "./filePairs";

export function DocumentPairingPreview({ beforeFiles, afterFiles, language }: { beforeFiles: File[]; afterFiles: File[]; language: "ko" | "en" }) {
  return (
    <div className="pairing-preview">
      <div className="pairing-preview-title">
        <strong>{language === "en" ? `${beforeFiles.length} comparison pairs` : `${beforeFiles.length}개 비교 쌍`}</strong>
        <small>{language === "en" ? "Paired in list order." : "목록 순서대로 연결됩니다."}</small>
      </div>
      <ol>{beforeFiles.map((file, index) => <li key={documentFileKey(file)}><b>{index + 1}</b><span>{file.name}</span><i>↔</i><span>{afterFiles[index].name}</span></li>)}</ol>
    </div>
  );
}
