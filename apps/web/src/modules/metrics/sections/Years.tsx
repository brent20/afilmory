import { useTranslation } from 'react-i18next'

import { formatDay } from '~/lib/metrics'

import { ColumnChart, Heatmap, SilenceList } from '../charts'
import { formatDuration, formatInt } from '../format'
import type { MetricsData } from '../insights'
import { MONTH_LABELS } from '../labels'
import { Card, EmptyNote, Section, StatTile } from '../ui'

export const YearsSection = ({ data }: { data: MetricsData }) => {
  const { t } = useTranslation()
  const { metrics, extras } = data
  const { perYear, habits } = extras
  const yearLabels = perYear.years.map(y => (perYear.years.length > 12 ? String(y).slice(-2) : String(y)))
  const labelEvery = perYear.years.length > 16 ? 3 : perYear.years.length > 9 ? 2 : 1

  return (
    <Section id="years" eyebrow={t('metrics.nav.years')} title={t('metrics.years.title')} intro={t('metrics.years.intro')}>
      <Card title={t('metrics.years.per_year')} howTo={t('metrics.years.per_year_how')}>
        <ColumnChart
          values={perYear.counts}
          labels={yearLabels}
          titles={perYear.years.map(String)}
          labelEvery={labelEvery}
          label={t('metrics.years.per_year_label', { first: perYear.years[0] ?? '', last: perYear.years.at(-1) ?? '' })}
          heightClass="h-44"
        />
      </Card>

      <Card title={t('metrics.years.recent')} note={t('metrics.years.recent_note')} howTo={t('metrics.years.recent_how')}>
        <Heatmap
          rowLabels={metrics.recent.years.map(String)}
          colLabels={MONTH_LABELS}
          grid={metrics.recent.grid}
          label={t('metrics.years.recent_label')}
          rowLabelWidth={44}
          cellHeightClass="h-9"
          minCellWidth={34}
        />
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatTile label={t('metrics.habits.active_days')} value="" count={habits.activeDays} hint={t('metrics.habits.active_days_hint')} />
        {habits.photosPerActiveDay !== null && (
          <StatTile
            label={t('metrics.habits.per_day')}
            value={Number.parseFloat(habits.photosPerActiveDay.toFixed(1)).toLocaleString('en-US')}
            hint={t('metrics.habits.per_day_hint')}
          />
        )}
        {habits.busiestDay && (
          <StatTile
            label={t('metrics.habits.busiest')}
            value={t('metrics.photos', { count: habits.busiestDay.count })}
            hint={formatDay(habits.busiestDay.day)}
            photoId={habits.busiestDay.photoId}
          />
        )}
        {habits.streak && (
          <StatTile
            label={t('metrics.habits.streak')}
            value={t('metrics.habits.streak_value', { count: habits.streak.days })}
            hint={`${formatDay(habits.streak.fromDay)} → ${formatDay(habits.streak.toDay)}`}
            photoId={habits.streak.photoId}
          />
        )}
        {habits.outings.count > 0 && (
          <StatTile
            label={t('metrics.habits.outings')}
            value={formatInt(habits.outings.count)}
            hint={
              habits.outings.avgPhotos === null
                ? undefined
                : t('metrics.habits.outings_hint', { count: Math.round(habits.outings.avgPhotos) })
            }
          />
        )}
        {habits.outings.longest && (
          <StatTile
            label={t('metrics.habits.longest_outing')}
            value={formatDuration(habits.outings.longest.minutes * 60)}
            hint={`${t('metrics.photos', { count: habits.outings.longest.photos })} · ${formatDay(habits.outings.longest.day)}`}
            photoId={habits.outings.longest.photoId}
          />
        )}
      </div>

      <Card title={t('metrics.years.silences')} note={t('metrics.years.silences_note')} howTo={t('metrics.years.silences_how')}>
        {metrics.daySpan && metrics.silences.length > 0 ? (
          <SilenceList silences={metrics.silences} span={metrics.daySpan} />
        ) : (
          <EmptyNote />
        )}
      </Card>
    </Section>
  )
}
