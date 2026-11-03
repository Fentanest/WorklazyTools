import { useLayoutEffect, type RefObject } from 'react'

/** Compact page toolbar: paint only in the shell's usable viewport; keep native Tab access. */
export function useMobileImageRail(root: RefObject<HTMLDivElement | null>, generation: number, active: boolean) {
  useLayoutEffect(() => {
    const host = root.current
    if (!host || !active) return
    const mobile = matchMedia('(max-width: 620px)')
    let rail: HTMLElement | null = null
    const safeBounds = () => {
      const header = document.querySelector<HTMLElement>('.mobile-header')
      const tabs = document.querySelector<HTMLElement>('.bottom-tabs')
      return { top: (header?.getBoundingClientRect().bottom ?? 0) + 8, bottom: (tabs?.getBoundingClientRect().top ?? innerHeight) - 8 }
    }
    const sync = () => {
      const next = host.querySelector<HTMLElement>('.asp-workspace__rail')
      if (rail && rail !== next) { rail.removeAttribute('data-mobile-rail'); rail.classList.remove('is-outside-safe-viewport') }
      rail = next
      if (!rail) return
      if (!mobile.matches) { if (rail.hasAttribute('data-mobile-rail')) rail.querySelector<HTMLButtonElement>('.asp-rail__scrim')?.click(); rail.removeAttribute('data-mobile-rail'); rail.removeAttribute('aria-describedby'); rail.classList.remove('is-outside-safe-viewport'); return }
      rail.dataset.mobileRail = 'true'
      rail.setAttribute('aria-describedby', 'image-mobile-rail-hint')
      const bounds = safeBounds(), rect = rail.getBoundingClientRect()
      const outside = rect.top < bounds.top - 0.5 || rect.bottom > bounds.bottom + 0.5
      rail.classList.toggle('is-outside-safe-viewport', outside)
      rail.style.setProperty('--wl-rail-bottom-clearance', `${innerHeight - bounds.bottom}px`)
      if (outside) rail.querySelector<HTMLButtonElement>('.asp-rail__scrim')?.click()
      // Native top-layer popovers escape the horizontal strip's scroll clip and
      // the editor's query-container containing block. SDK state still owns close/focus.
      for (const menu of rail.querySelectorAll<HTMLElement>('.asp-rail__flyout')) {
        if (menu.hasAttribute('popover') || typeof menu.showPopover !== 'function') continue
        menu.setAttribute('popover', 'manual')
        menu.style.setProperty('--wl-rail-menu-top', menu.style.top || `${bounds.top}px`)
        menu.style.translate = ''
        menu.showPopover()
        const box = menu.getBoundingClientRect()
        const dx = Math.max(8, Math.min(box.left, innerWidth - box.width - 8)) - box.left
        if (dx) menu.style.translate = `${dx}px 0px`
      }
    }
    const reveal = (event: Event) => {
      if (!mobile.matches || !(event.target instanceof Element)) return
      const target = event.target.closest<HTMLElement>('button')
      const strip = target?.closest<HTMLElement>('.asp-workspace__rail')
      if (!target || !strip || !target.matches('.asp-rail__tool,.asp-rail__flyout-toggle')) return
      if (event.type === 'focusin' || target.matches('.asp-rail__flyout-toggle')) {
        if (strip.classList.contains('is-outside-safe-viewport') || event.type === 'click') strip.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' })
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
        sync()
      }
    }
    const changes = new MutationObserver(sync)
    changes.observe(host, { childList: true, subtree: true })
    const sizes = new ResizeObserver(sync); sizes.observe(host)
    host.addEventListener('focusin', reveal); host.addEventListener('click', reveal, true)
    window.addEventListener('scroll', sync, { capture: true, passive: true }); window.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('resize', sync); mobile.addEventListener('change', sync)
    sync()
    return () => {
      changes.disconnect(); sizes.disconnect()
      if (rail?.isConnected) rail.querySelector<HTMLButtonElement>('.asp-rail__scrim')?.click()
      host.removeEventListener('focusin', reveal); host.removeEventListener('click', reveal, true)
      window.removeEventListener('scroll', sync, true); window.removeEventListener('resize', sync)
      window.visualViewport?.removeEventListener('resize', sync); mobile.removeEventListener('change', sync)
      rail?.removeAttribute('data-mobile-rail'); rail?.removeAttribute('aria-describedby'); rail?.classList.remove('is-outside-safe-viewport')
    }
  }, [root, generation, active])
}
