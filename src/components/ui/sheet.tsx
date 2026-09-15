import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

// Self-implemented modal drawer (W1b). Public import paths, export names,
// props, classes, and data-slot attributes stay identical; only the Base UI
// machinery underneath is replaced by a native <dialog> foundation.

type CloseReason = "trigger" | "close-button" | "escape" | "outside" | "route" | "resize";

interface SheetState {
  open: boolean;
  requestOpen: (event: React.SyntheticEvent) => void;
  requestClose: (reason: CloseReason, event?: React.SyntheticEvent) => void;
  triggerId: string | undefined;
  registerTrigger: (id: string | undefined) => void;
  titleId: string | undefined;
  setTitleId: (id: string | undefined) => void;
  descriptionId: string | undefined;
  setDescriptionId: (id: string | undefined) => void;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
}

const SheetContext = React.createContext<SheetState | null>(null);

function useSheetState(): SheetState {
  const state = React.useContext(SheetContext);
  if (!state) throw new Error("Sheet components must render inside <Sheet>.");
  return state;
}

// Process-wide modal stack: only the topmost entry answers Escape/outside
// gestures. Entries clean up exactly once via their generation guard.
const modalStack: Array<{ generation: number; close: (reason: CloseReason) => void }> = [];

let scrollLockCount = 0;
let savedBodyOverflow = "";
let savedBodyPaddingRight = "";
let savedScrollY = 0;

function lockBodyScroll(): void {
  if (scrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    savedBodyPaddingRight = document.body.style.paddingRight;
    savedScrollY = window.scrollY;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
  }
  scrollLockCount += 1;
}

function unlockBodyScroll(): void {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = savedBodyOverflow;
    document.body.style.paddingRight = savedBodyPaddingRight;
  }
}

function supportsModalDialog(): boolean {
  if (typeof HTMLDialogElement === "undefined") return false;
  try {
    const probe = document.createElement("dialog");
    return typeof probe.showModal === "function";
  } catch {
    return false;
  }
}

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details?: { reason: CloseReason | "trigger-open" | "program"; event?: React.SyntheticEvent }) => void;
  triggerId?: string;
  children?: React.ReactNode;
}

function Sheet({ open: controlledOpen, defaultOpen = false, onOpenChange, triggerId, children }: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const [registeredTriggerId, setRegisteredTriggerId] = React.useState<string | undefined>(triggerId);
  const [titleId, setTitleId] = React.useState<string | undefined>(undefined);
  const [descriptionId, setDescriptionId] = React.useState<string | undefined>(undefined);
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);
  const generationRef = React.useRef(0);
  const openRef = React.useRef(open);
  openRef.current = open;

  const setOpen = React.useCallback((next: boolean, reason: CloseReason | "trigger-open" | "program", event?: React.SyntheticEvent) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next, { reason, event });
  }, [controlledOpen, onOpenChange]);
  const requestOpen = React.useCallback((event?: React.SyntheticEvent) => {
    setOpen(true, "trigger-open", event);
  }, [setOpen]);

  const requestClose = React.useCallback((reason: CloseReason, event?: React.SyntheticEvent) => {
    setOpen(false, reason, event);
  }, [setOpen]);

  const state = React.useMemo<SheetState>(() => ({
    open,
    requestOpen,
    requestClose,
    triggerId: registeredTriggerId ?? triggerId,
    registerTrigger: (id) => setRegisteredTriggerId((current) => current ?? id),
    titleId,
    setTitleId,
    descriptionId,
    setDescriptionId,
    dialogRef,
  }), [open, requestOpen, requestClose, registeredTriggerId, triggerId, titleId, descriptionId]);

  return <SheetContext.Provider value={state}>{children}</SheetContext.Provider>;
}

function SheetPortal({ children }: { children?: React.ReactNode }) {
  return createPortal(<div data-slot="sheet-portal">{children}</div>, document.body);
}

