/** Port of Stirling-Office-Convert v0.2.2 core/.../slides/PageFit.java,
 * 673aab8d6ac784524cd1d90141c95e74b9fd26ae. */
export function stirlingPageFit(page: { width: number; height: number }, width: number, height: number) {
  if (Math.abs(page.width - width) <= 1 && Math.abs(page.height - height) <= 1) return { scale: 1, dx: 0, dy: 0 };
  const scale = Math.min(width / page.width, height / page.height);
  return { scale, dx: (width - page.width * scale) / 2, dy: (height - page.height * scale) / 2 };
}
