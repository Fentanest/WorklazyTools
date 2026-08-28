import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Circle, LoaderCircle } from "lucide-react";
import type { TFunction } from "i18next";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { OperationLogEntry, OperationStatus } from "../hooks/useOperationProgress";
import type { ToolAccent } from "../app/toolRegistry";

export function OperationProgress({
  status,
  progress,
  message,
  logs,
  accent,
  title,
  compact = false,
}: {
  status: OperationStatus;
  progress: number;
  message: string;
  logs: OperationLogEntry[];
  accent: ToolAccent;
  title?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation("common");
  const displayTitle = title ?? t("progress.title");
  const [expanded, setExpanded] = useState(!compact);
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (status === "running" && !compact) setExpanded(true);
  }, [compact, status]);

  useLayoutEffect(() => {
    if (!expanded) return;
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight - log.clientHeight;
  }, [expanded, logs]);

  if (status === "idle" || !logs.length) return null;

  const stateLabel = status === "running" ? t("progress.running") : status === "success" ? t("progress.success") : t("progress.needsAttention");
  const StateIcon = status === "running" ? LoaderCircle : status === "success" ? CheckCircle2 : AlertCircle;

  return (
    <section className={`operation-progress accent-${accent} status-${status}${compact ? " compact" : ""}`} aria-label={displayTitle}>
      <div className="operation-progress-heading">
        <span className="operation-state-icon"><StateIcon className={status === "running" ? "spin" : ""} size={17} /></span>
        <div>
          <small>{displayTitle}</small>
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
        {t("progress.logs", { count: logs.length })}
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
                <time>+{formatElapsed(entry.elapsedMs, t)}</time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function formatElapsed(milliseconds: number, t: TFunction<"common">) {
  if (milliseconds < 1_000) return `${Math.round(milliseconds)}ms`;
  if (milliseconds < 60_000) return t("progress.seconds", { value: (milliseconds / 1_000).toFixed(1) });
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.round((milliseconds % 60_000) / 1_000);
  return t("progress.minutesSeconds", { minutes, seconds });
}
