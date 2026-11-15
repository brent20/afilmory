import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Keeps page content blurred as it scrolls up past the header and into the area behind the clock and
 * Dynamic Island, which Safari on iPhone lets the page run under.
 *
 * Safari clips pinned (fixed or sticky) elements to the area below its top bar, so the blur can't live
 * inside the pinned header. Instead it is a separate layer attached to the page itself that is moved
 * along with the scroll position. A small lag here is invisible because it only affects the edge of a
 * blur that sits under Safari's own glass bar. It does nothing outside iPhone/iPad Safari.
 */
const isIosSafari = () => {
  const ua = navigator.userAgent
  const isIos = /iP(?:hone|od|ad)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua)
  return isIos && !isOtherBrowser
}

// How far the blur reaches above the top of the page area, and how far it overlaps the header's own blur.
const REACH = '40svh'
const OVERLAP = 24

export const TopBarBlur = () => {
  const [enabled, setEnabled] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isIosSafari()) return
    const small = window.matchMedia('(max-width: 1023px)')
    const sync = () => setEnabled(small.matches)
    sync()
    small.addEventListener('change', sync)
    return () => small.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return

    const follow = () => {
      // Drawers lock the page by turning <body> into a fixed box; leave the layer where it is until they close.
      if (document.body.style.position === 'fixed') return
      el.style.transform = `translate3d(0, calc(${window.scrollY + OVERLAP}px - ${REACH}), 0)`
    }

    follow()
    window.addEventListener('scroll', follow, { passive: true })
    return () => window.removeEventListener('scroll', follow)
  }, [enabled])

  if (!enabled) return null

  return createPortal(
    <div
      ref={ref}
      aria-hidden
      className="bg-background/50 pointer-events-none absolute inset-x-0 top-0 z-25 backdrop-blur-[56px]"
      style={{ height: REACH }}
    />,
    document.body,
  )
}
