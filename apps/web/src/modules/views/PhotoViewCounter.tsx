import { useTranslation } from 'react-i18next'

import { isPrivateShare } from '~/lib/private-share'

import { usePhotoViewCount, useRecordPhotoView } from './photo-views'

const MIN_VISIBLE_VIEWS = 1

const compactNumber = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

export const PhotoViewCounter = ({ photoId }: { photoId: string }) => {
  const { t } = useTranslation()
  useRecordPhotoView(photoId)
  const views = usePhotoViewCount(photoId)

  if (isPrivateShare() || views === null || views < MIN_VISIBLE_VIEWS) {
    return null
  }

  const label = t('photo.views' as any, {
    count: views,
    defaultValue_one: '{{count}} view',
    defaultValue_other: '{{count}} views',
  }) as unknown as string

  return (
    <div
      title={label}
      className="pointer-events-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-material-ultra-thick px-3 text-white backdrop-blur-2xl"
    >
      <i className="i-mingcute-eye-line text-base" aria-hidden="true" />
      <span className="text-[11px] font-medium tabular-nums text-white/82" aria-hidden="true">
        {compactNumber.format(views)}
      </span>
      <span className="sr-only">{label}</span>
    </div>
  )
}