function SheetTrigger({ id, render, children, onClick, ...props }: {
  id?: string;
  render?: React.ReactElement;
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLElement>;
} & Record<string, unknown>) {
  const { requestOpen, registerTrigger } = useSheetState();
  React.useEffect(() => {
    if (id) registerTrigger(id);
  }, [id, registerTrigger]);
  if (!render) {
    return (
      <button data-slot="sheet-trigger" id={id} type="button" onClick={(event: React.MouseEvent<HTMLElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        requestOpen(event);
      }} {...props}>
        {children}
      </button>
    );
  }
  return React.cloneElement(render as React.ReactElement<Record<string, unknown>>, {
    ...(render as React.ReactElement<Record<string, unknown>>).props,
    ...props,
    id: (render as React.ReactElement<Record<string, unknown>>).props.id ?? (props.id as string | undefined) ?? id,
    "data-slot": "sheet-trigger",
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      ((render as React.ReactElement<Record<string, unknown>>).props.onClick as React.MouseEventHandler<HTMLElement> | undefined)?.(event);
      if (event.defaultPrevented) return;
      onClick?.(event);
      if (event.defaultPrevented) return;
      requestOpen(event);
    },
  } as Record<string, unknown>);
}

function SheetClose({ render, children, onClick, ...props }: {
  render?: React.ReactElement;
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLElement>;
} & Record<string, unknown>) {
  const { requestClose } = useSheetState();
  const activate = (event: React.MouseEvent<HTMLElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    requestClose("close-button", event);
  };
  if (!render) {
    return (
      <button data-slot="sheet-close" type="button" onClick={activate} {...props}>
        {children}
      </button>
    );
  }
  return React.cloneElement(render as React.ReactElement<Record<string, unknown>>, {
    ...(render as React.ReactElement<Record<string, unknown>>).props,
    ...props,
    "data-slot": "sheet-close",
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      ((render as React.ReactElement<Record<string, unknown>>).props.onClick as React.MouseEventHandler<HTMLElement> | undefined)?.(event);
      if (event.defaultPrevented) return;
      activate(event);
    },
  } as Record<string, unknown>);
}

function SheetOverlay({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { requestClose } = useSheetState();
  const pointer = React.useRef<{ id: number; outsideDown: boolean } | null>(null);
  return (
    <div
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm",
        className
      )}
      onPointerDown={(event) => {
        pointer.current = { id: event.pointerId, outsideDown: event.target === event.currentTarget };
      }}
      onPointerUp={(event) => {
        const tracked = pointer.current;
        pointer.current = null;
        if (!tracked || tracked.id !== event.pointerId || event.type === "pointercancel") return;
        if (tracked.outsideDown && event.target === event.currentTarget) requestClose("outside", event);
      }}
      onPointerCancel={() => {
        pointer.current = null;
      }}
      {...props}
    />
  );
}

function focusablesIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => {
    if (element.hasAttribute("disabled") || element.getAttribute("aria-hidden") === "true") return false;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none";
  });
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  overlayClassName,
  ...props
}: React.DialogHTMLAttributes<HTMLDialogElement> & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
  overlayClassName?: string;
}) {
  const { open, requestClose, titleId, descriptionId, dialogRef, triggerId } = useSheetState();
  const generationRef = React.useRef(0);
  const openerRef = React.useRef<HTMLElement | null>(null);
  const [modalSupported] = React.useState(() => supportsModalDialog());
  const openRefState = React.useRef(open);
  openRefState.current = open;
  const requestCloseRef = React.useRef(requestClose);
  requestCloseRef.current = requestClose;

  // Opening sequence runs once per committed open; identity churn of parent
  // callbacks must not tear it down (refs carry the latest values).
  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || !modalSupported) return;
    const generation = ++generationRef.current;
    openerRef.current = (triggerId ? document.getElementById(triggerId) : null)
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    lockBodyScroll();
    const entry = {
      generation,
      close: (reason: CloseReason) => {
        if (generationRef.current !== generation || !openRefState.current) return;
        requestCloseRef.current(reason);
      },
    };
    modalStack.push(entry);
    let settled = false;
    try {
      if (!dialog.open) dialog.showModal();
      settled = true;
    } catch {
      settled = false;
    }
    if (!settled) {
      modalStack.splice(modalStack.indexOf(entry), 1);
      unlockBodyScroll();
      return;
    }
    focusInitial(dialog);
    const onCancel = (event: Event) => {
      event.preventDefault();
      if (modalStack[modalStack.length - 1]?.generation !== generation) return;
      requestCloseRef.current("escape", event as unknown as React.SyntheticEvent);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      if (modalStack[modalStack.length - 1]?.generation !== generation) return;
      trapTab(dialog, event);
    };
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("keydown", onKeyDown);
      const index = modalStack.indexOf(entry);
      if (index !== -1) modalStack.splice(index, 1);
      if (dialog.open) dialog.close();
      unlockBodyScroll();
      restoreFocus();
    };
  }, [open, modalSupported]);

  function restoreFocus() {
    const opener = openerRef.current;
    const usable = (element: HTMLElement | null) => {
      if (!element || !element.isConnected) return false;
      if (element.hasAttribute("disabled")) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    if (usable(opener)) {
      opener!.focus();
      return;
    }
    const fallback = document.getElementById("mobile-navigation-trigger");
    if (usable(fallback)) {
      fallback!.focus();
      return;
    }
    const main = document.querySelector("main");
    if (main instanceof HTMLElement) {
      if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
      main.focus();
    }
  }

  function focusInitial(dialog: HTMLDialogElement) {
    const explicit = dialog.querySelector<HTMLElement>("[data-autofocus='true']");
    if (explicit) {
      explicit.focus();
      return;
    }
    const closeButton = dialog.querySelector<HTMLElement>("[data-slot='sheet-close']");
    if (closeButton && !closeButton.hasAttribute("disabled")) {
      closeButton.focus();
      return;
    }
    const [first] = focusablesIn(dialog);
    if (first) {
      first.focus();
      return;
    }
    if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
    dialog.focus();
  }

  function trapTab(dialog: HTMLDialogElement, event: KeyboardEvent) {
    const focusables = focusablesIn(dialog);
    if (focusables.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    if (focusables.length === 1) {
      event.preventDefault();
      focusables[0].focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;
  if (!modalSupported) {
    // No native modal support: inline fallback keeps every destination
    // reachable without claiming modal or trap behavior.
    return (
      <div data-slot="sheet-content" data-side={side} data-modal-fallback="inline" className={cn("flex flex-col", className)} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    );
  }
  const dialogProps = props as React.DialogHTMLAttributes<HTMLDialogElement>;
  return (
    <SheetPortal>
      <dialog
        ref={dialogRef}
        data-slot="sheet-content"
        data-side={side}
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="fixed inset-0 z-50 m-0 h-full w-full max-w-none bg-transparent p-0"
        {...dialogProps}
      >
        <SheetOverlay className={overlayClassName} />
        <div
          data-slot="sheet-panel"
          data-side={side}
          className={cn(
            "relative z-50 flex flex-col bg-popover bg-clip-padding text-sm text-popover-foreground shadow-xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
            className
          )}
        >
          {children}
          {showCloseButton && (
            <SheetClose
              render={
                <Button
                  variant="ghost"
                  className="absolute top-4 right-4 bg-secondary"
                  size="icon-sm"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </SheetClose>
          )}
        </div>
      </dialog>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-6", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-6", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, id, ...props }: React.ComponentProps<"div"> & { id?: string }) {
  const { setTitleId } = useSheetState();
  const generated = React.useId();
  const resolvedId = id ?? `sheet-title-${generated.replace(/[^a-zA-Z0-9]/g, "")}`;
  React.useEffect(() => {
    setTitleId(resolvedId);
    return () => setTitleId(undefined);
  }, [resolvedId, setTitleId]);
  return (
    <div
      data-slot="sheet-title"
      id={resolvedId}
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  );
}

function SheetDescription({ className, id, ...props }: React.ComponentProps<"div"> & { id?: string }) {
  const { setDescriptionId } = useSheetState();
  const generated = React.useId();
  const resolvedId = id ?? `sheet-description-${generated.replace(/[^a-zA-Z0-9]/g, "")}`;
  React.useEffect(() => {
    setDescriptionId(resolvedId);
    return () => setDescriptionId(undefined);
  }, [resolvedId, setDescriptionId]);
  return (
    <div
      data-slot="sheet-description"
      id={resolvedId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
