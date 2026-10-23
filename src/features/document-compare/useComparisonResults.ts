import { useEffect, useState } from "react";

interface RevocableComparisonResult {
  originalBeforeUrl?: string;
  originalAfterUrl?: string;
  reportUrl?: string;
  trackedUrl?: string;
}

export function useComparisonResults<T extends RevocableComparisonResult>() {
  const [results, setResults] = useState<T[]>([]);
  useEffect(() => () => {
    results.forEach((item) => {
      if (item.originalBeforeUrl) URL.revokeObjectURL(item.originalBeforeUrl);
      if (item.originalAfterUrl) URL.revokeObjectURL(item.originalAfterUrl);
      if (item.reportUrl) URL.revokeObjectURL(item.reportUrl);
      if (item.trackedUrl) URL.revokeObjectURL(item.trackedUrl);
    });
  }, [results]);
  return { results, replaceResults: setResults, clearResults: () => setResults([]) };
}
