import { useMemo } from 'react'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { usePhotos } from '~/hooks/usePhotoViewer'
import { computePhotoMetrics, type PhotoMetrics } from '~/lib/metrics'

const MetricCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08]">
    <h3 className="mb-6 font-mono text-xs tracking-widest uppercase text-white/40">{title}</h3>
    <div className="flex-1">{children}</div>
  </div>
)

const BarRow = ({ label, value, max, color = 'bg-accent' }: { label: string; value: number; max: number; color?: string }) => {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="mb-4 space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-white/80">
        <span>{label}</span>
        <span className="font-mono text-white/40">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <m.div
          className={`h-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </div>
  )
}

export default function MetricsPage() {
  const { t } = useTranslation()
  const photos = usePhotos()

  const metrics = useMemo(() => computePhotoMetrics(photos), [photos])

  if (photos.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <i className="i-mingcute-database-line mb-4 text-4xl text-white/20" />
        <p className="font-mono text-sm text-white/40">{t('gallery.metrics.no_photos' as any) || 'No photos available to analyze'}</p>
      </div>
    )
  }

  const maxGearCount = Math.max(...metrics.cameras.map(c => c.count), ...metrics.lenses.map(l => l.count), 1)
  const maxTechCount = Math.max(...metrics.apertures.map(a => a.count), ...metrics.focalLengths.map(f => f.count), ...metrics.isos.map(i => i.count), 1)
  const maxTimeCount = Math.max(...metrics.timeOfDay.map(t => t.count), 1)

  return (
    <div className="mx-auto max-w-7xl px-6 py-24 md:px-8">
      <header className="mb-16 text-center">
        <p className="font-mono text-xs tracking-widest uppercase text-accent">Analytics</p>
        <h1 className="mt-3 font-serif text-4xl md:text-6xl text-white">{t('gallery.metrics.title' as any) || 'Photography Metrics'}</h1>
        <p className="mt-4 max-w-2xl mx-auto text-sm leading-relaxed text-white/40">
          {t('gallery.metrics.description' as any) || 'A detailed breakdown of the technical and geographic patterns across your library.'}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Gear: Cameras */}
        <MetricCard title={t('exif.camera' as any) || 'Cameras'}>
          <div className="space-y-4">
            {metrics.cameras.slice(0, 5).map(c => (
              <BarRow key={c.name} label={c.name} value={c.count} max={maxGearCount} />
            ))}
          </div>
        </MetricCard>

        {/* Gear: Lenses */}
        <MetricCard title={t('exif.lens' as any) || 'Lenses'}>
          <div className="space-y-4">
            {metrics.lenses.slice(0, 5).map(l => (
              <BarRow key={l.name} label={l.name} value={l.count} max={maxGearCount} color="bg-blue-400" />
            ))}
          </div>
        </MetricCard>

        {/* Exposure Stats */}
        <MetricCard title={t('gallery.metrics.exposure' as any) || 'Exposure'}>
          <div className="grid grid-cols-1 gap-6">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
              <span className="font-mono text-[10px] tracking-widest uppercase text-white/30">Average Shutter</span>
              <span className="mt-2 text-3xl font-serif text-white">{metrics.exposure.avgShutter}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-center">
                <span className="font-mono text-[10px] tracking-widest uppercase text-white/30">Min</span>
                <span className="mt-1 text-lg font-serif text-white">{metrics.exposure.minShutter}</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-center">
                <span className="font-mono text-[10px] tracking-widest uppercase text-white/30">Max</span>
                <span className="mt-1 text-lg font-serif text-white">{metrics.exposure.maxShutter}</span>
              </div>
            </div>
          </div>
        </MetricCard>

        {/* Tech: Aperture */}
        <MetricCard title={t('gallery.metrics.aperture' as any) || 'Aperture'}>
          <div className="space-y-4">
            {metrics.apertures.slice(0, 5).map(a => (
              <BarRow key={a.value} label={a.value} value={a.count} max={maxTechCount} color="bg-emerald-400" />
            ))}
          </div>
        </MetricCard>

        {/* Tech: Focal Length */}
        <MetricCard title={t('gallery.metrics.focal' as any) || 'Focal Length'}>
          <div className="space-y-4">
            {metrics.focalLengths.slice(0, 5).map(f => (
              <BarRow key={f.value} label={f.value} value={f.count} max={maxTechCount} color="bg-amber-400" />
            ))}
          </div>
        </MetricCard>

        {/* Tech: ISO */}
        <MetricCard title={t('gallery.metrics.iso' as any) || 'ISO'}>
          <div className="space-y-4">
            {metrics.isos.slice(0, 5).map(i => (
              <BarRow key={i.value} label={i.value} value={i.count} max={maxTechCount} color="bg-rose-400" />
            ))}
          </div>
        </MetricCard>

        {/* Time of Day */}
        <MetricCard title={t('gallery.metrics.time' as any) || 'Time of Day'}>
          <div className="space-y-4">
            {metrics.timeOfDay.map(t => (
              <BarRow key={t.label} label={t.label} value={t.count} max={maxTimeCount} color="bg-indigo-400" />
            ))}
          </div>
        </MetricCard>

        {/* Geographic Reach */}
        <MetricCard title={t('gallery.metrics.geo' as any) || 'Geographic Reach'}>
          <div className="space-y-4">
            {metrics.geoReach.slice(0, 5).map(g => (
              <BarRow key={g.name} label={g.name} value={g.count} max={maxGearCount} color="bg-cyan-400" />
            ))}
          </div>
        </MetricCard>

        {/* Timeline Summary */}
        <MetricCard title={t('gallery.metrics.timeline' as any) || 'Timeline'}>
          <div className="flex flex-wrap gap-2 overflow-y-auto max-h-64 p-1">
            {metrics.timeline.map(item => (
              <div key={item.period} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1 text-xs font-mono text-white/70">
                <span>{item.period}</span>
                <span className="text-white/30">•</span>
                <span className="text-white">{item.count}</span>
              </div>
            ))}
          </div>
        </MetricCard>
      </div>
    </div>
  )
}
