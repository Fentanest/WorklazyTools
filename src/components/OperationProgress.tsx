import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Circle, LoaderCircle } from "lucide-react";
import type { TFunction } from "i18next";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { OperationLogEntry, OperationStatus } from "../hooks/useOperationProgress";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress, ProgressIndicator } from "./ui/progress";

// Single primary progress treatment (W4): the bar uses the shared primary
// token and the state tile its hue family on every tool; only the error state
// keeps its own semantic red. The indigo tile scale matches the primary hue
// closely enough to read on light and dark surfaces (the raw primary token
// is too dark for dark-surface text). Per-tool accent progress is gone.
const PROGRESS_INDICATOR_CLASS = "bg-primary";
const PROGRESS_STATE_CLASS = "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300";

export function OperationProgress({
  status,
  progress,
  message,
  logs,
  activeLogId,
  activeStageKey,
  title,
  compact = false,
}: {
  status: OperationStatus;
  progress: number;
  message: string;
  logs: OperationLogEntry[];
  activeLogId?: number;
  activeStageKey?: string;
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
    <Card
      as="section"
      data-ui-component="operation-progress"
      className={`ui-operation-progress ui-status-${status}${compact ? " ui-compact" : ""} gap-0 rounded-3xl border p-4 py-4 shadow-md ring-0`}
      aria-label={displayTitle}
    >
      <div className="ui-operation-progress-heading">
        <span className={cn("ui-operation-state-icon", status === "error" ? "bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-300" : PROGRESS_STATE_CLASS)}><StateIcon className={status === "running" ? "animate-spin" : ""} size={17} /></span>
        <div>
          <small className="text-muted-foreground">{displayTitle}</small>
          <strong>{stateLabel}</strong>
        </div>
        <b>{progress}%</b>
      </div>

      <Progress
        className="ui-operation-progress-track block h-2 gap-0"
        value={progress}
        aria-label={message}
      >
        <ProgressIndicator
          render={<span />}
          className={cn("block h-full rounded-full", status === "error" ? "bg-red-700" : PROGRESS_INDICATOR_CLASS)}
        />
      </Progress>
      <p className="ui-operation-current-message" aria-live="polite">{message}</p>

      <Button className="ui-operation-log-toggle h-auto rounded-none text-muted-foreground max-[620px]:min-h-11" variant="ghost" type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>
        {t("progress.logs", { count: logs.length })}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </Button>

      {expanded && (
        <ol ref={logRef} className="ui-operation-log" aria-label={`${displayTitle} · ${t("progress.logs", { count: logs.length })}`} aria-live="polite" aria-relevant="additions text" tabIndex={0}>
          {logs.map((entry) => {
            const isCurrent = entry.id === activeLogId || Boolean(entry.stageKey && entry.stageKey === activeStageKey);
            const Icon = entry.status === "success" ? CheckCircle2 : entry.status === "error" ? AlertCircle : isCurrent && status === "running" ? LoaderCircle : Circle;
            return (
              <li className={cn(`ui-log-${entry.status}${isCurrent ? " ui-current" : ""}`, "text-muted-foreground", entry.status === "success" && "text-green-700 dark:text-green-300", entry.status === "error" && "text-red-700 dark:text-red-300")} key={entry.id}>
                <Icon className={isCurrent && status === "running" ? "animate-spin" : ""} size={13} />
                <span>{entry.message}</span>
                <b className="ui-operation-log-progress">{entry.progress}%</b>
                <time className="text-muted-foreground">+{formatElapsed(entry.elapsedMs, t)}</time>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

function formatElapsed(milliseconds: number, t: TFunction<"common">) {
  if (milliseconds < 1_000) return `${Math.round(milliseconds)}ms`;
  if (milliseconds < 60_000) return t("progress.seconds", { value: (milliseconds / 1_000).toFixed(1) });
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.round((milliseconds % 60_000) / 1_000);
  return t("progress.minutesSeconds", { minutes, seconds });
}
