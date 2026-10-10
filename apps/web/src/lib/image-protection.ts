/**
 * Basic deterrents against casually saving photos.
 *
 * These only stop the easy routes (right-click > Save image, dragging an image to the desktop,
 * Ctrl/Cmd+S). Anyone using dev tools or the network tab can still get at the files, so pair this
 * with server-side hotlink protection (see Cloudflare WAF rules).
 */

const MEDIA_SELECTOR = 'img, picture, canvas, video, svg'

/** Right-click should still work inside text fields (paste, spellcheck, etc.). */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !!target.closest('input, textarea, [contenteditable=""], [contenteditable="true"]')
}

export function installImageProtection(): void {
  if (typeof document === 'undefined') return

  // Block the browser context menu everywhere (except text fields).
  document.addEventListener(
    'contextmenu',
    (event) => {
      // Ignore synthetic events (the app's own context-menu provider dispatches these).
      if (!event.isTrusted) return
      if (isEditable(event.target)) return
      event.preventDefault()
    },
    { capture: true },
  )

  // Block dragging images / canvases out of the page.
  document.addEventListener(
    'dragstart',
    (event) => {
      if (event.target instanceof Element && event.target.closest(MEDIA_SELECTOR)) {
        event.preventDefault()
      }
    },
    { capture: true },
  )

  // Block "Save page as" (Ctrl/Cmd+S).
  document.addEventListener(
    'keydown',
    (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
      }
    },
    { capture: true },
  )
}
