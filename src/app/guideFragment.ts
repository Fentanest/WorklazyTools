export const GUIDE_FRAGMENT = "#tool-guide-title";
export const GUIDE_INITIAL_LAYOUT_MS = 10_000;

/** Keep initial fragment entry aligned while the tool's first layout is loading. */
export function restoreGuideFragment(title: HTMLElement | null) {
  if (!title || window.location.hash !== GUIDE_FRAGMENT) return;
  let frame = 0;
  let stopped = false;
  let expected: { x: number; y: number; titleY: number } | undefined;
  let restoring = false;
  let restorationSeen = false;
  const titleY = () => title.getBoundingClientRect().top + window.scrollY;
  const schedule = () => {
    if (stopped || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (stopped || !title.isConnected || window.location.hash !== GUIDE_FRAGMENT) return;
      title.scrollIntoView({ block: "start", behavior: "instant" });
      // Read the actual (possibly clamped/rounded) destination synchronously.
      // The resulting scroll event arrives later and must not release us.
      expected = { x: window.scrollX, y: window.scrollY, titleY: titleY() };
      restoring = false;
    });
  };
  const onScroll = () => {
    if (!expected || stopped) return;
    const near = (a: number, b: number) => Math.abs(a - b) <= 1;
    if (near(window.scrollX, expected.x) && near(window.scrollY, expected.y)) return;
    // Native scroll anchoring can arrive before ResizeObserver delivery.
    // A changed document-space heading position is evidence of layout motion;
    // an unchanged heading plus a different viewport position is user scroll.
    if (!near(titleY(), expected.titleY) || restoring) schedule();
    else stop();
  };
  const onPageShow = (event: PageTransitionEvent) => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (restorationSeen || window.history.scrollRestoration === "manual"
      || !(event.persisted || navigation?.type === "reload" || navigation?.type === "back_forward")) return;
    // History traversal restores scroll after pageshow. Reconcile once in its
    // next paint, not for arbitrary scrolls throughout the ten-second window.
    // Bare scrollTo(), even to zero, has no restoration signal and releases us.
    restorationSeen = true;
    restoring = true;
    schedule();
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
    if (stopped) return;
    stopped = true;
    window.clearTimeout(deadline);
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("load", schedule);
    window.removeEventListener("hashchange", stop);
    document.removeEventListener("animationend", animationEnd);
    document.fonts.removeEventListener("loadingdone", schedule);
    for (const event of intentEvents) window.removeEventListener(event, stop, true);
  };
  // This is an entry-only correction, not persistent hash ownership. Cap the
  // initial loading window even without input, so later automatic results
  // cannot pull the viewport back. Resize/font/load events never renew it.
  const deadline = window.setTimeout(stop, GUIDE_INITIAL_LAYOUT_MS);
  // Hand control back on the first user action; later tool edits must not
  // pull the viewport back to the guide while its hash remains in the URL.
  for (const event of intentEvents) window.addEventListener(event, stop, { capture: true, passive: true });
  window.addEventListener("hashchange", stop);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("load", schedule);
  document.addEventListener("animationend", animationEnd);
  document.fonts.addEventListener("loadingdone", schedule);
  void document.fonts.ready.then(schedule);
  schedule();
  return stop;
}
