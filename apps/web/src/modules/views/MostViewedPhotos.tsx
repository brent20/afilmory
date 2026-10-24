import { photoLoader } from '@afilmory/data'
import { clsxm, focusRing } from '@afilmory/utils'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { usePhotoViewCounts } from './photo-views'

const TOP_COUNT = 12

const compactNumber = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

export const MostViewedPhotos = () => {
  const { t } = useTranslation()
  const { data } = usePhotoViewCounts()

  const ranked = useMemo(() => {
    if (!data) {
      return []
    }
    return Object.entries(data)
      .flatMap(([id, views]) => {
        const photo = photoLoader.getPhoto(id)
        return photo ? [{ photo, views }] : []
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, TOP_COUNT)
  }, [data])

  if (ranked.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-secondary">
        {t('gallery.metrics.most_viewed_empty' as any, {
          defaultValue: 'View counts will appear here as people browse the gallery.',
        }) as unknown as string}
      </p>
    )
  }

  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {ranked.map(({ photo, views }, index) => (
        <li key={photo.id}>
          <Link
            to={`/photos/${photo.id}`}
            className={clsxm(
              focusRing,
              'focus-visible:outline-accent group relative block aspect-[4/5] overflow-hidden rounded-xl border border-white/10 bg-fill-secondary',
            )}
          >
            <img
              src={photo.thumbnailUrl}
              alt={photo.title}
              loading="lazy"
              className="size-full object-cover duration-200 group-hover:opacity-90"
            />
            <span className="absolute top-2 left-2 inline-flex h-6 items-center rounded-full border border-white/10 bg-material-ultra-thick px-2 text-[11px] font-medium text-white tabular-nums backdrop-blur-md">
              {index + 1}
            </span>
            <span className="absolute bottom-2 left-2 inline-flex h-6 items-center gap-1 rounded-full border border-white/10 bg-material-ultra-thick px-2 text-[11px] font-medium text-white tabular-nums backdrop-blur-md">
              <i className="i-mingcute-eye-line text-xs" aria-hidden="true" />
              {compactNumber.format(views)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  )
}
