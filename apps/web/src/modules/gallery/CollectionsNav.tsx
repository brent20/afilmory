import clsx from 'clsx'
import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router'

import { gallerySettingAtom } from '~/atoms/app'
import { useCollections } from '~/hooks/useCollections'
import { isCollectionSelected } from '~/lib/collections'

/** A quiet row of links under the title bar: All, then each collection with its photo count. */
export const CollectionsNav = () => {
  const collections = useCollections()
  const { selectedTags, selectedCameras, selectedLenses, selectedRatings, selectedDateRange } =
    useAtomValue(gallerySettingAtom)
  const navRef = useRef<HTMLElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)

  // On phones the row scrolls sideways; keep the current collection in view.
  useEffect(() => {
    const nav = navRef.current
    const active = activeRef.current
    if (!nav || !active) return
    nav.scrollTo({ left: active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' })
  }, [selectedTags])

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

  return (
    <nav
      ref={navRef}
      aria-label="Collections"
      className="relative -mx-6 mb-12 flex items-baseline gap-x-6 overflow-x-auto px-6 text-sm font-medium whitespace-nowrap [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:justify-center lg:gap-y-3 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
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
