import './styles/index.css'

import { markPrivateShare } from './lib/private-share'

// After a new deploy, a stale cached page may reference chunk hashes that no
// longer exist. Reload once to pick up the fresh index.html; the sessionStorage
// guard prevents a reload loop if the chunk is genuinely missing.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const key = 'chunk-reload-at'
  try {
    const last = Number(sessionStorage.getItem(key) || 0)
    if (Date.now() - last < 10_000) return
    sessionStorage.setItem(key, String(Date.now()))
  }
  catch {}
  window.location.reload()
})

/**
 * Private share links look like  /?s=<secret>.
 *
 * When one is present we fetch that share's photo list and swap it in for the public
 * manifest BEFORE the app starts (the whole app reads window.__MANIFEST__), so the
 * gallery, map, search, filters and viewer all work on just the shared photos.
 * Any problem (bad link, offline) quietly falls back to the normal public site.
 */
const SHARE_SLUG = /^[a-z0-9][a-z0-9_-]{7,63}$/

async function loadShare(): Promise<void> {
  try {
    const slug = new URLSearchParams(window.location.search).get('s')?.trim().toLowerCase()
    if (!slug || !SHARE_SLUG.test(slug)) return

    const res = await fetch(`/_s/${slug}.json`, { cache: 'no-store' })
    if (!res.ok) return

    // Unknown paths can return index.html, which fails JSON parsing and lands in the catch below.
    const manifest = await res.json()
    if (!manifest || !Array.isArray(manifest.data)) return

    ;(window as unknown as { __MANIFEST__?: unknown }).__MANIFEST__ = manifest
    markPrivateShare()

    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.append(robots)
  }
  catch {}
}

void loadShare().finally(() => import('./bootstrap'))
