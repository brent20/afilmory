import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { formatDay } from '~/lib/metrics'
import { formatShutter, settingsLine } from '~/lib/metrics-extras'

import { cameraHref, formatBytes, formatDuration, formatFeet, formatInt, formatMiles, formatPercent, lensHref } from '../format'
import type { MetricsData } from '../insights'
import { buildInsights } from '../insights'
import { FeatureTile, Section, StatTile } from '../ui'
import { VisitorFavorites } from './VisitorFavorites'

interface Superlative {
  key: string
  photoId: string
  label: string
  value: string
  detail?: string
}

export const HighlightsSection = ({ data }: { data: MetricsData }) => {
  const { t } = useTranslation()
  const { metrics, extras } = data
  const insights = useMemo(() => buildInsights(data, t), [data, t])
  const byId = useMemo(() => new Map(metrics.records.map(r => [r.id, r])), [metrics.records])
  const settings = (id: string) => {
    const record = byId.get(id)
    return record ? settingsLine(record) : undefined
  }

  const topCamera = metrics.fun.topCamera
  const topLens = metrics.fun.topLens
  const cameraFilter = topCamera ? extras.gear.cameras.find(s => s.name === topCamera.name)?.filter : null
  const lensFilter = topLens ? extras.gear.lenses.find(s => s.name === topLens.name)?.filter : null
  const photoOf = (pick: (r: (typeof metrics.records)[number]) => boolean) => metrics.records.find(pick)?.id ?? null

  const { extremes, mood, travel, habits } = extras
  const superlatives: Superlative[] = []
  const add = (key: string, label: string, pick: { photoId: string } | null | undefined, value: string, detail?: string) => {
    if (pick) {
      superlatives.push({ key, photoId: pick.photoId, label, value, detail })
    }
  }
  add('widest', t('metrics.super.widest'), extremes.widest, `${extremes.widest?.value}mm`, settings(extremes.widest?.photoId ?? ''))
  add('longest', t('metrics.super.longest'), extremes.longest, `${extremes.longest?.value}mm`, settings(extremes.longest?.photoId ?? ''))
  add(
    'aperture',
    t('metrics.super.aperture'),
    extremes.fastestAperture,
    `f/${Number.parseFloat((extremes.fastestAperture?.value ?? 0).toFixed(1))}`,
    settings(extremes.fastestAperture?.photoId ?? ''),
  )
  add('iso', t('metrics.super.iso'), extremes.highestIso, `ISO ${extremes.highestIso?.value ?? 0}`, settings(extremes.highestIso?.photoId ?? ''))
  add(
    'exposure',
    t('metrics.super.exposure'),
    extremes.longestExposure && extremes.longestExposure.value >= 1 ? extremes.longestExposure : null,
    formatShutter(extremes.longestExposure?.value ?? 1),
    settings(extremes.longestExposure?.photoId ?? ''),
  )
  add('shutter', t('metrics.super.shutter'), extremes.fastestShutter, formatShutter(extremes.fastestShutter?.value ?? 1), settings(extremes.fastestShutter?.photoId ?? ''))
  add('brightest', t('metrics.super.brightest'), mood.brightest, `${Math.round(mood.brightest?.value ?? 0)}%`)
  add('darkest', t('metrics.super.darkest'), mood.darkest, `${Math.round(mood.darkest?.value ?? 0)}%`)
  add('farthest', t('metrics.super.farthest'), travel.farthest, formatMiles(travel.farthest?.miles ?? 0), travel.farthest?.place ?? undefined)
  add('highest', t('metrics.super.highest'), travel.highest, formatFeet(travel.highest?.feet ?? 0), travel.highest?.place ?? undefined)
  add('busiest', t('metrics.super.busiest'), habits.busiestDay, t('metrics.photos', { count: habits.busiestDay?.count ?? 0 }), habits.busiestDay ? formatDay(habits.busiestDay.day) : undefined)

  const { fun } = extras
  return (
    <Section
      id="highlights"
      eyebrow={t('metrics.nav.highlights')}
      title={t('metrics.highlights.title')}
      intro={t('metrics.highlights.intro')}
    >
      {insights.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {insights.map(text => (
            <li
              key={text}
              className="bg-material-thin border-border text-text rounded-2xl border p-5 font-serif text-lg leading-snug"
            >
              {text}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatTile
          label={t('metrics.tile.photos')}
          value=""
          count={metrics.total}
          hint={
            metrics.firstYear === null
              ? undefined
              : metrics.firstYear === metrics.lastYear
                ? String(metrics.firstYear)
                : `${metrics.firstYear}–${metrics.lastYear}`
          }
        />
        <StatTile label={t('metrics.tile.cameras')} value="" count={metrics.cameras.length} hint={t('metrics.tile.lenses_hint', { count: metrics.lenses.length })} />
        {metrics.countries.length > 0 && <StatTile label={t('metrics.tile.countries')} value="" count={metrics.countries.length} />}
        {topCamera && (
          <StatTile
            label={t('metrics.tile.top_camera')}
            value={topCamera.name}
            hint={t('metrics.photos', { count: topCamera.count })}
            href={cameraFilter ? cameraHref(cameraFilter) : null}
            photoId={photoOf(r => r.camera === topCamera.name)}
          />
        )}
        {topLens && (
          <StatTile
            label={t('metrics.tile.top_lens')}
            value={topLens.name}
            hint={t('metrics.photos', { count: topLens.count })}
            href={lensFilter ? lensHref(lensFilter) : null}
            photoId={photoOf(r => r.lens === topLens.name)}
          />
        )}
        {metrics.fun.topCountry && (
          <StatTile label={t('metrics.tile.top_country')} value={metrics.fun.topCountry.name} hint={t('metrics.photos', { count: metrics.fun.topCountry.count })} />
        )}
        <StatTile label={t('metrics.tile.weekend')} value={formatPercent(metrics.fun.weekendShare)} hint={t('metrics.tile.weekend_hint')} />
        <StatTile label={t('metrics.tile.night')} value={formatPercent(metrics.fun.nightShare)} hint={t('metrics.tile.night_hint')} />
        {extras.gear.favoriteFocal && (
          <StatTile
            label={t('metrics.tile.favorite_focal')}
            value={`${extras.gear.favoriteFocal.mm}mm`}
            hint={t('metrics.tile.favorite_focal_hint', { share: formatPercent(extras.gear.favoriteFocal.share) })}
            photoId={extras.gear.favoriteFocal.photoId}
          />
        )}
      </div>

      {superlatives.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-text font-serif text-xl">{t('metrics.super.title')}</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {superlatives.map(s => (
              <li key={s.key}>
                <FeatureTile photoId={s.photoId} label={s.label} value={s.value} detail={s.detail} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <VisitorFavorites />

      <div className="space-y-3">
        <h3 className="text-text font-serif text-xl">{t('metrics.fun.title')}</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <StatTile label={t('metrics.fun.slideshow')} value={formatDuration(fun.slideshowSeconds)} hint={t('metrics.fun.slideshow_hint')} />
          <StatTile label={t('metrics.fun.rolls')} value={formatInt(fun.rolls)} hint={t('metrics.fun.rolls_hint')} />
          <StatTile label={t('metrics.fun.size')} value={formatBytes(fun.totalBytes)} hint={t('metrics.fun.size_hint')} />
          {fun.avgMegapixels !== null && (
            <StatTile label={t('metrics.fun.megapixels')} value={`${Number.parseFloat(fun.avgMegapixels.toFixed(1))} MP`} hint={t('metrics.fun.megapixels_hint')} />
          )}
          {fun.hdrShare !== null && fun.hdrShare > 0 && <StatTile label={t('metrics.fun.hdr')} value={formatPercent(fun.hdrShare)} hint={t('metrics.fun.hdr_hint')} />}
          {fun.videos > 0 && <StatTile label={t('metrics.fun.videos')} value={formatInt(fun.videos)} hint={t('metrics.fun.videos_hint')} />}
        </div>
      </div>
    </Section>
  )
}
