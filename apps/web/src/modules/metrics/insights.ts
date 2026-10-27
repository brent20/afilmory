import type { TFunction } from 'i18next'

import type { ColourMetrics, PhotoMetrics } from '~/lib/metrics'
import { formatDay, formatHour } from '~/lib/metrics'
import type { ExtraMetrics } from '~/lib/metrics-extras'

import { formatInt, formatMiles, formatPercent } from './format'

export interface MetricsData {
  metrics: PhotoMetrics
  extras: ExtraMetrics
  colour: ColourMetrics | null
}

/** A handful of one-sentence stories for the top of the page. Each is only included when the data supports it. */
export const buildInsights = ({ metrics, extras }: MetricsData, t: TFunction): string[] => {
  const out: string[] = []

  if (metrics.firstYear !== null && metrics.lastYear !== null) {
    out.push(
      metrics.firstYear === metrics.lastYear
        ? t('metrics.insight.span_single', { count: metrics.total, year: metrics.firstYear })
        : t('metrics.insight.span_range', {
            count: metrics.total,
            first: metrics.firstYear,
            last: metrics.lastYear,
          }),
    )
  }

  const focal = extras.gear.favoriteFocal
  if (focal) {
    out.push(
      t('metrics.insight.focal', {
        mm: focal.mm,
        share: formatPercent(focal.share),
      }),
    )
  }

  if (metrics.fun.peakHour !== null) {
    out.push(t('metrics.insight.peak_hour', { hour: formatHour(metrics.fun.peakHour) }))
  }

  const goldenShare = extras.light.total >= 20 ? extras.light.golden / extras.light.total : null
  if (goldenShare !== null && goldenShare > 0) {
    out.push(t('metrics.insight.golden', { share: formatPercent(goldenShare) }))
  }

  if (extras.gear.topLens) {
    out.push(
      t('metrics.insight.top_lens', {
        lens: extras.gear.topLens.name,
        share: formatPercent(extras.gear.topLens.share),
      }),
    )
  }

  const { farthest, home } = extras.travel
  if (farthest && home && farthest.miles >= 50 && farthest.place) {
    out.push(
      t('metrics.insight.farthest', {
        distance: formatMiles(farthest.miles),
        place: farthest.place,
        home: home.place,
      }),
    )
  }

  const { streak, busiestDay } = extras.habits
  if (streak && streak.days >= 3) {
    out.push(t('metrics.insight.streak', { count: streak.days, from: formatDay(streak.fromDay) }))
  }
  if (busiestDay && busiestDay.count >= 10) {
    out.push(
      t('metrics.insight.busiest', {
        count: busiestDay.count,
        day: formatDay(busiestDay.day),
      }),
    )
  }

  if (extras.fun.rolls >= 2) {
    out.push(t('metrics.insight.rolls', { rolls: formatInt(extras.fun.rolls) }))
  }

  return out.slice(0, 7)
}
