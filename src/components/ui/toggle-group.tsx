import * as React from "react";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { renderPrimitive, useControlledState } from "./primitive";
import { toggleVariants } from "@/components/ui/toggle";

interface ToggleGroupState {
  toggleItem: (itemValue: string | undefined, event: React.SyntheticEvent) => void;
  registerItem: (itemValue: string | undefined, element: HTMLButtonElement | null) => void;
  moveFocus: (fromValue: string | undefined, direction: 1 | -1 | "home" | "end") => void;
  groupDisabled: boolean;
  selectedValues: string[];
  tabStopValue: string | null;
  setFocusValue: (next: string | null) => void;
}

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number;
    orientation?: "horizontal" | "vertical";
    state?: ToggleGroupState;
  }
>({
  size: "default",
  variant: "default",
  spacing: 2,
  orientation: "horizontal",
});

export interface ToggleGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue">, VariantProps<typeof toggleVariants> {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (next: string[], details?: { event: React.SyntheticEvent }) => void;
  multiple?: boolean;
  disabled?: boolean;
  spacing?: number;
  orientation?: "horizontal" | "vertical";
  loop?: boolean;
}

function ToggleGroup({
  className,
  variant,
  size,
  spacing = 2,
  orientation = "horizontal",
  loop = true,
  value: controlledValue,
  defaultValue = [],
  onValueChange,
  multiple = false,
  disabled = false,
  children,
  ref,
  ...props
}: ToggleGroupProps & { ref?: React.Ref<HTMLDivElement> }) {
  const [value, setValue] = useControlledState(controlledValue, defaultValue);
  const itemElements = React.useRef(new Map<string, HTMLButtonElement>());
  const groupRoot = React.useRef<HTMLDivElement | null>(null);
  const [focusValue, setFocusValue] = React.useState<string | null>(null);

  const requestValue = React.useCallback((next: string[], event: React.SyntheticEvent) => {
    if (disabled) return;
    if (controlledValue === undefined) setValue(next);
    onValueChange?.(next, { event });
  }, [controlledValue, disabled, onValueChange, setValue]);

  const groupOrder = React.useCallback((): string[] => {
    const root = groupRoot.current;
    if (!root) return [...itemElements.current.keys()];
    const ordered = [...root.querySelectorAll<HTMLButtonElement>("[data-tg-value]")]
      .map((element) => element.getAttribute("data-tg-value") ?? "")
      .filter(Boolean);
    return ordered.length ? ordered : [...itemElements.current.keys()];
  }, []);

  const domOrder = groupOrder;

  const toggleItem = React.useCallback((itemValue: string | undefined, event: React.SyntheticEvent) => {
    if (itemValue === undefined) {
      if (process.env.NODE_ENV !== "production") {
        console.error("ToggleGroupItem requires a value.");
      }
      return;
    }
    const current = value;
    let next: string[];
    if (multiple) {
      const toggled = current.includes(itemValue)
        ? current.filter((entry) => entry !== itemValue)
        : [...current, itemValue];
      const order = groupOrder();
      next = [...new Set(order.filter((entry) => toggled.includes(entry)))];
      for (const entry of toggled) if (!next.includes(entry)) next.push(entry);
    } else {
      next = current.includes(itemValue) ? [] : [itemValue];
    }
    requestValue(next, event);
  }, [multiple, requestValue, value, groupOrder]);

  const enabledValues = React.useCallback((): string[] => groupOrder().filter((entry) => {
    const element = itemElements.current.get(entry);
    return element !== undefined && !element.disabled;
  }), [groupOrder]);

  const moveFocus = React.useCallback((fromValue: string | undefined, direction: 1 | -1 | "home" | "end") => {
    const enabled = enabledValues();
    if (!enabled.length) return;
    let next: string;
    if (direction === "home") next = enabled[0];
    else if (direction === "end") next = enabled[enabled.length - 1];
    else {
      const index = enabled.indexOf(fromValue ?? "");
      const candidate = (index === -1 ? (direction === 1 ? -1 : 0) : index) + direction;
      if (candidate < 0 || candidate >= enabled.length) {
        if (!loop) return;
        next = enabled[(candidate + enabled.length) % enabled.length];
      } else next = enabled[candidate];
    }
    setFocusValue(next);
    itemElements.current.get(next)?.focus();
  }, [enabledValues, loop]);

  const registerItem = React.useCallback((itemValue: string | undefined, element: HTMLButtonElement | null) => {
    if (itemValue === undefined) {
      if (process.env.NODE_ENV !== "production") {
        console.error("ToggleGroupItem requires a value.");
      }
      return;
    }
    if (element) {
      const previous = itemElements.current.get(itemValue);
      if (previous && previous !== element && process.env.NODE_ENV !== "production") {
        console.error(`ToggleGroupItem value "${itemValue}" is duplicated.`);
      }
      itemElements.current.set(itemValue, element);
      return;
    }
    const order = groupOrder().filter((entry) => entry !== itemValue && itemElements.current.has(entry));
    const wasTabStop = focusValue === itemValue;
    itemElements.current.delete(itemValue);
    if (!wasTabStop) return;
    // Keep focus near the removed item: next enabled sibling, else previous.
    const removedIndex = groupOrder().indexOf(itemValue);
    const candidates = [...order.slice(Math.max(0, removedIndex)), ...order.slice(0, Math.max(0, removedIndex))];
    const enabled = candidates.filter((entry) => {
      const node = itemElements.current.get(entry);
      return node !== undefined && !node.disabled;
    });
    setFocusValue(enabled[0] ?? null);
    // Never pull focus in from outside the group: only recover when focus was
    // lost to the body or is still inside this group.
    const active = typeof document === "undefined" ? null : document.activeElement;
    if (enabled[0] !== undefined && (active === document.body || (active && groupRoot.current?.contains(active)))) {
      itemElements.current.get(enabled[0])?.focus();
    }
  }, [focusValue, groupOrder]);

  const tabStopValue = React.useMemo(() => {
    if (focusValue !== null && itemElements.current.has(focusValue)) return focusValue;
    const enabled = enabledValues();
    return enabled.find((entry) => value.includes(entry)) ?? enabled[0] ?? null;
  }, [focusValue, enabledValues, value]);

  const state = React.useMemo<ToggleGroupState>(() => ({
    toggleItem,
    registerItem,
    moveFocus,
    groupDisabled: disabled,
    selectedValues: value,
    tabStopValue,
    setFocusValue,
  }), [toggleItem, registerItem, moveFocus, disabled, value, tabStopValue]);

  return renderPrimitive("div", undefined, {
    "data-slot": "toggle-group",
    "data-variant": variant,
    "data-size": size,
    "data-spacing": spacing,
    "data-orientation": orientation,
    role: "group",
    "aria-disabled": disabled || undefined,
    style: { "--gap": spacing } as React.CSSProperties,
    className: cn(
      "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] data-[spacing=0]:data-[variant=outline]:rounded-3xl data-vertical:flex-col data-vertical:items-stretch",
      className
    ),
    ref: (element: HTMLElement | null) => {
      groupRoot.current = element as HTMLDivElement | null;
      if (typeof ref === "function") ref(element as HTMLDivElement | null);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = element as HTMLDivElement | null;
    },
  }, {
    ...props,
    children: (
      <ToggleGroupContext.Provider
        value={{ variant, size, spacing, orientation, state }}
      >
        {children}
      </ToggleGroupContext.Provider>
    ),
  }, {
    "data-slot": "toggle-group",
    role: "group",
  });
}

