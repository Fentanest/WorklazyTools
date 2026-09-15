import * as React from "react";

import { cn } from "@/lib/utils";

export interface ProgressRootProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue"> {
  value?: number | null;
  min?: number;
  max?: number;
}

interface ProgressContextValue {
  value: number | null;
  min: number;
  max: number;
  labelId: string | undefined;
  setLabelId: (id: string | undefined) => void;
}

const ProgressContext = React.createContext<ProgressContextValue>({
  value: null,
  min: 0,
  max: 100,
  labelId: undefined,
  setLabelId: () => undefined,
});

function normalizeRange(min: number, max: number): { min: number; max: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min)) return { min: 0, max: 100 };
  return { min, max };
}

function normalizeValue(value: number | null | undefined, min: number, max: number): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}

function Progress({
  className,
  children,
  value = null,
  min = 0,
  max = 100,
  "aria-label": ariaLabel,
  ...props
}: ProgressRootProps) {
  const range = normalizeRange(min, max);
  const normalized = normalizeValue(value, range.min, range.max);
  const [labelId, setLabelId] = React.useState<string | undefined>(undefined);
  const context = React.useMemo<ProgressContextValue>(() => ({
    value: normalized,
    min: range.min,
    max: range.max,
    labelId,
    setLabelId,
  }), [normalized, range.min, range.max, labelId]);
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={range.min}
      aria-valuemax={range.max}
      {...(normalized === null ? {} : { "aria-valuenow": normalized })}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : labelId}
      className={cn("flex flex-wrap gap-3", className)}
      {...props}
    >
      <ProgressContext.Provider value={context}>
        {children ?? (
          <ProgressTrack>
            <ProgressIndicator />
          </ProgressTrack>
        )}
      </ProgressContext.Provider>
    </div>
  );
}

function progressPercent(value: number | null, min: number, max: number): number {
  if (value === null) return 0;
  return ((value - min) / (max - min)) * 100;
}

function ProgressTrack({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative flex h-3 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      data-slot="progress-track"
      {...props}
    />
  );
}

function ProgressIndicator({
  className,
  style,
  render,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  render?: React.ReactElement<{
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }>;
}) {
  const { value, min, max } = React.useContext(ProgressContext);
  if (render !== undefined && !React.isValidElement(render)) {
    throw new Error("ProgressIndicator render must be a single element.");
  }
  const body = (
    <div
      data-slot="progress-indicator"
      className={cn("h-full bg-primary transition-all", className)}
      style={{ width: `${progressPercent(value, min, max)}%`, ...style }}
      {...props}
    />
  );
  if (render === undefined) return body;
  const elementProps = (render as React.ReactElement<Record<string, unknown>>).props;
  return React.cloneElement(render as React.ReactElement<Record<string, unknown>>, {
    ...elementProps,
    "data-slot": "progress-indicator",
    className: cn("h-full bg-primary transition-all", className, elementProps.className as string | undefined),
    style: { width: `${progressPercent(value, min, max)}%`, ...style, ...((elementProps.style ?? {}) as React.CSSProperties) },
  } as Record<string, unknown>);
}

function ProgressLabel({ className, id: idProp, ...props }: React.HTMLAttributes<HTMLDivElement> & { id?: string }) {
  const { setLabelId } = React.useContext(ProgressContext);
  const generated = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = idProp ?? `progress-label-${generated}`;
  React.useEffect(() => {
    setLabelId(id);
    return () => setLabelId(undefined);
  }, [id, setLabelId]);
  return (
    <div
      className={cn("text-sm font-medium", className)}
      data-slot="progress-label"
      id={id}
      {...props}
    />
  );
}

function ProgressValue({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "ml-auto text-sm text-muted-foreground tabular-nums",
        className
      )}
      data-slot="progress-value"
      {...props}
    >
      {children}
    </div>
  );
}

export {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
};
