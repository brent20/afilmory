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
      'focus-visible:text-text border-b pb-1 transition-colors duration-200',
      active ? 'text-text border-text' : 'text-text-secondary hover:text-text border-transparent',
    )

  return (
    <nav
      aria-label="Collections"
      className="mb-12 flex flex-wrap items-baseline justify-center gap-x-6 gap-y-3 text-sm font-medium"
    >
      <Link to="/" className={linkClass(noFilters)}>
        All
      </Link>
      {collections.map((collection) => (
        <Link key={collection.slug} to={collection.href} className={linkClass(isCollectionSelected(collection, selectedTags))}>
          {collection.title}
          <span className="text-text-tertiary ml-1.5 text-xs font-normal tabular-nums">{collection.count}</span>
        </Link>
      ))}
    </nav>
  )
}
