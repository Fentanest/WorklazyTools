import type { Dispatch, SetStateAction } from "react";

import { deduplicateDocumentFiles, reorderDocumentFiles } from "./filePairs";

export type DocumentPairSide = "before" | "after";
type FileSetter = Dispatch<SetStateAction<File[]>>;

export function useDocumentPairFiles({
  beforeFiles,
  afterFiles,
  setBeforeFiles,
  setAfterFiles,
  accepts,
  onReset,
}: {
  beforeFiles: File[];
  afterFiles: File[];
  setBeforeFiles: FileSetter;
  setAfterFiles: FileSetter;
  accepts: (file: File) => boolean;
  onReset: () => void;
}) {
  const filesFor = (side: DocumentPairSide) => side === "before" ? beforeFiles : afterFiles;
  const setterFor = (side: DocumentPairSide) => side === "before" ? setBeforeFiles : setAfterFiles;

  const updateFiles = (files: File[], side: DocumentPairSide) => {
    const rejected = files.filter((file) => !accepts(file));
    setterFor(side)(deduplicateDocumentFiles(files.filter(accepts)));
    onReset();
    return rejected;
  };

  const removeFile = (side: DocumentPairSide, index: number) => {
    setterFor(side)((current) => current.filter((_, itemIndex) => itemIndex !== index));
    onReset();
  };

  const moveFile = (side: DocumentPairSide, from: number, to: number) => {
    setterFor(side)((current) => reorderDocumentFiles(current, from, to));
    onReset();
  };

  const moveAcross = (side: DocumentPairSide, index: number) => {
    const opposite: DocumentPairSide = side === "before" ? "after" : "before";
    const source = filesFor(side);
    const target = filesFor(opposite);
    const file = source[index];
    if (!file) return;
    setterFor(side)(source.filter((_, itemIndex) => itemIndex !== index));
    const targetIndex = Math.min(index, target.length);
    setterFor(opposite)([...target.slice(0, targetIndex), file, ...target.slice(targetIndex)]);
    onReset();
  };

  return { updateFiles, removeFile, moveFile, moveAcross };
}
