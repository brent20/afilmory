import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ColourFamily } from '~/lib/metrics'

import { ColourFamilyBars, ColourTimeline, RainbowStrip, SplitBars } from '../charts'
import type { MetricsData } from '../insights'
import { Card, LazyBlock, Section, Skeleton } from '../ui'

export const ColorSection = ({ data }: { data: MetricsData }) => {
  const { t } = useTranslation()
  const { colour } = data
  const [active, setActive] = useState<ColourFamily | null>(null)

  return (
    <Section id="color" eyebrow={t('metrics.nav.color')} title={t('metrics.color.title')} intro={t('metrics.color.intro')}>
      <LazyBlock minHeight={320}>
        {colour === null ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <div className="space-y-5">
            <Card title={t('metrics.color.rainbow')} howTo={t('metrics.color.rainbow_how')}>
              <RainbowStrip colors={colour.rainbow} label={t('metrics.color.rainbow_label')} />
            </Card>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <Card title={t('metrics.color.families')} howTo={t('metrics.color.families_how')}>
                <ColourFamilyBars items={colour.families} active={active} onSelect={setActive} />
              </Card>
              <Card
                title={t('metrics.color.over_time')}
                note={active ? t('metrics.color.showing', { family: active }) : t('metrics.color.over_time_note')}
              >
                <ColourTimeline
                  years={colour.timeline.years}
                  cells={colour.timeline.cells}
                  active={active}
                  label={t('metrics.color.over_time_label')}
                />
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <Card title={t('metrics.color.warmth')} howTo={t('metrics.color.warmth_how')}>
                <SplitBars rows={[colour.warmth.overall]} label={t('metrics.color.warmth')} />
              </Card>
              <Card title={t('metrics.color.by_season')}>
                <SplitBars rows={colour.warmth.bySeason} label={t('metrics.color.by_season')} />
              </Card>
              <Card title={t('metrics.color.by_daypart')}>
                <SplitBars rows={colour.warmth.byDaypart} label={t('metrics.color.by_daypart')} />
              </Card>
            </div>
          </div>
        )}
      </LazyBlock>
    </Section>
  )
}
