/** Each copy binds to the preceding wrapper, including identical pasted snippets. */
const wrapper = document.currentScript?.previousElementSibling;
const frame = wrapper?.querySelector<HTMLIFrameElement>("iframe[data-wlpb-frame]");
if (frame) {
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) => n.toString(16).padStart(2, "0")).join("");
  let lastTime = -Infinity, stopped = false;
  const init = () => frame.contentWindow?.postMessage({ kind: "wlpb-v1-init", id }, "*");
  const receive = (event: MessageEvent) => {
    const data = event.data;
    if (stopped || event.source !== frame.contentWindow || !data || data.kind !== "wlpb-v1-height" || data.id !== id || typeof data.height !== "number" || !Number.isFinite(data.height) || !Number.isInteger(data.height) || data.height < 120 || data.height > 2400) return;
    if (performance.now() - lastTime < 100 || Number(frame.height) === data.height) return;
    lastTime = performance.now(); frame.height = String(data.height);
  };
  const stop = () => {
    stopped = true; observer.disconnect(); frame.removeEventListener("load", init);
    window.removeEventListener("message", receive); window.removeEventListener("pagehide", stop);
  };
  const observer = new MutationObserver(() => { if (!frame.isConnected) stop(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  frame.addEventListener("load", init); window.addEventListener("message", receive);
  window.addEventListener("pagehide", stop); init();
}
export {};
