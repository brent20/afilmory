import type { RefObject } from 'react'
import { useEffect } from 'react'

/**
 * iPhone/iPad Safari only (not Chrome, Firefox or Edge on iOS, which have no Liquid Glass bars).
 *
 * Safari 26+ looks for a pinned (`position: fixed` or `sticky`) element at the top edge of the page. If it
 * finds one, it fills the area behind the clock and Dynamic Island with a solid colour, so photos stop at a
 * dark band instead of scrolling up under the status bar. No CSS trick gets around that for a header that
 * has to stay on screen.
 *
 * So on Safari the header is not pinned at all. It sits at the top of the page and is moved down by the
 * scroll distance on every scroll event, which looks the same as a fixed header. Everywhere else (desktop,
 * Android, Chrome on iPhone) the header stays a normal `fixed` element and this does nothing.
 */
const isIosSafari = () => {
  const ua = navigator.userAgent
  const isIos = /iP(?:hone|od|ad)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua)
  return isIos && !isOtherBrowser
}

export const useSafariTopBar = (ref: RefObject<HTMLElement | null>) => {
  useEffect(() => {
    const el = ref.current
    if (!el || !isIosSafari()) return

    const small = window.matchMedia('(max-width: 1023px)')
    let following = false
    let origin = 0

    // The header is positioned against the nearest positioned ancestor, which normally starts at the very
    // top of the page. Measure it anyway so the header always lands on the top of the screen.
    const measure = () => {
      const parent = (el.offsetParent as HTMLElement | null) ?? document.documentElement
      origin = parent === document.documentElement ? 0 : parent.getBoundingClientRect().top + window.scrollY
    }

    const follow = () => {
      // Drawers lock the page by turning <body> into a fixed box; leave the header where it is until they close.
      if (document.body.style.position === 'fixed') return
      el.style.transform = `translate3d(0, ${window.scrollY - origin}px, 0)`
    }

    const stop = () => {
      following = false
      window.removeEventListener('scroll', follow)
      window.removeEventListener('resize', measure)
      el.style.position = ''
      el.style.transform = ''
    }

    const update = () => {
      if (small.matches && !following) {
        following = true
        el.style.position = 'absolute'
        measure()
        follow()
        window.addEventListener('scroll', follow, { passive: true })
        window.addEventListener('resize', measure)
      }
      else if (!small.matches && following) {
        stop()
      }
    }

    update()
    small.addEventListener('change', update)

    return () => {
      small.removeEventListener('change', update)
      stop()
    }
  }, [ref])
}
