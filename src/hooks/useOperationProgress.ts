import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export type OperationStatus = "idle" | "running" | "success" | "error";

export interface OperationLogEntry {
  id: number;
  message: string;
  progress: number;
  elapsedMs: number;
  status: Exclude<OperationStatus, "idle">;
}

export function useOperationProgress() {
  const { t } = useTranslation("common");
  const [status, setStatus] = useState<OperationStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<OperationLogEntry[]>([]);
  const startedAt = useRef(0);
  const nextId = useRef(1);
  const progressRef = useRef(0);

  const append = useCallback((nextProgress: number, nextMessage: string, nextStatus: Exclude<OperationStatus, "idle">) => {
    const normalizedProgress = Math.max(0, Math.min(100, Math.round(nextProgress)));
    const elapsedMs = startedAt.current ? performance.now() - startedAt.current : 0;
    progressRef.current = normalizedProgress;
    setProgress(normalizedProgress);
    setMessage(nextMessage);
    setStatus(nextStatus);
    setLogs((current) => {
      const last = current.at(-1);
      if (last?.message === nextMessage && last.status === nextStatus) {
        return [...current.slice(0, -1), { ...last, progress: normalizedProgress, elapsedMs }];
      }
      return [...current, {
        id: nextId.current++,
        message: nextMessage,
        progress: normalizedProgress,
        elapsedMs,
        status: nextStatus,
      }];
    });
  }, []);

  const start = useCallback((startMessage: string) => {
    startedAt.current = performance.now();
    nextId.current = 2;
    progressRef.current = 1;
    setStatus("running");
    setProgress(1);
    setMessage(startMessage);
    setLogs([{ id: 1, message: startMessage, progress: 1, elapsedMs: 0, status: "running" }]);
  }, []);

  const update = useCallback((nextProgress: number, nextMessage: string) => {
    append(nextProgress, nextMessage, "running");
  }, [append]);

  const updateCurrent = useCallback((nextProgress: number, nextMessage: string) => {
    const normalizedProgress = Math.max(0, Math.min(100, Math.round(nextProgress)));
    const elapsedMs = startedAt.current ? performance.now() - startedAt.current : 0;
    progressRef.current = normalizedProgress;
    setProgress(normalizedProgress);
    setMessage(nextMessage);
    setStatus("running");
    setLogs((current) => {
      const last = current.at(-1);
      if (!last) return [{ id: nextId.current++, message: nextMessage, progress: normalizedProgress, elapsedMs, status: "running" }];
      return [...current.slice(0, -1), { ...last, message: nextMessage, progress: normalizedProgress, elapsedMs, status: "running" }];
    });
  }, []);

  const succeed = useCallback((successMessage = t("status.complete")) => {
    append(100, successMessage, "success");
  }, [append, t]);

  const fail = useCallback((errorMessage: string) => {
    append(progressRef.current, errorMessage, "error");
  }, [append]);

  const reset = useCallback(() => {
    startedAt.current = 0;
    progressRef.current = 0;
    setStatus("idle");
    setProgress(0);
    setMessage("");
    setLogs([]);
  }, []);

  return { status, progress, message, logs, start, update, updateCurrent, succeed, fail, reset };
}
