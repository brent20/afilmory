import clsx from 'clsx'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { gallerySettingAtom } from '~/atoms/app'
import { useCollections } from '~/hooks/useCollections'
import { isCollectionSelected } from '~/lib/collections'

const FADE_WIDTH = 40
const NUDGE_DISTANCE = 64
const NUDGE_STORAGE_KEY = 'collections-nav-nudged'

/** A quiet row of links under the title bar: All, then each collection with its photo count. */
export const CollectionsNav = () => {
  const collections = useCollections()
  const { selectedTags, selectedCameras, selectedLenses, selectedRatings, selectedDateRange } =
    useAtomValue(gallerySettingAtom)
  const navRef = useRef<HTMLElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  const updateEdges = useCallback(() => {
    const nav = navRef.current
    if (!nav) return
    const start = nav.scrollLeft > 4
    const end = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
  }, [])

  // On phones the row scrolls sideways; keep the current collection in view.
  useEffect(() => {
    const nav = navRef.current
    const active = activeRef.current
    if (!nav || !active) return
    nav.scrollTo({ left: active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' })
  }, [selectedTags])

  // Fade the edges that still have more to scroll to.
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    updateEdges()
    nav.addEventListener('scroll', updateEdges, { passive: true })
    window.addEventListener('resize', updateEdges)
    return () => {
      nav.removeEventListener('scroll', updateEdges)
      window.removeEventListener('resize', updateEdges)
    }
  }, [updateEdges, collections.length])

  // Once per session, slide the row a little and back so visitors learn that it scrolls.
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (nav.scrollWidth <= nav.clientWidth + 4) return
    try {
      if (sessionStorage.getItem(NUDGE_STORAGE_KEY)) return
    } catch {
      // storage unavailable: nudge anyway
    }

    let backTimer: number | undefined
    const startTimer = window.setTimeout(() => {
      if (nav.scrollLeft > 4) return
      try {
        sessionStorage.setItem(NUDGE_STORAGE_KEY, '1')
      } catch {
        // ignore
      }
      nav.scrollTo({ left: NUDGE_DISTANCE, behavior: 'smooth' })
      backTimer = window.setTimeout(() => nav.scrollTo({ left: 0, behavior: 'smooth' }), 700)
    }, 1200)

    return () => {
      window.clearTimeout(startTimer)
      window.clearTimeout(backTimer)
    }
  }, [collections.length])

  if (collections.length === 0) return null

  const noFilters =
    selectedTags.length === 0 &&
    selectedCameras.length === 0 &&
    selectedLenses.length === 0 &&
    selectedRatings === null &&
    !selectedDateRange

  const linkClass = (active: boolean) =>
    clsx(
      'focus-visible:text-text shrink-0 border-b pb-1 transition-colors duration-200',
      active ? 'text-text border-text' : 'text-text-secondary hover:text-text border-transparent',
    )

  const mask =
    edges.start || edges.end
      ? `linear-gradient(to right, transparent, black ${edges.start ? FADE_WIDTH : 0}px, black calc(100% - ${edges.end ? FADE_WIDTH : 0}px), transparent)`
      : undefined

  return (
    <nav
      ref={navRef}
      aria-label="Collections"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      className="relative -mx-6 mb-12 flex items-baseline gap-x-6 overflow-x-auto overscroll-x-contain px-6 text-sm font-medium whitespace-nowrap [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:justify-center lg:gap-y-3 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <Link to="/" ref={noFilters ? activeRef : undefined} className={linkClass(noFilters)}>
        All
      </Link>
      {collections.map((collection) => {
        const selected = isCollectionSelected(collection, selectedTags)
        return (
          <Link
            key={collection.slug}
            to={collection.href}
            ref={selected ? activeRef : undefined}
            className={linkClass(selected)}
          >
            {collection.title}
            <span className="text-text-tertiary ml-1.5 text-xs font-normal tabular-nums">{collection.count}</span>
          </Link>
        )
      })}
    </nav>
  )
}
