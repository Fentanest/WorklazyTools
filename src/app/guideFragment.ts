/** Keep initial fragment entry aligned while the tool's first layout is loading. */
export function restoreGuideFragment(title: HTMLElement | null) {
  if (!title || window.location.hash !== "#tool-guide-title") return;
  let frame = 0;
  let stopped = false;
  const schedule = () => {
    if (stopped || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (stopped || !title.isConnected || window.location.hash !== "#tool-guide-title") return;
      title.scrollIntoView({ block: "start", behavior: "instant" });
    });
  };
  // The redactor's preparing message becomes a taller file picker without
  // remounting the guide. Observe its containing layout, not just the title.
  const observer = new ResizeObserver(schedule);
  observer.observe(title.closest(".main-content") ?? title.parentElement!);
  const animationEnd = (event: AnimationEvent) => {
    if (event.target instanceof Element && event.target.contains(title)) schedule();
  };
  const intentEvents = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("load", schedule);
    window.removeEventListener("hashchange", stop);
    document.removeEventListener("animationend", animationEnd);
    document.fonts.removeEventListener("loadingdone", schedule);
    for (const event of intentEvents) window.removeEventListener(event, stop, true);
  };
  // Hand control back on the first user action; later tool edits must not
  // pull the viewport back to the guide while its hash remains in the URL.
  for (const event of intentEvents) window.addEventListener(event, stop, { capture: true, passive: true });
  window.addEventListener("hashchange", stop);
  window.addEventListener("load", schedule);
  document.addEventListener("animationend", animationEnd);
  document.fonts.addEventListener("loadingdone", schedule);
  void document.fonts.ready.then(schedule);
  schedule();
  return stop;
}
