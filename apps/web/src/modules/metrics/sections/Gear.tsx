import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GearList, StackedColumns, ZoomDotPlot } from '../charts'
import { cameraHref, lensHref } from '../format'
import type { MetricsData } from '../insights'
import { Card, EmptyNote, Section, Segmented } from '../ui'

export const GearSection = ({ data }: { data: MetricsData }) => {
  const { t } = useTranslation()
  const { metrics, extras } = data
  const [view, setView] = useState<'bodies' | 'lenses'>('bodies')
  const [share, setShare] = useState(false)
  const [focalShare, setFocalShare] = useState(false)

  const shareOptions = [
    { value: 'count', label: t('metrics.gear.count') },
    { value: 'share', label: t('metrics.gear.share') },
  ] as const

  return (
    <Section id="gear" eyebrow={t('metrics.nav.gear')} title={t('metrics.gear.title')} intro={t('metrics.gear.intro')}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title={t('metrics.gear.cameras')} howTo={t('metrics.gear.list_how')}>
          <GearList
            spans={extras.gear.cameras}
            hrefOf={s => (s.filter ? cameraHref(s.filter) : null)}
            label={t('metrics.gear.cameras')}
          />
        </Card>
        <Card title={t('metrics.gear.lenses')}>
          <GearList
            spans={extras.gear.lenses}
            hrefOf={s => (s.filter ? lensHref(s.filter) : null)}
            label={t('metrics.gear.lenses')}
          />
        </Card>
      </div>

      <Card
        title={t('metrics.gear.over_time')}
        note={t('metrics.gear.over_time_note')}
        howTo={t('metrics.gear.over_time_how')}
        action={(
          <div className="flex flex-wrap justify-end gap-2">
            <Segmented
              label={t('metrics.gear.view')}
              options={[
                { value: 'bodies', label: t('metrics.gear.bodies') },
                { value: 'lenses', label: t('metrics.gear.lenses') },
              ]}
              value={view}
              onChange={setView}
            />
            <Segmented
              label={t('metrics.gear.mode')}
              options={[...shareOptions]}
              value={share ? 'share' : 'count'}
              onChange={v => setShare(v === 'share')}
            />
          </div>
        )}
      >
        <StackedColumns
          data={view === 'bodies' ? metrics.gearBodies : metrics.gearLenses}
          share={share}
          label={t('metrics.gear.over_time_label')}
        />
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card
          title={t('metrics.gear.focal_over_time')}
          note={t('metrics.gear.focal_over_time_note')}
          howTo={t('metrics.gear.focal_over_time_how')}
          action={(
            <Segmented
              label={t('metrics.gear.mode')}
              options={[...shareOptions]}
              value={focalShare ? 'share' : 'count'}
              onChange={v => setFocalShare(v === 'share')}
            />
          )}
        >
          <StackedColumns data={metrics.focalOverTime} share={focalShare} label={t('metrics.gear.focal_over_time')} />
        </Card>
        {extras.gear.primeZoomByYear.series.length > 0 && (
          <Card title={t('metrics.gear.prime_zoom')} howTo={t('metrics.gear.prime_zoom_how')}>
            <StackedColumns data={extras.gear.primeZoomByYear} share label={t('metrics.gear.prime_zoom')} />
          </Card>
        )}
      </div>

      {metrics.zoomUsage.length === 0 ? (
        <Card title={t('metrics.gear.zoom')}>
          <EmptyNote>{t('metrics.gear.zoom_empty')}</EmptyNote>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {metrics.zoomUsage.map(usage => (
            <Card
              key={usage.lens}
              title={t('metrics.gear.zoom_for', { lens: usage.lens })}
              note={t('metrics.gear.zoom_note', { count: usage.total })}
              howTo={t('metrics.gear.zoom_how')}
            >
              <ZoomDotPlot usage={usage} />
            </Card>
          ))}
        </div>
      )}
    </Section>
  )
}
