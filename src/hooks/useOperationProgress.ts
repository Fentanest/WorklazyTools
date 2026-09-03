import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  normalizeMonotonicOperationProgress,
  replaceOperationLogEntry,
  upsertOperationLogEntry,
  type OperationLogEntryValue,
} from "./operationProgress";

export type OperationStatus = "idle" | "running" | "success" | "error";

export type OperationLogEntry = OperationLogEntryValue;

export function useOperationProgress() {
  const { t } = useTranslation("common");
  const [status, setStatus] = useState<OperationStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<OperationLogEntry[]>([]);
  const [activeLogId, setActiveLogId] = useState<number>();
  const [activeStageKey, setActiveStageKey] = useState<string>();
  const startedAt = useRef(0);
  const nextId = useRef(1);
  const progressRef = useRef(0);
  const statusRef = useRef<OperationStatus>("idle");
  const activeLogIdRef = useRef<number | undefined>(undefined);

  const append = useCallback((nextProgress: number, nextMessage: string, nextStatus: Exclude<OperationStatus, "idle">, stageKey?: string) => {
    const normalizedProgress = normalizeMonotonicOperationProgress(progressRef.current, nextProgress);
    const elapsedMs = startedAt.current ? performance.now() - startedAt.current : 0;
    progressRef.current = normalizedProgress;
    statusRef.current = nextStatus;
    setProgress(normalizedProgress);
    setMessage(nextMessage);
    setStatus(nextStatus);
    setActiveStageKey(stageKey);
    setLogs((current) => {
      const result = upsertOperationLogEntry(current, {
        id: nextId.current++,
        stageKey,
        message: nextMessage,
        progress: normalizedProgress,
        elapsedMs,
        status: nextStatus,
      });
      activeLogIdRef.current = result.activeLogId;
      setActiveLogId(result.activeLogId);
      return result.logs;
    });
  }, []);

  const start = useCallback((startMessage: string) => {
    startedAt.current = performance.now();
    nextId.current = 2;
    progressRef.current = 1;
    statusRef.current = "running";
    setStatus("running");
    setProgress(1);
    setMessage(startMessage);
    setActiveStageKey(undefined);
    activeLogIdRef.current = 1;
    setActiveLogId(1);
    setLogs([{ id: 1, message: startMessage, progress: 1, elapsedMs: 0, status: "running" }]);
  }, []);

  const update = useCallback((nextProgress: number, nextMessage: string, stageKey?: string) => {
    if (statusRef.current !== "running") return;
    append(nextProgress, nextMessage, "running", stageKey);
  }, [append]);

  const updateCurrent = useCallback((nextProgress: number, nextMessage: string) => {
    if (statusRef.current !== "running") return;
    const normalizedProgress = normalizeMonotonicOperationProgress(progressRef.current, nextProgress);
    const elapsedMs = startedAt.current ? performance.now() - startedAt.current : 0;
    progressRef.current = normalizedProgress;
    setProgress(normalizedProgress);
    setMessage(nextMessage);
    setStatus("running");
    setActiveStageKey(undefined);
    setLogs((current) => {
      if (!current.length) {
        const id = nextId.current++;
        activeLogIdRef.current = id;
        setActiveLogId(id);
        return [{ id, message: nextMessage, progress: normalizedProgress, elapsedMs, status: "running" }];
      }
      return replaceOperationLogEntry(current, activeLogIdRef.current, { message: nextMessage, progress: normalizedProgress, elapsedMs, status: "running" });
    });
  }, []);

  const succeed = useCallback((successMessage = t("status.complete")) => {
    if (statusRef.current !== "running") return;
    append(100, successMessage, "success");
  }, [append, t]);

  const fail = useCallback((errorMessage: string) => {
    if (statusRef.current !== "running") return;
    append(progressRef.current, errorMessage, "error");
  }, [append]);

  const reset = useCallback(() => {
    startedAt.current = 0;
    progressRef.current = 0;
    statusRef.current = "idle";
    setStatus("idle");
    setProgress(0);
    setMessage("");
    setLogs([]);
    activeLogIdRef.current = undefined;
    setActiveLogId(undefined);
    setActiveStageKey(undefined);
  }, []);

  return { status, progress, message, logs, activeLogId, activeStageKey, start, update, updateCurrent, succeed, fail, reset };
}
