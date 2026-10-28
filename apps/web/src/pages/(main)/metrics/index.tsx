import { photoLoader } from '@afilmory/data'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ColourMetrics } from '~/lib/metrics'
import { computeColourMetrics, computeMetrics } from '~/lib/metrics'
import { computeExtras } from '~/lib/metrics-extras'
import { isExcludedFromMetrics } from '~/modules/metrics/excluded-gear'
import { MetricsPage } from '~/modules/metrics/MetricsPage'

export const Component = () => {
  const { t } = useTranslation()

  // Reachable by URL only for now: ask search engines not to index it.
  // (public/_headers sends the same instruction from the server.)
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.append(meta)
    return () => meta.remove()
  }, [])

  // Always analyze the whole library, not whatever filters are active in the gallery.
  const photos = useMemo(() => photoLoader.getPhotos().filter(photo => !isExcludedFromMetrics(photo)), [])
  const metrics = useMemo(() => computeMetrics(photos), [photos])
  const extras = useMemo(() => computeExtras(metrics), [metrics])

  // Color analysis decodes every thumbhash, so run it after the first paint.
  const [colour, setColour] = useState<ColourMetrics | null>(null)
  useEffect(() => {
    const id = window.setTimeout(() => setColour(computeColourMetrics(photos)), 0)
    return () => window.clearTimeout(id)
  }, [photos])

  if (metrics.total === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <i className="i-mingcute-database-line text-text-quaternary mb-4 text-4xl" aria-hidden="true" />
        <p className="text-text-tertiary font-mono text-sm">{t('metrics.none')}</p>
      </div>
    )
  }

  return <MetricsPage data={{ metrics, extras, colour }} />
}

export default Component
