import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Circle, LoaderCircle } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { OperationLogEntry, OperationStatus } from "../hooks/useOperationProgress";
import type { ToolAccent } from "../app/toolRegistry";

export function OperationProgress({
  status,
  progress,
  message,
  logs,
  accent,
  title = "작업 진행 상황",
}: {
  status: OperationStatus;
  progress: number;
  message: string;
  logs: OperationLogEntry[];
  accent: ToolAccent;
  title?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (status === "running") setExpanded(true);
  }, [status]);

  useLayoutEffect(() => {
    if (!expanded) return;
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight - log.clientHeight;
  }, [expanded, logs]);

  if (status === "idle" || !logs.length) return null;

  const stateLabel = status === "running" ? "처리 중" : status === "success" ? "완료" : "확인 필요";
  const StateIcon = status === "running" ? LoaderCircle : status === "success" ? CheckCircle2 : AlertCircle;

  return (
    <section className={`operation-progress accent-${accent} status-${status}`} aria-label={title}>
      <div className="operation-progress-heading">
        <span className="operation-state-icon"><StateIcon className={status === "running" ? "spin" : ""} size={17} /></span>
        <div>
          <small>{title}</small>
          <strong>{stateLabel}</strong>
        </div>
        <b>{progress}%</b>
      </div>

      <div
        className="operation-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label={message}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="operation-current-message" aria-live="polite">{message}</p>

      <button className="operation-log-toggle" type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>
        처리 로그 {logs.length}개
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <ol ref={logRef} className="operation-log" aria-live="polite" aria-relevant="additions">
          {logs.map((entry, index) => {
            const isCurrent = index === logs.length - 1;
            const Icon = entry.status === "success" ? CheckCircle2 : entry.status === "error" ? AlertCircle : isCurrent && status === "running" ? LoaderCircle : Circle;
            return (
              <li className={`log-${entry.status}${isCurrent ? " current" : ""}`} key={entry.id}>
                <Icon className={isCurrent && status === "running" ? "spin" : ""} size={13} />
                <span>{entry.message}</span>
                <time>+{formatElapsed(entry.elapsedMs)}</time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function formatElapsed(milliseconds: number) {
  if (milliseconds < 1_000) return `${Math.round(milliseconds)}ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1_000).toFixed(1)}초`;
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.round((milliseconds % 60_000) / 1_000);
  return `${minutes}분 ${seconds}초`;
}
