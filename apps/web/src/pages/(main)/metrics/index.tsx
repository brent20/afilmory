import { photoLoader } from '@afilmory/data'
import { GlassButton } from '@afilmory/ui'
import { startTransition, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { computeColourMetrics, computeMetrics, type ColourMetrics } from '~/lib/metrics'
import { MetricsDashboard } from '~/modules/metrics/MetricsDashboard'

export const Component = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // This is an internal stats page: ask search engines not to index it while it is open.
  // (public/_headers sends the same instruction from the server.)
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.append(meta)
    return () => meta.remove()
  }, [])

  // Always analyse the whole library, not whatever filters are active in the gallery.
  const photos = useMemo(() => photoLoader.getPhotos(), [])
  const metrics = useMemo(() => computeMetrics(photos), [photos])

  // Colour analysis decodes every thumbhash, so run it after the first paint.
  const [colour, setColour] = useState<ColourMetrics | null>(null)
  useEffect(() => {
    const id = window.setTimeout(() => setColour(computeColourMetrics(photos)), 0)
    return () => window.clearTimeout(id)
  }, [photos])

  const backLabel = t('explory.back.to.gallery' as any, { defaultValue: 'Back to gallery' }) as unknown as string

  const handleBack = () => {
    startTransition(() => {
      navigate('/')
    })
  }

  return (
    <div className="relative mx-auto h-full max-w-7xl overflow-y-auto px-6 py-24 md:px-8">
      <GlassButton className="absolute top-4 left-4 z-50" onClick={handleBack} title={backLabel} aria-label={backLabel}>
        <i className="i-mingcute-arrow-left-line text-base text-white" aria-hidden="true" />
      </GlassButton>

      <header className="mb-14 text-center">
        <p className="text-accent font-mono text-xs tracking-widest uppercase">Analytics</p>
        <h1 className="text-text mt-3 font-serif text-4xl md:text-6xl">
          {t('gallery.metrics.title' as any, { defaultValue: 'Photography Metrics' }) as unknown as string}
        </h1>
        <p className="text-text-secondary mx-auto mt-4 max-w-2xl text-sm leading-relaxed">
          {
            t('gallery.metrics.description' as any, {
              defaultValue: 'A breakdown of how, when and with what these photos were made.',
            }) as unknown as string
          }
        </p>
      </header>

      {metrics.total === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <i className="i-mingcute-database-line text-text-quaternary mb-4 text-4xl" />
          <p className="text-text-tertiary font-mono text-sm">No photos available to analyze</p>
        </div>
      ) : (
        <MetricsDashboard metrics={metrics} colour={colour} />
      )}
    </div>
  )
}

export default Component
