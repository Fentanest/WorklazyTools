import { useCallback, useEffect, useRef, useState } from "react";

import { audioBufferToDocument, sniffAudioSampleRate } from "./audioHelpers";
import type { AudioDocumentData } from "./types";

export function useAudioDocument() {
  const [document, setDocument] = useState<AudioDocumentData>();
  const documentRef = useRef<AudioDocumentData | undefined>(undefined);
  const decodeContextRef = useRef<AudioContext | undefined>(undefined);
  const loadGenerationRef = useRef(0);

  const replaceDocument = useCallback((next: AudioDocumentData | undefined) => {
    documentRef.current = next;
    setDocument(next);
  }, []);

  const closeDecodeContext = useCallback(async () => {
    const context = decodeContextRef.current;
    decodeContextRef.current = undefined;
    await context?.close().catch(() => undefined);
  }, []);

  const prepareDecode = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    await closeDecodeContext();
    replaceDocument(undefined);
    return generation;
  }, [closeDecodeContext, replaceDocument]);

  const decodeFile = useCallback(async (
    file: File,
    generation: number,
    signal: AbortSignal,
    onWebAudioReady?: () => void,
  ) => {
    const sourceBytes = await file.arrayBuffer();
    if (signal.aborted || generation !== loadGenerationRef.current) return undefined;
    const sourceSampleRate = sniffAudioSampleRate(sourceBytes, file.name);
    const context = new AudioContext(sourceSampleRate ? { sampleRate: sourceSampleRate } : undefined);
    decodeContextRef.current = context;
    try {
      onWebAudioReady?.();
      const decoded = await context.decodeAudioData(sourceBytes);
      if (signal.aborted || generation !== loadGenerationRef.current) return undefined;
      return audioBufferToDocument(decoded, file.name);
    } finally {
      if (decodeContextRef.current === context) decodeContextRef.current = undefined;
      await context.close().catch(() => undefined);
    }
  }, []);

  const isCurrentDecode = useCallback((generation: number) => generation === loadGenerationRef.current, []);

  const cancelDecode = useCallback(() => {
    loadGenerationRef.current += 1;
    void closeDecodeContext();
  }, [closeDecodeContext]);

  useEffect(() => () => {
    loadGenerationRef.current += 1;
    documentRef.current = undefined;
    void closeDecodeContext();
  }, [closeDecodeContext]);

  return {
    document,
    documentRef,
    replaceDocument,
    prepareDecode,
    decodeFile,
    isCurrentDecode,
    cancelDecode,
  };
}
