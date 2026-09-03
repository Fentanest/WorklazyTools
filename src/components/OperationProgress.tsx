import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Circle, LoaderCircle } from "lucide-react";
import type { TFunction } from "i18next";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { OperationLogEntry, OperationStatus } from "../hooks/useOperationProgress";
import type { ToolAccent } from "../app/toolRegistry";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress, ProgressIndicator } from "./ui/progress";

const progressIndicatorClasses = {
  green: "bg-green-700",
  blue: "bg-blue-700",
  violet: "bg-violet-700",
  orange: "bg-orange-700",
  pink: "bg-pink-700",
  sky: "bg-sky-700",
} satisfies Record<ToolAccent, string>;

const progressStateClasses = {
  green: "bg-green-50 text-green-700 dark:bg-green-950/70 dark:text-green-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300",
  pink: "bg-pink-50 text-pink-700 dark:bg-pink-950/70 dark:text-pink-300",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
} satisfies Record<ToolAccent, string>;

export function OperationProgress({
  status,
  progress,
  message,
  logs,
  activeLogId,
  activeStageKey,
  accent,
  title,
  compact = false,
}: {
  status: OperationStatus;
  progress: number;
  message: string;
  logs: OperationLogEntry[];
  activeLogId?: number;
  activeStageKey?: string;
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
    <Card
      as="section"
      className={`operation-progress accent-${accent} status-${status}${compact ? " compact" : ""} gap-0 rounded-3xl border p-4 py-4 shadow-md ring-0`}
      aria-label={displayTitle}
    >
      <div className="operation-progress-heading">
        <span className={cn("operation-state-icon", status === "error" ? "bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-300" : progressStateClasses[accent])}><StateIcon className={status === "running" ? "spin" : ""} size={17} /></span>
        <div>
          <small className="text-muted-foreground">{displayTitle}</small>
          <strong>{stateLabel}</strong>
        </div>
        <b>{progress}%</b>
      </div>

      <Progress
        className="operation-progress-track block h-2 gap-0"
        value={progress}
        aria-label={message}
      >
        <ProgressIndicator
          render={<span />}
          className={cn("block h-full rounded-full", status === "error" ? "bg-red-700" : progressIndicatorClasses[accent])}
        />
      </Progress>
      <p className="operation-current-message" aria-live="polite">{message}</p>

      <Button className="operation-log-toggle h-auto rounded-none text-muted-foreground" variant="ghost" type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>
        {t("progress.logs", { count: logs.length })}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </Button>

      {expanded && (
        <ol ref={logRef} className="operation-log" aria-live="polite" aria-relevant="additions text">
          {logs.map((entry) => {
            const isCurrent = entry.id === activeLogId || Boolean(entry.stageKey && entry.stageKey === activeStageKey);
            const Icon = entry.status === "success" ? CheckCircle2 : entry.status === "error" ? AlertCircle : isCurrent && status === "running" ? LoaderCircle : Circle;
            return (
              <li className={cn(`log-${entry.status}${isCurrent ? " current" : ""}`, "text-muted-foreground", entry.status === "success" && "text-green-700 dark:text-green-300", entry.status === "error" && "text-red-700 dark:text-red-300")} key={entry.id}>
                <Icon className={isCurrent && status === "running" ? "spin" : ""} size={13} />
                <span>{entry.message}</span>
                <b className="operation-log-progress">{entry.progress}%</b>
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
