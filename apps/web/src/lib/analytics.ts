/**
 * Google Analytics 4 custom events.
 *
 * The GA4 script itself is loaded in apps/web/index.html. This file only sends named events with details,
 * and quietly does nothing when the script is missing or blocked (ad blockers, privacy extensions).
 */

/** Set to false to stop sending custom events. Page views from the GA4 tag are not affected. */
export const ANALYTICS_ENABLED = true

type ParamValue = string | number | boolean | null | undefined
type Params = Record<string, ParamValue>

/** GA4 cuts text values at 100 characters. */
const MAX_VALUE_LENGTH = 100

export function trackEvent(name: string, params: Params = {}): void {
  if (!ANALYTICS_ENABLED || typeof window === 'undefined') return
  try {
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag
    if (typeof gtag !== 'function') return

    const cleaned: Record<string, string | number | boolean> = {}
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue
      cleaned[key] = typeof value === 'string' ? value.slice(0, MAX_VALUE_LENGTH) : value
    }
    gtag('event', name, cleaned)
  }
  catch {
    // Analytics must never break the site.
  }
}
