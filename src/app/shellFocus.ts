/** Reveal the whole box after focus or Tab between a date/time input's internal segments. */
export function revealShellFocus(target: EventTarget | null, fromTab = false) {
  if (!(target instanceof Element) || !target.closest(".main-content")) return;
  const fragment = window.location.hash;
  requestAnimationFrame(() => {
    if (!target.isConnected || document.activeElement !== target) return;
    if ((!fromTab && !target.matches(":focus-visible")) || target.classList.contains("sr-only")) return;
    // A link may have initiated fragment navigation since the focus event.
    if (window.location.hash !== fragment) return;
    if (target.closest(".app-shell.editor-mode, dialog, [role=dialog]")) return;
    const padding = getComputedStyle(document.documentElement);
    const top = parseFloat(padding.scrollPaddingBlockStart) || 0;
    const bottom = innerHeight - (parseFloat(padding.scrollPaddingBlockEnd) || 0);
    const rect = target.getBoundingClientRect();
    if (rect.top < top || rect.bottom > bottom) {
      target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    }
  });
}

export function revealShellTab({ key, target }: { key: string; target: EventTarget | null }) {
  if (key === "Tab") revealShellFocus(target, true);
}
