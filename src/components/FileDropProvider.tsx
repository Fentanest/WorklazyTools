import { createContext, useContext, useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";

export function acceptsFile(file: File, accept: string) {
  return !accept || accept.split(",").some(value => {
    const rule = value.trim().toLowerCase();
    return rule.startsWith(".") ? file.name.toLowerCase().endsWith(rule)
      : rule.endsWith("/*") ? file.type.toLowerCase().startsWith(rule.slice(0, -1))
      : file.type.toLowerCase() === rule;
  });
}
export function isFileDrag(event: { dataTransfer: DataTransfer | null }) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}
type Target = { element: () => HTMLElement | null; label: () => string; accept: string; disabled: boolean; receive: (files: File[]) => void | Promise<void> };
function available(target: Target) {
  const element = target.element();
  return !!element?.isConnected && !element.closest('[hidden], [aria-hidden="true"], [inert]');
}
type Registry = { register: (id: string, target: () => Target) => () => void };
const Context = createContext<Registry | null>(null);

/** A single capture listener owns external drops. Internal reorder events pass through. */
export function FileDropProvider({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  const { t } = useTranslation("common");
  const targets = useRef(new Map<string, () => Target>());
  const [active, setActive] = useState(false);
  const [notice, setNotice] = useState("");
  const [choice, setChoice] = useState<{ files: File[]; ids: string[]; x: number; y: number } | null>(null);
  const registry = useRef<Registry>({ register: (id, target) => { targets.current.set(id, target); return () => { targets.current.delete(id); }; } }).current;
  const copy = useRef(t); copy.current = t;
  const deliver = async (id: string, files: File[]) => {
    const target = targets.current.get(id)?.();
    if (!target || !available(target)) return;
    if (target.disabled) { setNotice(copy.current("files.dropBusy")); return; }
    if (!files.every(file => acceptsFile(file, target.accept))) { setNotice(copy.current("files.dropUnsupported")); return; }
    setNotice("");
    try { await target.receive(files); } catch { setNotice(copy.current("files.dropFailed")); }
  };
  const deliverRef = useRef(deliver); deliverRef.current = deliver;
  useEffect(() => { setActive(false); setChoice(null); setNotice(""); }, [routeKey]);
  useEffect(() => {
    const liveTargets = () => [...targets.current].filter(([, get]) => available(get()));
    const over = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setActive(liveTargets().length > 0);
    };
    const leave = (event: DragEvent) => { if (!event.relatedTarget) setActive(false); };
    const clear = () => setActive(false);
    const drop = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault(); event.stopPropagation(); setActive(false); setChoice(null);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (!files.length) return;
      const entries = liveTargets();
      const hit = event.target instanceof Element ? event.target : null;
      // Explicit areas (for example comparison columns) take priority over format routing.
      const local = entries.filter(([, get]) => {
        const element = get().element();
        const scope = element?.closest("[data-file-drop-scope]") ?? element;
        return hit && scope?.contains(hit);
      });
      const compatible = entries.filter(([, get]) => files.every(file => acceptsFile(file, get().accept)));
      const candidates = local.length ? local : compatible;
      if (candidates.length === 1) { void deliverRef.current(candidates[0][0], files); return; }
      if (!candidates.length) { if (entries.length) setNotice(copy.current("files.dropUnsupported")); return; }
      setChoice({ files, ids: candidates.map(([id]) => id), x: Math.max(8, Math.min(event.clientX, window.innerWidth - 296)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 280)) });
    };
    const dismissChoice = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-testid="file-drop-target-choice"]')) setChoice(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setActive(false); setChoice(null); setNotice(""); } };
    // Editor previews live in same-origin documents; forward only external files
    // through the same coordinator, before their embedded editors consume them.
    const frames = new Map<HTMLIFrameElement, () => void>();
    const attachFrames = () => {
      for (const [frame, cleanup] of frames) if (!frame.isConnected) { cleanup(); frames.delete(frame); }
      document.querySelectorAll<HTMLIFrameElement>("[data-file-drop-frame-scope] iframe").forEach(frame => {
        if (frames.has(frame)) return;
        let detach = () => {};
        const attach = () => {
          detach();
          let inner: Window | null;
          try { inner = frame.contentDocument?.defaultView ?? null; } catch { return; }
          if (!inner) return;
          const forward = (event: DragEvent) => {
            if (!isFileDrag(event)) return;
            event.preventDefault(); event.stopImmediatePropagation();
            const box = frame.getBoundingClientRect();
            frame.dispatchEvent(new DragEvent(event.type, { bubbles: true, cancelable: true, dataTransfer: event.dataTransfer, clientX: box.left + event.clientX, clientY: box.top + event.clientY }));
          };
          const names = ["dragenter", "dragover", "dragleave", "drop"];
          names.forEach(name => inner.addEventListener(name, forward as EventListener, true));
          detach = () => names.forEach(name => inner.removeEventListener(name, forward as EventListener, true));
        };
        frame.addEventListener("load", attach); attach();
        frames.set(frame, () => { detach(); frame.removeEventListener("load", attach); });
      });
    };
    const observer = new MutationObserver(attachFrames);
    observer.observe(document.body, { childList: true, subtree: true }); attachFrames();
    window.addEventListener("dragenter", over, true); window.addEventListener("dragover", over, true);
    window.addEventListener("dragleave", leave, true); window.addEventListener("drop", drop, true);
    window.addEventListener("pointerdown", dismissChoice, true);
    window.addEventListener("dragend", clear); window.addEventListener("blur", clear); window.addEventListener("keydown", escape);
    return () => {
      observer.disconnect(); frames.forEach(cleanup => cleanup());
      window.removeEventListener("dragenter", over, true); window.removeEventListener("dragover", over, true);
      window.removeEventListener("dragleave", leave, true); window.removeEventListener("drop", drop, true);
      window.removeEventListener("pointerdown", dismissChoice, true);
      window.removeEventListener("dragend", clear); window.removeEventListener("blur", clear); window.removeEventListener("keydown", escape);
    };
  }, []);
  return <Context.Provider value={registry}>{children}
    {active && <div data-testid="global-file-drop" className="pointer-events-none fixed inset-2 z-[1500] grid place-items-center rounded-3xl border-2 border-dashed border-primary bg-primary/5"><p className="rounded-2xl bg-background px-5 py-4 text-center font-bold text-foreground shadow-lg" role="status">{t("files.dropAnywhere")}</p></div>}
    {notice && <div className="fixed bottom-5 left-1/2 z-[1501] flex w-[min(90vw,440px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-border bg-background p-4 shadow-lg" role="status"><span className="flex-1">{notice}</span><Button variant="ghost" onClick={() => setNotice("")}>{t("actions.close")}</Button></div>}
    {choice && <div data-testid="file-drop-target-choice" role="dialog" aria-label={t("files.chooseDropTarget")} className="fixed z-[1501] max-h-[260px] w-72 max-w-[calc(100vw-16px)] overflow-auto rounded-2xl border border-border bg-background p-3 shadow-xl" style={{ left: choice.x, top: choice.y }}>
      <p className="mb-2 text-sm font-bold">{t("files.chooseDropTarget")}</p>
      {choice.ids.map((id, index) => <Button key={id} autoFocus={index === 0} className="mb-1 w-full justify-start whitespace-normal text-left" variant="secondary" onClick={() => { setChoice(null); void deliver(id, choice.files); }}>{targets.current.get(id)?.().label() || t("files.generic")} {choice.ids.length > 2 ? `(${index + 1})` : ""}</Button>)}
      <Button variant="ghost" onClick={() => setChoice(null)}>{t("actions.cancel")}</Button>
    </div>}
  </Context.Provider>;
}

export function useFileDropTarget(target: Target, enabled = true) {
  const context = useContext(Context);
  const id = useId();
  const latest = useRef(target); latest.current = target;
  useEffect(() => enabled ? context?.register(id, () => latest.current) : undefined, [context, id, enabled]);
}

/** Native file inputs keep their existing change handler as the sole receive path. */
export function FileInput({ ref, dropEnabled = true, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement>; dropEnabled?: boolean }) {
  const input = useRef<HTMLInputElement | null>(null);
  useFileDropTarget({
    element: () => input.current?.closest("label") ?? input.current,
    label: () => props["aria-label"] || input.current?.labels?.[0]?.textContent?.trim() || props.accept || "",
    accept: props.accept ?? "", disabled: !!props.disabled,
    receive: files => {
      const node = input.current;
      if (!node || node.disabled) return;
      const data = new DataTransfer();
      (props.multiple ? files : files.slice(0, 1)).forEach(file => data.items.add(file));
      node.files = data.files;
      node.dispatchEvent(new Event("change", { bubbles: true }));
    },
  }, dropEnabled);
  return <input {...props} ref={node => { input.current = node; if (typeof ref === "function") ref(node); else if (ref) ref.current = node; }} />;
}
