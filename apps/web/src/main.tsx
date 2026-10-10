import './styles/index.css'

import { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'

import { AppSkeleton } from './components/ui/app-skeleton'
import { installImageProtection } from './lib/image-protection'
import { router } from './router'

installImageProtection()

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

createRoot(document.querySelector('#root')!).render(
  <Suspense fallback={<AppSkeleton />}>
    <RouterProvider router={router} />
  </Suspense>,
)
