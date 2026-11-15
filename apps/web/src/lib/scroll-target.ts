/**
 * On phones the whole page scrolls (not an inner element). A page scroll doesn't fire `scroll`
 * on <html>/<body>; it fires on `window`. These helpers let code treat both cases the same way.
 */
export const isDocumentScroller = (el: HTMLElement | null | undefined): boolean =>
  !!el && (el === document.documentElement || el === document.body || el === document.scrollingElement)

/** Where to attach `scroll` listeners for this scroll element. */
export const getScrollEventTarget = (el: HTMLElement): HTMLElement | Window =>
  isDocumentScroller(el) ? window : el

/** Current vertical scroll position of this scroll element. */
export const getScrollTop = (el: HTMLElement): number =>
  isDocumentScroller(el) ? window.scrollY : el.scrollTop

/**
 * Pages that scroll inside their own box on desktop but with the whole page on phones.
 * Returns the box if it really is a scroller right now, otherwise the page scroller.
 */
export const getActiveScroller = (el: HTMLElement | null | undefined): HTMLElement => {
  if (el && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) {
    return el
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement
}
