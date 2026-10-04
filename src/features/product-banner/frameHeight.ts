/** Runs only in exported auto-height documents. Payloads contain no product data. */
export function installFrameHeight() {
  const config = document.querySelector<HTMLScriptElement>('script[data-wlpb-frame-config]');
  if (!config || window.parent === window) return;
  const { parentOrigin } = JSON.parse(config.textContent!);
  const root = document.querySelector<HTMLElement>('[data-wlpb-root="1"]')!;
  let id = "", last = 0, timer: ReturnType<typeof setTimeout> | undefined;
  const send = () => {
    timer = undefined;
    const height = Math.ceil(root.getBoundingClientRect().height);
    if (id && height !== last && height >= 120 && height <= 2400) {
      last = height;
      parent.postMessage({ kind: "wlpb-v1-height", id, height }, parentOrigin || "*");
    }
  };
  const queue = () => { if (!timer) timer = setTimeout(send, 120); };
  const receive = (event: MessageEvent) => {
    const data = event.data;
    if (event.source !== parent || (parentOrigin && event.origin !== parentOrigin) || !data || data.kind !== "wlpb-v1-init" || typeof data.id !== "string" || !/^[a-f0-9]{32}$/u.test(data.id)) return;
    id = data.id; last = 0; queue();
  };
  const observer = new ResizeObserver(queue); observer.observe(root, { box: "border-box" });
  window.addEventListener("message", receive);
  window.addEventListener("pagehide", () => { observer.disconnect(); clearTimeout(timer); window.removeEventListener("message", receive); }, { once: true });
}
