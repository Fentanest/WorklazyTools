import type {
  ComponentProps,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "../lib/utils";
import { Info, AlertTriangle, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { SectionCard } from "./ui";

export const pairedEditorClassName = "h-80 min-h-80 max-h-80 flex-none resize-none";

export function UtilityPage({ toolId, children, className, flush = false }: { toolId: string; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <div
      data-tool-page={toolId}
      className={cn(
        "mx-auto w-full max-w-none",
        !flush && "pt-[61px] pb-[52px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 max-[820px]:pt-[calc(104px+env(safe-area-inset-top))] max-[820px]:pb-[calc(92px+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function UtilitySectionCard({ className, ...props }: ComponentProps<typeof SectionCard>) {
  return <SectionCard className={cn("!mt-0 mb-[15px]", className)} {...props} />;
}

export function UtilityTextarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-[300px] w-full resize-y rounded-2xl border border-input bg-background p-[15px] text-[15px] leading-[1.7] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:bg-destructive/5 aria-invalid:text-destructive aria-invalid:ring-destructive/20 max-[620px]:text-base",
        className,
      )}
      {...props}
    />
  );
}

export function UtilityInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 max-[620px]:text-base",
        className,
      )}
      {...props}
    />
  );
}

export function UtilitySelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 max-[620px]:text-base",
        className,
      )}
      {...props}
    />
  );
}

export function UtilityField({ children, className, ...props }: ComponentProps<"label">) {
  return <label {...props} className={cn("flex min-w-0 flex-col gap-1.5 text-[13px] font-bold text-muted-foreground", className)}>{children}</label>;
}

export type NoticeKind = "info" | "progress" | "success" | "warning" | "error";

export function UtilityNotice({
  kind = "info",
  title,
  children,
  icon,
  actions,
  density = "normal",
  announce = "off",
  role,
  className,
  id,
  "data-testid": testId,
  tone,
  ...props
}: {
  kind?: NoticeKind;
  title?: React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  density?: "compact" | "normal";
  announce?: "off" | "polite" | "assertive";
  role?: "alert" | "status";
  className?: string;
  id?: string;
  "data-testid"?: string;
  tone?: "warning" | "error" | "success" | "info" | "progress";
} & Omit<React.ComponentProps<"div">, "title" | "children" | "id" | "className" | "role">) {
  const actualKind = tone ? (tone as NoticeKind) : kind;
  
  let DefaultIcon = Info;
  if (actualKind === "warning") DefaultIcon = AlertTriangle;
  else if (actualKind === "error") DefaultIcon = AlertCircle;
  else if (actualKind === "success") DefaultIcon = CheckCircle2;
  else if (actualKind === "progress") DefaultIcon = Loader2;

  return (
    <div
      id={id}
      data-testid={testId}
      {...props}
      className={cn(
        "relative w-full rounded-2xl border bg-primary/5 text-sm text-muted-foreground border-primary/10",
        density === "compact" ? "px-3 py-2" : "px-4 py-3",
        className
      )}
      data-slot="notice"
      data-ui-component="UtilityNotice"
      role={role || (announce !== "off" ? (announce === "assertive" ? "alert" : "status") : (actualKind === "error" || actualKind === "warning" ? "alert" : (actualKind === "progress" || actualKind === "success" ? "status" : undefined)))}
      aria-live={announce === "off" ? undefined : announce}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 shrink-0", 
          actualKind === "error" && "text-destructive",
          actualKind === "warning" && "text-amber-500",
          actualKind === "success" && "text-green-500",
          actualKind === "info" && "text-primary",
          actualKind === "progress" && "text-primary animate-spin"
        )}>
          {icon ?? <DefaultIcon size={18} />}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {title && <h5 className="font-medium text-primary">{title}</h5>}
          <div className="leading-relaxed">{children}</div>
          {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
