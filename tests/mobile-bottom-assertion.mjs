export async function assertMobileBottomLayout(page, { bottomTargetSelector, scenarioId = "mobile-bottom" }) {
  if (!bottomTargetSelector) throw new Error(`${scenarioId}: bottomTargetSelector is required for a mobile bottom scenario.`);

  const metrics = await page.evaluate(async (targetSelector) => {
    const scrollingElement = document.scrollingElement ?? document.documentElement;
    document.documentElement.style.scrollBehavior = "auto";
    scrollingElement.scrollTo(0, scrollingElement.scrollHeight);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const mainContent = document.querySelector(".main-content");
    const bottomTabs = document.querySelector(".bottom-tabs");
    const footer = document.querySelector(".global-footer");
    const bottomTarget = document.querySelector(targetSelector);
    const navigationRect = bottomTabs?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    const bottomTargetRect = bottomTarget?.getBoundingClientRect();

    return {
      scrollBottomDistance: Math.abs(scrollingElement.scrollHeight - scrollingElement.clientHeight - scrollingElement.scrollTop),
      scrollHeight: scrollingElement.scrollHeight,
      clientHeight: scrollingElement.clientHeight,
      scrollTop: scrollingElement.scrollTop,
      horizontalOverflow: scrollingElement.scrollWidth - scrollingElement.clientWidth,
      contentBottomPadding: mainContent ? Number.parseFloat(getComputedStyle(mainContent).paddingBottom) : null,
      navigationHeight: navigationRect?.height ?? null,
      navigationTop: navigationRect?.top ?? null,
      footerBottom: footerRect?.bottom ?? null,
      bottomTargetBottom: bottomTargetRect?.bottom ?? null,
      hasMainContent: Boolean(mainContent),
      hasBottomTabs: Boolean(bottomTabs),
      hasFooter: Boolean(footer),
      hasBottomTarget: Boolean(bottomTarget),
    };
  }, bottomTargetSelector);

  const failures = [];
  if (metrics.scrollBottomDistance > 1) failures.push(`bottom distance ${metrics.scrollBottomDistance}px exceeds 1px`);
  if (!metrics.hasMainContent) failures.push(".main-content is missing");
  if (!metrics.hasBottomTabs) failures.push(".bottom-tabs is missing");
  if (metrics.contentBottomPadding === null || metrics.navigationHeight === null || metrics.contentBottomPadding < metrics.navigationHeight) {
    failures.push(`main bottom padding ${metrics.contentBottomPadding}px is smaller than bottom tabs ${metrics.navigationHeight}px`);
  }
  if (metrics.horizontalOverflow > 1) failures.push(`horizontal overflow ${metrics.horizontalOverflow}px exceeds 1px`);
  if (metrics.hasFooter) {
    if (metrics.footerBottom === null || metrics.navigationTop === null || metrics.footerBottom > metrics.navigationTop + 1) {
      failures.push(`footer bottom ${metrics.footerBottom}px overlaps bottom tabs top ${metrics.navigationTop}px`);
    }
  } else if (!metrics.hasBottomTarget) {
    failures.push(`footer is N/A and bottom target ${bottomTargetSelector} is missing`);
  } else if (metrics.bottomTargetBottom === null || metrics.navigationTop === null || metrics.bottomTargetBottom > metrics.navigationTop + 1) {
    failures.push(`bottom target ${bottomTargetSelector} at ${metrics.bottomTargetBottom}px overlaps bottom tabs top ${metrics.navigationTop}px`);
  }

  if (failures.length) {
    throw new Error(`${scenarioId}: mobile bottom assertion failed: ${failures.join("; ")}. Metrics: ${JSON.stringify(metrics)}`);
  }
  return metrics;
}
