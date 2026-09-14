import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { renderPrimitive, useControlledState } from "./primitive";

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-3xl text-sm font-medium whitespace-nowrap transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-muted",
      },
      size: {
        default:
          "h-9 min-w-9 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        sm: "h-8 min-w-8 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-10 min-w-10 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value" | "defaultValue">, VariantProps<typeof toggleVariants> {
  render?: React.ReactElement<{
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }>;
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (next: boolean, details?: { event: React.SyntheticEvent }) => void;
}

function Toggle({
  className,
  variant = "default",
  size = "default",
  pressed: controlledPressed,
  defaultPressed = false,
  onPressedChange,
  disabled = false,
  render,
  ref,
  onClick,
  onKeyDown,
  ...props
}: ToggleProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const [pressed, setPressed] = useControlledState(controlledPressed, defaultPressed);
  const activate = (event: React.SyntheticEvent) => {
    if (disabled) return;
    const next = !pressed;
    if (controlledPressed === undefined) setPressed(next);
    onPressedChange?.(next, { event });
  };
  return renderPrimitive("button", render, {
    "data-slot": "toggle",
    type: "button",
    "aria-pressed": pressed,
    "aria-disabled": disabled || undefined,
    disabled: disabled || undefined,
    className: cn(toggleVariants({ variant, size, className })),
    ref,
    guard: disabled ? () => true : undefined,
    onClick: (event: React.MouseEvent<HTMLElement>) => activate(event),
  }, {
    ...props,
    onClick,
    onKeyDown,
  }, {
    "data-slot": "toggle",
    "aria-pressed": pressed,
  });
}

export { Toggle, toggleVariants };
