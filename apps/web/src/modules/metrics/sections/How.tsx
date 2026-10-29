import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { APERTURE_BANDS, FOCAL_EQUIV_BANDS, ISO_BANDS } from '~/lib/metrics'

import type { HeatmapHover } from '../charts'
import { BarList, Heatmap } from '../charts'
import { formatPercent } from '../format'
import type { MetricsData } from '../insights'
import { Card, Drawer, LazyBlock, Section, StatTile } from '../ui'

export const HowSection = ({ data }: { data: MetricsData }) => {
  const { t } = useTranslation()
  const { metrics, extras } = data
  const [hover, setHover] = useState<HeatmapHover>(null)
  const { exposure, framing, mood, shutter } = extras
  const coverage = (share: number) => t('metrics.how.coverage', { percent: Math.round(share * 100) })

  return (
    <Section id="how" eyebrow={t('metrics.nav.how')} title={t('metrics.how.title')} intro={t('metrics.how.intro')}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card icon="focalEquiv" title={t('metrics.how.focal_equiv')} note={coverage(metrics.coverage.focal)} howTo={t('metrics.how.focal_how')}>
          <BarList items={metrics.focalBars} label={t('metrics.how.focal_equiv')} />
        </Card>
        <Card icon="focal" title={t('metrics.how.focal_actual')} note={coverage(metrics.coverage.focalActual)} howTo={t('metrics.how.focal_actual_how')}>
          <BarList items={metrics.focalActualBars} label={t('metrics.how.focal_actual')} />
        </Card>
        <Card icon="aperture" title={t('metrics.how.aperture')} note={coverage(metrics.coverage.aperture)} howTo={t('metrics.how.aperture_how')}>
          <BarList items={metrics.apertureBars} label={t('metrics.how.aperture')} />
        </Card>
        <Card icon="iso" title={t('metrics.how.iso')} note={coverage(metrics.coverage.iso)} howTo={t('metrics.how.iso_how')}>
          <BarList items={metrics.isoBars} label={t('metrics.how.iso')} />
        </Card>
      </div>

      {shutter.coverage > 0 && (
        <Card icon="shutter" title={t('metrics.how.shutter')} note={coverage(shutter.coverage)} howTo={t('metrics.how.shutter_how')}>
          <BarList items={shutter.bands} label={t('metrics.how.shutter')} />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {exposure.wideOpenShare !== null && (
          <StatTile icon="aperture" label={t('metrics.how.wide_open')} value={formatPercent(exposure.wideOpenShare)} hint={t('metrics.how.wide_open_hint')} />
        )}
        {exposure.lowLightShare !== null && (
          <StatTile icon="iso" label={t('metrics.how.low_light')} value={formatPercent(exposure.lowLightShare)} hint={t('metrics.how.low_light_hint')} />
        )}
        {exposure.flashShare !== null && (
          <StatTile icon="flash" label={t('metrics.how.flash')} value={formatPercent(exposure.flashShare)} hint={t('metrics.how.flash_hint')} />
        )}
        {exposure.avgComp !== null && (
          <StatTile
            icon="exposure"
            label={t('metrics.how.comp')}
            value={`${exposure.avgComp >= 0 ? '+' : '−'}${Math.abs(exposure.avgComp).toFixed(1)} EV`}
            hint={t('metrics.how.comp_hint')}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {exposure.programs.length > 0 && (
          <Card icon="program" title={t('metrics.how.modes')} howTo={t('metrics.how.modes_how')}>
            <BarList items={exposure.programs} label={t('metrics.how.modes')} />
          </Card>
        )}
        {framing.orientation.length > 0 && (
          <Card icon="frame" title={t('metrics.how.orientation')}>
            <BarList items={framing.orientation} label={t('metrics.how.orientation')} />
          </Card>
        )}
        {framing.aspects.length > 0 && (
          <Card icon="frame" title={t('metrics.how.aspects')}>
            <BarList items={framing.aspects} limit={6} label={t('metrics.how.aspects')} />
          </Card>
        )}
      </div>

      {mood.tones.length > 0 && (
        <Card
          title={t('metrics.how.mood')}
          note={mood.avgBrightness === null ? undefined : t('metrics.how.mood_note', { value: Math.round(mood.avgBrightness) })}
        >
          <BarList items={mood.tones} label={t('metrics.how.mood')} />
        </Card>
      )}

      <Drawer
        title={t('metrics.nerd.title')}
        summary={t('metrics.how.nerd_summary', { count: metrics.relationships.total })}
        howTo={t('metrics.nerd.heatmap_how')}
      >
        <LazyBlock>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card title={t('metrics.how.rel_focal_aperture')}>
              <Heatmap
                rowLabels={APERTURE_BANDS.map(b => b.label)}
                colLabels={FOCAL_EQUIV_BANDS.map(b => b.short)}
                colTitles={FOCAL_EQUIV_BANDS.map(b => b.label)}
                grid={metrics.relationships.focalAperture}
                label={t('metrics.how.rel_focal_aperture')}
                rowLabelWidth={104}
                minCellWidth={34}
                rowDim="aperture"
                colDim="focal"
                hover={hover}
                onHover={setHover}
              />
            </Card>
            <Card title={t('metrics.how.rel_focal_iso')}>
              <Heatmap
                rowLabels={ISO_BANDS.map(b => b.label)}
                colLabels={FOCAL_EQUIV_BANDS.map(b => b.short)}
                colTitles={FOCAL_EQUIV_BANDS.map(b => b.label)}
                grid={metrics.relationships.focalIso}
                label={t('metrics.how.rel_focal_iso')}
                rowLabelWidth={56}
                minCellWidth={34}
                rowDim="iso"
                colDim="focal"
                hover={hover}
                onHover={setHover}
              />
            </Card>
            <Card title={t('metrics.how.rel_aperture_iso')}>
              <Heatmap
                rowLabels={ISO_BANDS.map(b => b.label)}
                colLabels={APERTURE_BANDS.map(b => b.short)}
                colTitles={APERTURE_BANDS.map(b => b.label)}
                grid={metrics.relationships.apertureIso}
                label={t('metrics.how.rel_aperture_iso')}
                rowLabelWidth={56}
                minCellWidth={38}
                rowDim="iso"
                colDim="aperture"
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
