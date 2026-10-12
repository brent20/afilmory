import { useAtomValue } from 'jotai'
import { Link } from 'react-router'

import { gallerySettingAtom } from '~/atoms/app'
import { useCollections } from '~/hooks/useCollections'
import { isCollectionSelected } from '~/lib/collections'

/** Large picture tiles linking to each collection, shown below the photos. */
export const CollectionTiles = () => {
  const collections = useCollections()
  const { selectedTags } = useAtomValue(gallerySettingAtom)

  // Don't offer the collection the visitor is already looking at.
  const others = collections.filter((collection) => !isCollectionSelected(collection, selectedTags))
  if (others.length === 0) return null

  return (
    <section className="mt-28" aria-label="Browse collections">
      <h2 className="mb-6 text-center text-[11px] tracking-[0.18em] text-white/50 uppercase">Browse collections</h2>
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {others.map((collection) => (
          <Link
            key={collection.slug}
            to={collection.href}
            className="group relative block aspect-4/3 overflow-hidden bg-white/5"
          >
            {collection.cover?.thumbnailUrl && (
              <img
                src={collection.cover.thumbnailUrl}
                alt=""
                loading="lazy"
                draggable={false}
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-baseline justify-between p-3 text-white">
              <span className="text-sm">{collection.title}</span>
              <span className="font-mono text-[10px] tabular-nums opacity-70">{collection.count}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
