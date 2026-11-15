import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Keeps page content blurred as it scrolls up past the header and into the area behind the clock and
 * Dynamic Island, which Safari on iPhone lets the page run under.
 *
 * Safari clips pinned (fixed or sticky) elements to the area below its top bar, so the blur can't live
 * inside the pinned header. Instead it is a separate layer attached to the page itself that has to be
 * moved along with the scroll position.
 *
 * Moving it from a JavaScript scroll listener always trails the page on a fast flick, so the layer is
 * driven by a CSS scroll-driven animation instead (`animation-timeline: scroll()`), which Safari runs
 * alongside the scroll rather than waiting for the main thread. If that is unsupported, or turns out to
 * put the layer in the wrong place, it falls back to the scroll listener. Does nothing outside iPhone/iPad Safari.
 */
const isIosSafari = () => {
  const ua = navigator.userAgent
  const isIos = /iP(?:hone|od|ad)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua)
  return isIos && !isOtherBrowser
}

const supportsScrollTimeline = () =>
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('animation-timeline: scroll()')

// How far the blur reaches above the top of the page area, and how far it reaches down under the header.
// The part under the header fades out so there is still blur at the header's top edge if the layer trails.
const REACH = '40svh'
const OVERLAP = 56
const FADE = `linear-gradient(to bottom, #000 calc(100% - ${OVERLAP}px), transparent)`

// The layer is positioned at the top of the page and slid down by exactly the scroll distance: the animation
// runs over the first 1,000,000px of scrolling and translates by the same 1,000,000px.
const FOLLOW_CSS = `
@keyframes top-bar-blur-follow {
  from { transform: translate3d(0, var(--top-bar-blur-offset), 0); }
  to { transform: translate3d(0, calc(var(--top-bar-blur-offset) + 1000000px), 0); }
}
.top-bar-blur-follow {
  animation: top-bar-blur-follow linear both;
  animation-timeline: scroll(root block);
  animation-range: 0 1000000px;
}
`

type Mode = 'off' | 'css' | 'js'

export const TopBarBlur = () => {
  const [mode, setMode] = useState<Mode>('off')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isIosSafari()) return
    const small = window.matchMedia('(max-width: 1023px)')
    const sync = () => setMode((current) => (small.matches ? (current === 'off' ? (supportsScrollTimeline() ? 'css' : 'js') : current) : 'off'))
    sync()
    small.addEventListener('change', sync)
    return () => small.removeEventListener('change', sync)
  }, [])

  // JavaScript fallback: move the layer on every scroll event.
  useEffect(() => {
    const el = ref.current
    if (mode !== 'js' || !el) return

    const follow = () => {
      // Drawers lock the page by turning <body> into a fixed box; leave the layer where it is until they close.
      if (document.body.style.position === 'fixed') return
      el.style.transform = `translate3d(0, calc(${window.scrollY + OVERLAP}px - ${REACH}), 0)`
    }

    follow()
    window.addEventListener('scroll', follow, { passive: true })
    return () => window.removeEventListener('scroll', follow)
  }, [mode])

  // Safety check for the CSS version: once the page has scrolled a bit, the bottom edge of the layer should be
  // `OVERLAP` px below the top of the page area. If it is far off, the animation isn't doing what we expect.
  useEffect(() => {
    const el = ref.current
    if (mode !== 'css' || !el) return

    let good = 0
    const check = () => {
      if (window.scrollY < 300 || document.body.style.position === 'fixed') return
      const bottom = el.getBoundingClientRect().bottom
      if (Math.abs(bottom - OVERLAP) > 120) {
        setMode('js')
      }
      else if (++good >= 3) {
        window.removeEventListener('scroll', check)
      }
    }

    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [mode])

  if (mode === 'off') return null

  return createPortal(
    <>
      {mode === 'css' && <style>{FOLLOW_CSS}</style>}
      <div
        ref={ref}
        aria-hidden
        className={`bg-background/50 pointer-events-none absolute inset-x-0 top-0 z-25 backdrop-blur-[56px] ${mode === 'css' ? 'top-bar-blur-follow' : ''}`}
        style={{
          height: REACH,
          maskImage: FADE,
          WebkitMaskImage: FADE,
          ...(mode === 'css' ? { ['--top-bar-blur-offset' as string]: `calc(${OVERLAP}px - ${REACH})` } : {}),
        }}
      />
    </>,
    document.body,
  )
}
