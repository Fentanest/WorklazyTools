import type {
  ComponentProps,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "../lib/utils";
import { SectionCard } from "./ui";

export const pairedEditorClassName = "h-80 min-h-80 max-h-80 flex-none resize-none";

export function UtilityPage({ toolId, children, className, flush = false }: { toolId: string; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <div
      data-tool-page={toolId}
      className={cn(
        "mx-auto w-full max-w-[1030px]",
        !flush && "pt-[61px] pb-[52px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 max-[820px]:pt-[calc(84px+env(safe-area-inset-top))] max-[820px]:pb-[calc(92px+env(safe-area-inset-bottom))]",
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

export function UtilityNotice({ children, className, tone = "warning", role, ...props }: {
  children: ReactNode;
  className?: string;
  tone?: "warning" | "error" | "success";
  role?: "alert" | "status";
} & Omit<ComponentProps<"div">, "children" | "className" | "role">) {
  return (
    <div
      data-slot="notice"
      role={role}
      {...props}
      className={cn(
        "flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm leading-relaxed",
        tone === "warning" && "bg-amber-500/10 text-amber-800 dark:text-amber-300",
        tone === "error" && "bg-destructive/10 text-destructive",
        tone === "success" && "bg-green-500/10 text-green-800 dark:text-green-300",
        className,
      )}
    >
      {children}
    </div>
  );
}
