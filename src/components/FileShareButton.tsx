import { Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface FileShareButtonProps {
  url: string;
  fileName: string;
  mimeType?: string;
  className?: string;
}

export function FileShareButton({ url, fileName, mimeType, className = "secondary-button" }: FileShareButtonProps) {
  const { t } = useTranslation("common");
  const blobRef = useRef<Blob | undefined>(undefined);
  const [supported] = useState(() => typeof navigator !== "undefined" && typeof navigator.share === "function");

  useEffect(() => {
    let cancelled = false;
    blobRef.current = undefined;
    void fetch(url).then((response) => response.blob()).then((blob) => {
      if (!cancelled) blobRef.current = blob;
    }).catch(() => undefined);
    return () => { cancelled = true; blobRef.current = undefined; };
  }, [url]);

  if (!supported) return null;

  const share = () => {
    const blob = blobRef.current;
    if (!blob) {
      triggerDownload(url, fileName);
      return;
    }
    const file = new File([blob], fileName, { type: mimeType || blob.type || "application/octet-stream" });
    if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) {
      triggerDownload(url, fileName);
      return;
    }
    void navigator.share({ title: fileName, files: [file] }).catch((error) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) triggerDownload(url, fileName);
    });
  };

  return <button type="button" className={className} onClick={share}><Share2 size={16} /> {t("actions.share")}</button>;
}

function triggerDownload(url: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
}
