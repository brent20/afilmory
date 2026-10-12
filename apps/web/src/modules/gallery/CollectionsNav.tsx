import clsx from 'clsx'
import { useAtomValue } from 'jotai'
import { Link } from 'react-router'

import { gallerySettingAtom } from '~/atoms/app'
import { useCollections } from '~/hooks/useCollections'
import { isCollectionSelected } from '~/lib/collections'

/** A quiet row of links under the title bar: All, then each collection with its photo count. */
export const CollectionsNav = () => {
  const collections = useCollections()
  const { selectedTags, selectedCameras, selectedLenses, selectedRatings, selectedDateRange } =
    useAtomValue(gallerySettingAtom)

  if (collections.length === 0) return null

  const noFilters =
    selectedTags.length === 0 &&
    selectedCameras.length === 0 &&
    selectedLenses.length === 0 &&
    selectedRatings === null &&
    !selectedDateRange

  const linkClass = (active: boolean) =>
    clsx(
      'border-b pb-1 transition-colors duration-200',
      active ? 'border-white text-white' : 'border-transparent text-white/50 hover:text-white',
    )

  return (
    <nav
      aria-label="Collections"
      className="mb-12 flex flex-wrap items-baseline justify-center gap-x-7 gap-y-3 text-[11px] tracking-[0.18em] uppercase"
    >
      <Link to="/" className={linkClass(noFilters)}>
        All
      </Link>
      {collections.map((collection) => (
        <Link key={collection.slug} to={collection.href} className={linkClass(isCollectionSelected(collection, selectedTags))}>
          {collection.title}
          <sup className="ml-1 font-mono text-[9px] tracking-normal opacity-60">{collection.count}</sup>
        </Link>
      ))}
    </nav>
  )
}
