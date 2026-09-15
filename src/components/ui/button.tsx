import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { mergeRefs, renderPrimitive } from "./primitive";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-4xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary)82%,black)]",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-transparent dark:hover:bg-input/30",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type ButtonRender = React.ReactElement<{
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}>;

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled">,
  VariantProps<typeof buttonVariants> {
  render?: ButtonRender;
  busy?: boolean;
  disabled?: boolean;
}

function isAnchorRender(render: ButtonRender): boolean {
  const type = render.type;
  if (typeof type === "string") return type === "a";
  const name = (type as { displayName?: string; name?: string })?.displayName
    ?? (type as { displayName?: string; name?: string })?.name
    ?? "";
  return name === "Link" || name === "NavLink";
}

function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  render,
  busy = false,
  disabled = false,
  children,
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const inactive = disabled || busy;
  const renderIsAnchor = render !== undefined && isAnchorRender(render);
  const anchorDisabled = inactive && renderIsAnchor;
  // A disabled anchor keeps no executable destination: strip href/to from the
  // element itself (prop order in the merge would otherwise restore it), mark
  // it, remove it from tab order, and block activation including aux clicks.
  const safeRender = anchorDisabled && render
    ? React.cloneElement(render, { href: undefined, to: undefined } as Record<string, unknown>)
    : render;
  return renderPrimitive("button", safeRender, {
    "data-slot": "button",
    ...(renderIsAnchor ? { type: undefined } : { type }),
    disabled: render ? undefined : inactive || undefined,
    "aria-disabled": anchorDisabled || undefined,
    "aria-busy": busy || undefined,
    tabIndex: anchorDisabled ? -1 : undefined,
    className: cn(buttonVariants({ variant, size, className })),
    ref,
    guard: inactive ? () => true : undefined,
    onClick: undefined,
  }, {
    ...props,
    children: (
      <>
        {busy && (
          <svg className="animate-spin" width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
        )}
        {children}
      </>
    ),
  }, {
    "data-slot": "button",
    "aria-disabled": anchorDisabled || undefined,
    "aria-busy": busy || undefined,
  });
}

export { Button, buttonVariants };
