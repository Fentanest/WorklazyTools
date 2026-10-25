import { useCallback, useEffect, useRef, useState } from "react";

interface RevocableComparisonResult {
  originalBeforeUrl?: string;
  originalAfterUrl?: string;
  reportUrl?: string;
  trackedUrl?: string;
}

const objectUrls = (items: readonly RevocableComparisonResult[]) => new Set(items.flatMap((item) => [item.originalBeforeUrl, item.originalAfterUrl, item.reportUrl, item.trackedUrl].filter((url): url is string => Boolean(url))));

/** Results with object URLs: a replacement revokes only URLs the new results no longer hold (a
 * tracked file arriving later updates one pair and keeps the others' links), unmount revokes all. */
export function useComparisonResults<T extends RevocableComparisonResult>() {
  const [results, setResults] = useState<T[]>([]);
  const live = useRef<T[]>([]);
  const replaceResults = useCallback((next: T[] | ((current: T[]) => T[])) => {
    const previous = live.current, value = typeof next === "function" ? next(previous) : next, kept = objectUrls(value);
    for (const url of objectUrls(previous)) if (!kept.has(url)) URL.revokeObjectURL(url);
    live.current = value;
    setResults(value);
  }, []);
  useEffect(() => () => { for (const url of objectUrls(live.current)) URL.revokeObjectURL(url); }, []);
  const clearResults = useCallback(() => replaceResults([]), [replaceResults]);
  return { results, replaceResults, clearResults };
}
