import * as React from "react";

import { cn } from "@/lib/utils";
import { renderPrimitive, useControlledState } from "./primitive";

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value" | "defaultValue"> {
  render?: React.ReactElement<{
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }>;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (next: boolean, details?: { event: React.SyntheticEvent }) => void;
  disabled?: boolean;
  readOnly?: boolean;
  size?: "sm" | "default";
  id?: string;
  name?: string;
  value?: string;
  nativeButton?: unknown;
}

function Switch({
  className,
  size = "default",
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  readOnly = false,
  id,
  name,
  value,
  nativeButton: _nativeButton,
  render,
  ref,
  onClick,
  onKeyDown,
  ...props
}: SwitchProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const [checked, setChecked] = useControlledState(controlledChecked, defaultChecked);
  const toggle = (event: React.SyntheticEvent) => {
    if (disabled || readOnly) return;
    const next = !checked;
    if (controlledChecked === undefined) setChecked(next);
    onCheckedChange?.(next, { event });
  };
  return (
    <>
      {renderPrimitive("button", render, {
        "data-slot": "switch",
        "data-size": size,
        type: "button",
        role: "switch",
        "aria-checked": checked,
        "aria-readonly": readOnly || undefined,
        "aria-disabled": disabled || undefined,
        disabled: disabled || undefined,
        id,
        className: cn(
          "peer group/switch relative inline-flex shrink-0 items-center rounded-full border-0 p-0 transition-all outline-none group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[25px] data-[size=default]:w-[43px] data-[size=sm]:h-[22px] data-[size=sm]:w-9 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input/90 data-disabled:cursor-not-allowed data-disabled:opacity-50",
          className
        ),
        ref,
        "data-checked": checked || undefined,
        "data-unchecked": checked ? undefined : "",
        "data-disabled": disabled || undefined,
        guard: disabled || readOnly ? () => true : undefined,
        onClick: (event: React.MouseEvent<HTMLElement>) => toggle(event),
      }, {
        ...props,
        onClick,
        onKeyDown,
        children: (
          <span
            data-slot="switch-thumb"
            aria-hidden="true"
            className="pointer-events-none block rounded-full bg-background shadow-sm ring-0 transition-transform not-dark:bg-clip-padding group-data-[size=default]/switch:size-[21px] group-data-[size=sm]/switch:size-[18px] data-checked:translate-x-5 group-data-[size=sm]/switch:data-checked:translate-x-4 data-unchecked:translate-x-0.5 dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground"
            data-checked={checked || undefined}
            data-unchecked={checked ? undefined : ""}
          />
        ),
      }, {
        "data-slot": "switch",
        role: "switch",
        "aria-checked": checked,
      })}
      {name !== undefined && (
        <input type="checkbox" name={name} value={value ?? "on"} checked={checked} readOnly tabIndex={-1} aria-hidden="true" style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />
      )}
    </>
  );
}

export { Switch };