export interface ToggleGroupItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value" | "defaultValue"> {
  render?: React.ReactElement<{
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }>;
  value?: string;
  disabled?: boolean;
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  value: itemValue,
  disabled = false,
  render,
  ref,
  onClick,
  onKeyDown,
  ...props
}: ToggleGroupItemProps & VariantProps<typeof toggleVariants> & { ref?: React.Ref<HTMLButtonElement> }) {
  const context = React.useContext(ToggleGroupContext);
  const state = context.state;
  const resolvedVariant = context.variant || variant;
  const resolvedSize = context.size || size;
  const selected = (state?.selectedValues ?? []).includes(itemValue ?? "");
  const itemDisabled = disabled || state?.groupDisabled;
  const isTabStop = state ? state.tabStopValue === itemValue : false;
  return renderPrimitive("button", render, {
    "data-slot": "toggle-group-item",
    "data-variant": resolvedVariant,
    "data-size": resolvedSize,
    "data-spacing": context.spacing,
    type: "button",
    "aria-pressed": selected,
    "aria-disabled": itemDisabled || undefined,
    disabled: itemDisabled || undefined,
    tabIndex: isTabStop ? 0 : -1,
    "data-tg-value": itemValue,
    className: cn(
      "shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-3 group-data-[spacing=0]/toggle-group:shadow-none focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-2.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-2.5 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-3xl group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-3xl group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-3xl group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-3xl aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
      toggleVariants({
        variant: resolvedVariant,
        size: resolvedSize,
      }),
      className
    ),
    ref: (element: HTMLElement | null) => {
      state?.registerItem(itemValue, element as HTMLButtonElement | null);
      if (typeof ref === "function") ref(element as HTMLButtonElement | null);
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = element as HTMLButtonElement | null;
    },
    guard: itemDisabled ? () => true : undefined,
    onClick: (event: React.MouseEvent<HTMLElement>) => state?.toggleItem(itemValue, event),
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      const orientation = context.orientation ?? "horizontal";
      const key = (event as React.KeyboardEvent).key;
      if (orientation === "horizontal" && key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") return;
      if (orientation === "vertical" && key !== "ArrowUp" && key !== "ArrowDown" && key !== "Home" && key !== "End") return;
      event.preventDefault();
      if (key === "Home") state?.moveFocus(itemValue, "home");
      else if (key === "End") state?.moveFocus(itemValue, "end");
      else if (key === "ArrowRight" || key === "ArrowDown") state?.moveFocus(itemValue, 1);
      else state?.moveFocus(itemValue, -1);
    },
  }, {
    ...props,
    onClick,
    onKeyDown,
    children,
  }, {
    "data-slot": "toggle-group-item",
    "aria-pressed": selected,
  });
}

export { ToggleGroup, ToggleGroupItem };
