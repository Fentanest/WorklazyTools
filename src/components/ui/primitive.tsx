import * as React from "react";

import { cn } from "@/lib/utils";

// Shared internals for the self-implemented primitives (W1a). Public import
// paths, export names, and consumed props stay identical; only the Base UI
// machinery underneath is replaced.

export function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(value);
      else if (ref) (ref as React.MutableRefObject<T | null>).current = value;
    }
  };
}

type RenderElement = React.ReactElement<Record<string, unknown>>;

function isRenderElement(value: unknown): value is RenderElement {
  return React.isValidElement(value);
}

export interface PrimitiveHandlers {
  onClick?: React.MouseEventHandler<HTMLElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
}

/**
 * Renders either the host element or a single consumer `render` element.
 * Merge order is internal -> render -> consumer for className/style, and
 * consumer -> render -> internal for handlers. `guard` runs before every
 * handler (disabled/busy blocking, capture-phase anchor blocking); a handler
 * that observes defaultPrevented still blocks internal behavior, and the same
 * function reference is never invoked twice for one event. Required ARIA
 * passed through `internal`/`consumer` props always wins because callers put
 * it after user props are merged.
 */
export function renderPrimitive<Tag extends keyof React.JSX.IntrinsicElements>(
  tag: Tag,
  render: unknown,
  internal: PrimitiveHandlers & {
    className?: string;
    style?: React.CSSProperties;
    ref?: React.Ref<HTMLElement>;
    guard?: (event: React.SyntheticEvent) => boolean;
  } & Record<string, unknown>,
  consumer: {
    className?: unknown;
    style?: unknown;
    children?: React.ReactNode;
  } & Record<string, unknown>,
  protectedProps?: Record<string, unknown>,
): React.ReactElement {
  const { className: consumerClassName, style: consumerStyle, children, onClick: consumerClick, onKeyDown: consumerKey, ...consumerRest } = consumer;
  const { className: internalClassName, style: internalStyle, ref: internalRef, guard, onClick: internalClick, onKeyDown: internalKey, ...internalRest } = internal;
  const sequence = (
    phase: "click" | "key",
    renderClick: ((event: never) => void) | undefined,
    renderKey: ((event: never) => void) | undefined,
  ) => (event: React.SyntheticEvent) => {
    const called = new Set<unknown>();
    const once = <E,>(handler: ((event: E) => void) | undefined) => handler === undefined
      ? undefined
      : (inner: E) => {
        if (called.has(handler)) return;
        called.add(handler);
        handler(inner);
      };
    if (guard?.(event)) {
      event.preventDefault();
      return;
    }
    if (phase === "click") {
      (once(consumerClick as ((event: never) => void) | undefined) as ((event: never) => void) | undefined)?.(event as never);
      (once(renderClick) as ((event: never) => void) | undefined)?.(event as never);
    } else {
      (once(consumerKey as ((event: never) => void) | undefined) as ((event: never) => void) | undefined)?.(event as never);
      (once(renderKey) as ((event: never) => void) | undefined)?.(event as never);
    }
    if (event.defaultPrevented) return;
    if (phase === "click") (once(internalClick as ((event: never) => void) | undefined) as ((event: never) => void) | undefined)?.(event as never);
    else (once(internalKey as ((event: never) => void) | undefined) as ((event: never) => void) | undefined)?.(event as never);
  };
  const chainClick: React.MouseEventHandler<HTMLElement> | undefined =
    consumerClick || internalClick ? (event) => sequence("click", undefined, undefined)(event) : undefined;
  const chainKeyDown: React.KeyboardEventHandler<HTMLElement> | undefined =
    consumerKey || internalKey ? (event) => sequence("key", undefined, undefined)(event) : undefined;
  if (!isRenderElement(render)) {
    const TagName = tag as React.ElementType;
    return (
      <TagName
        {...internalRest}
        {...consumerRest}
        ref={mergeRefs(internalRef, consumer.ref as React.Ref<HTMLElement> | undefined)}
        className={cn(internalClassName, consumerClassName as string | undefined)}
        style={{ ...internalStyle, ...((consumerStyle ?? {}) as React.CSSProperties) }}
        onClick={chainClick}
        onKeyDown={chainKeyDown}
      >
        {children}
      </TagName>
    );
  }
  const elementProps = render.props as Record<string, unknown>;
  const withRenderHandlers = (
    phase: "click" | "key",
    base: React.MouseEventHandler<HTMLElement> | React.KeyboardEventHandler<HTMLElement> | undefined,
    renderHandler: ((event: never) => void) | undefined,
  ) => (base || renderHandler
    ? ((event: React.SyntheticEvent) => sequence(
      phase,
      phase === "click" ? renderHandler : undefined,
      phase === "key" ? renderHandler : undefined,
    )(event)) as never
    : undefined);
  const {
    onClick: _droppedElementClick,
    onKeyDown: _droppedElementKey,
    ref: _droppedElementRef,
    className: _droppedElementClass,
    style: _droppedElementStyle,
    children: _droppedElementChildren,
    ...elementRest
  } = elementProps;
  void _droppedElementClick;
  void _droppedElementKey;
  void _droppedElementRef;
  void _droppedElementClass;
  void _droppedElementStyle;
  void _droppedElementChildren;
  return React.cloneElement(render, {
    ...internalRest,
    ...consumerRest,
    ...elementRest,
    ...protectedProps,
    ref: mergeRefs(
      internalRef,
      consumer.ref as React.Ref<HTMLElement> | undefined,
      elementProps.ref as React.Ref<HTMLElement> | undefined,
    ),
    className: cn(internalClassName, elementProps.className as string | undefined, consumerClassName as string | undefined),
    style: {
      ...internalStyle,
      ...((elementProps.style ?? {}) as React.CSSProperties),
      ...((consumerStyle ?? {}) as React.CSSProperties),
    },
    onClick: withRenderHandlers("click", chainClick, elementProps.onClick as ((event: never) => void) | undefined),
    onKeyDown: withRenderHandlers("key", chainKeyDown, elementProps.onKeyDown as ((event: never) => void) | undefined),
    children: children ?? elementProps.children,
  } as Record<string, unknown>);
}

export function useControlledState<T>(controlled: T | undefined, defaultValue: T): [T, (next: T) => void] {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const isControlled = controlled !== undefined;
  return [isControlled ? controlled : uncontrolled, setUncontrolled];
}
