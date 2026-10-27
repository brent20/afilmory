import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { APERTURE_BANDS, formatHour, ISO_BANDS } from '~/lib/metrics'

import type { HeatmapHover } from '../charts'
import { BarList, ColumnChart, Heatmap } from '../charts'
import { formatPercent } from '../format'
import type { MetricsData } from '../insights'
import { DAY_LABELS, HOUR_LABELS, HOUR_TITLES, MONTH_LABELS } from '../labels'
import { Card, Drawer, LazyBlock, Section } from '../ui'

export const WhenSection = ({ data }: { data: MetricsData }) => {
  const { t } = useTranslation()
  const { metrics, extras } = data
  const [hover, setHover] = useState<HeatmapHover>(null)
  const { light } = extras

  const lightItems = [
    { name: t('metrics.when.golden'), count: light.golden },
    { name: t('metrics.when.blue'), count: light.blue },
    { name: t('metrics.when.day'), count: light.day },
    { name: t('metrics.when.night'), count: light.night },
  ]

  return (
    <Section id="when" eyebrow={t('metrics.nav.when')} title={t('metrics.when.title')} intro={t('metrics.when.intro')}>
      <Card
        title={t('metrics.when.hours')}
        note={metrics.fun.peakHour === null ? undefined : t('metrics.when.hours_note', { hour: formatHour(metrics.fun.peakHour) })}
        howTo={t('metrics.when.hours_how')}
      >
        <ColumnChart
          values={metrics.hours}
          labels={HOUR_LABELS}
          titles={HOUR_TITLES}
          labelEvery={3}
          label={t('metrics.when.hours_label')}
        />
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title={t('metrics.when.weekday')} howTo={t('metrics.when.weekday_how')}>
          <ColumnChart values={metrics.dayOfWeek} labels={DAY_LABELS} showValues label={t('metrics.when.weekday_label')} />
        </Card>
        <Card title={t('metrics.when.month')} howTo={t('metrics.when.month_how')}>
          <ColumnChart values={metrics.monthOfYear} labels={MONTH_LABELS} showValues label={t('metrics.when.month_label')} />
        </Card>
      </div>

      {light.total >= 20 && (
        <Card
          title={t('metrics.when.light')}
          note={t('metrics.when.light_note', { count: light.total })}
          howTo={t('metrics.when.light_how')}
        >
          <BarList items={lightItems} label={t('metrics.when.light')} />
          {light.golden > 0 && (
            <p className="text-text-secondary mt-4 text-xs">
              {t('metrics.when.golden_split', {
                morning: formatPercent(light.goldenMorning / light.golden),
                evening: formatPercent(light.goldenEvening / light.golden),
              })}
            </p>
          )}
        </Card>
      )}

      <Drawer title={t('metrics.nerd.title')} summary={t('metrics.when.nerd_summary')}>
        <LazyBlock>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card title={t('metrics.when.hour_aperture')} howTo={t('metrics.nerd.heatmap_how')}>
              <Heatmap
                rowLabels={APERTURE_BANDS.map(b => b.label)}
                colLabels={HOUR_LABELS}
                colTitles={HOUR_TITLES}
                grid={metrics.apertureByHour}
                label={t('metrics.when.hour_aperture')}
                colLabelEvery={3}
                showNumbers={false}
                rowLabelWidth={104}
                cellHeightClass="h-6"
                minCellWidth={14}
                rowDim="aperture"
                colDim="hour"
                hover={hover}
                onHover={setHover}
              />
            </Card>
            <Card title={t('metrics.when.hour_iso')} howTo={t('metrics.nerd.heatmap_how')}>
              <Heatmap
                rowLabels={ISO_BANDS.map(b => b.label)}
                colLabels={HOUR_LABELS}
                colTitles={HOUR_TITLES}
                grid={metrics.isoByHour}
                label={t('metrics.when.hour_iso')}
                colLabelEvery={3}
                showNumbers={false}
                rowLabelWidth={104}
                cellHeightClass="h-6"
                minCellWidth={14}
                rowDim="iso"
                colDim="hour"
                hover={hover}
                onHover={setHover}
              />
            </Card>
          </div>
        </LazyBlock>
      </Drawer>
    </Section>
  )
}
