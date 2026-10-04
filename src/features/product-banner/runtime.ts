import { advanceIndex, canPlay, windowIndices, type Playback } from "./rotation.ts";

type Instance = { destroy: () => void };
type Registry = { serial: number; instances: Map<HTMLElement, Instance>; observer?: MutationObserver; init: () => void; destroy: (root: HTMLElement) => void };
declare global { interface Window { WorklazyProductBannerV1?: Registry } }

function mount(root: HTMLElement, registry: Registry): Instance {
  const list = root.querySelector<HTMLElement>(".wlpb-v1-list")!;
  const items = Array.from(list.children) as HTMLElement[];
  const controls = root.querySelector<HTMLElement>(".wlpb-v1-controls")!;
  const pause = controls.querySelector<HTMLButtonElement>('[data-wlpb-action="pause"]')!;
  const status = controls.querySelector<HTMLElement>(".wlpb-v1-status")!;
  const english = root.getAttribute("aria-label") === "Product banner";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let state: Playback = { enabled: root.dataset.wlpbAuto === "true", paused: false, reduced: motion.matches,
    hover: root.matches(":hover"), focus: root.contains(document.activeElement), visible: false, background: document.hidden };
  let start = 0, count = 1, timer: ReturnType<typeof setTimeout> | undefined, destroyed = false;
  const cleanup: (() => void)[] = [];
  const listen = (target: EventTarget, name: string, fn: EventListener) => { target.addEventListener(name, fn); cleanup.push(() => target.removeEventListener(name, fn)); };
  const stop = () => { clearTimeout(timer); timer = undefined; };
  const sync = () => {
    stop();
    const playing = canPlay(state, items.length, count);
    root.dataset.wlpbPlaying = String(playing);
    pause.textContent = state.paused || state.reduced ? (english ? "Play" : "재생") : (english ? "Pause" : "일시정지");
    pause.setAttribute("aria-label", state.paused || state.reduced ? (english ? "Play automatic rotation" : "자동 넘김 재생") : (english ? "Pause" : "일시정지"));
    pause.setAttribute("aria-pressed", String(state.paused || state.reduced));
    if (playing && !destroyed) timer = setTimeout(() => move(1), Number(root.dataset.wlpbInterval) * 1000);
  };
  const update = (patch: Partial<Playback>) => { state = { ...state, ...patch }; sync(); };
  const draw = () => {
    const indices = windowIndices(items.length, count, start), shown = new Set(indices);
    items.forEach((item, i) => { item.hidden = !shown.has(i); item.inert = item.hidden; });
    // Move original nodes, never clone slides; DOM/tab order follows the wrapped window.
    const ordered = [...indices, ...items.map((_, i) => i).filter((i) => !shown.has(i))];
    ordered.forEach((i, position) => { if (list.children[position] !== items[i]) list.insertBefore(items[i], list.children[position] || null); });
    const next = windowIndices(items.length, count, advanceIndex(items.length, start, step()));
    items.forEach((item, i) => { const img = item.querySelector<HTMLImageElement>("img"); if (img) img.loading = shown.has(i) || next.includes(i) ? "eager" : "lazy"; });
    controls.hidden = items.length <= count;
    pause.hidden = !state.enabled;
    const ranges: number[][] = [];
    for (const i of indices) {
      const last = ranges[ranges.length - 1], number = i + 1;
      if (last && number === last[1] + 1) last[1] = number;
      else ranges.push([number, number]);
    }
    status.textContent = ranges.length ? `${ranges.map(([first, last]) => first === last ? `${first}` : `${first}–${last}`).join(", ")} / ${items.length}` : "";
    const spoken = ranges.map(([first, last]) => english ? first === last ? `${first}` : `${first} through ${last}` : first === last ? `${first}번` : `${first}번부터 ${last}번까지`).join(english ? ", then " : ", 이어서 ");
    status.setAttribute("aria-label", ranges.length ? english ? `Showing products ${spoken} out of ${items.length}` : `전체 ${items.length}개 상품 중 ${spoken} 표시` : "");
    sync();
  };
  const step = () => root.dataset.wlpbMove === "page" || ["vertical", "grid"].includes(root.dataset.wlpbDesign!) ? count : 1;
  const move = (direction: number) => {
    // A resize/swipe must not detach or hide a focused product link.
    if (list.contains(document.activeElement)) return;
    start = advanceIndex(items.length, start, direction * step()); draw();
  };
  const resize = () => {
    if (list.contains(document.activeElement)) return;
    const item = items.find((p) => !p.hidden), design = root.dataset.wlpbDesign;
    const columns = design === "grid" ? getComputedStyle(list).gridTemplateColumns.split(" ").length
      : item ? Math.max(1, Math.round((list.clientWidth + 12) / (item.getBoundingClientRect().width + 12))) : 1;
    count = Math.max(1, design === "vertical" ? Number(root.dataset.wlpbCount)
      : design === "grid" ? columns * Number(root.dataset.wlpbRows) : Math.min(columns, Number(root.dataset.wlpbCount)));
    count = Math.min(Math.max(1, items.length), count); draw();
  };
  listen(controls, "click", (e) => {
    const action = (e.target as Element).closest<HTMLButtonElement>("[data-wlpb-action]")?.dataset.wlpbAction;
    if (action === "previous" || action === "next") move(action === "next" ? 1 : -1);
    if (action === "pause") update(state.paused || state.reduced ? { paused: false, reduced: false } : { paused: true });
  });
  listen(root, "mouseenter", () => update({ hover: true }));
  listen(root, "mouseleave", () => update({ hover: false }));
  listen(root, "focusin", () => update({ focus: true }));
  listen(root, "focusout", () => queueMicrotask(() => { if (!destroyed) { update({ focus: root.contains(document.activeElement) }); if (!state.focus) resize(); } }));
  listen(document, "visibilitychange", () => update({ background: document.hidden }));
  listen(motion, "change", () => update({ reduced: motion.matches }));
  let pointer: { id: number; x: number; y: number } | undefined, dragged = false;
  listen(list, "pointerdown", (e) => { const p = e as PointerEvent; if (p.isPrimary) { pointer = { id: p.pointerId, x: p.clientX, y: p.clientY }; dragged = false; } });
  listen(list, "pointermove", (e) => { const p = e as PointerEvent; if (pointer?.id === p.pointerId && Math.hypot(p.clientX - pointer.x, p.clientY - pointer.y) > 10) dragged = true; });
  listen(list, "pointerup", (e) => { const p = e as PointerEvent; if (pointer?.id === p.pointerId) { const dx = p.clientX - pointer.x; if (dragged && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(p.clientY - pointer.y)) move(dx < 0 ? 1 : -1); pointer = undefined; } });
  listen(list, "pointercancel", () => { pointer = undefined; dragged = false; });
  listen(list, "click", (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } });
  items.forEach((item) => {
    const img = item.querySelector<HTMLImageElement>("img")!, fallback = item.querySelector<HTMLElement>(".wlpb-v1-fallback")!;
    const failed = () => { img.hidden = true; fallback.hidden = false; };
    listen(img, "error", failed);
    listen(img, "load", () => { img.hidden = false; fallback.hidden = true; });
    if (img.complete && !img.naturalWidth) failed();
  });
  const intersection = new IntersectionObserver(([entry]) => update({ visible: entry.isIntersecting }));
  const size = new ResizeObserver(resize);
  intersection.observe(root); size.observe(root);
  root.dataset.wlpbReady = "true"; root.dataset.wlpbKey = `wlpb-v1-${++registry.serial}`;
  resize();
  return { destroy: () => {
    destroyed = true; stop(); intersection.disconnect(); size.disconnect(); cleanup.forEach((fn) => fn());
    items.forEach((item) => { item.hidden = false; item.inert = false; list.append(item); });
    controls.hidden = true; delete root.dataset.wlpbReady; delete root.dataset.wlpbKey; delete root.dataset.wlpbPlaying;
  } };
}

const registry: Registry = window.WorklazyProductBannerV1 ||= {
  serial: 0, instances: new Map(),
  destroy(root) { this.instances.get(root)?.destroy(); this.instances.delete(root); if (!this.instances.size) { this.observer?.disconnect(); this.observer = undefined; } },
  init() {
    document.querySelectorAll<HTMLElement>('[data-wlpb-root="1"]').forEach((root) => {
      if (!this.instances.has(root)) this.instances.set(root, mount(root, this));
    });
    if (this.instances.size && !this.observer) {
      this.observer = new MutationObserver(() => { for (const root of this.instances.keys()) if (!root.isConnected) this.destroy(root); });
      this.observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  },
};
registry.init();
