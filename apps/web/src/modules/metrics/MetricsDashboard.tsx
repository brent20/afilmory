import { useState } from 'react'

import type { ColourFamily, ColourMetrics, PhotoMetrics } from '~/lib/metrics'
import { APERTURE_BANDS, FOCAL_EQUIV_BANDS, formatHour, formatHourShort, ISO_BANDS } from '~/lib/metrics'
import { MostViewedPhotos } from '~/modules/views/MostViewedPhotos'

import {
  BarList,
  Card,
  ColourFamilyBars,
  ColourTimeline,
  ColumnChart,
  EmptyNote,
  Heatmap,
  type HeatmapHover,
  Section,
  Segmented,
  SilenceList,
  StackedColumns,
  StatTile,
  ZoomDotPlot,
} from './charts'

const NAV = [
  { id: 'fun-stats', label: 'Fun stats' },
  { id: 'recent-trends', label: 'Recent trends' },
  { id: 'time', label: 'Time' },
  { id: 'how-you-shoot', label: 'How you shoot' },
  { id: 'gear', label: 'Gear' },
  { id: 'colour', label: 'Colour' },
]

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => formatHourShort(h))
const HOUR_TITLES = Array.from({ length: 24 }, (_, h) => formatHour(h))

const pct = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`)
const hourLabel = (h: number | null) => (h === null ? '—' : formatHour(h))

const comfortLabel = (c: PhotoMetrics['fun']['comfort']) => {
  const parts = [
    c.aperture === null ? null : `f/${c.aperture}`,
    c.iso === null ? null : `ISO ${c.iso}`,
    c.focal === null ? null : `${c.focal}mm`,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

const coverageNote = (share: number) => `Available for ${Math.round(share * 100)}% of archive`

const countOf = (items: { count: number }[]) => items.reduce((sum, i) => sum + i.count, 0)

export const MetricsDashboard = ({ metrics, colour }: { metrics: PhotoMetrics; colour: ColourMetrics | null }) => {
  const [gearView, setGearView] = useState<'bodies' | 'lenses'>('bodies')
  const [gearShare, setGearShare] = useState(false)
  const [focalShare, setFocalShare] = useState(false)
  const [activeFamily, setActiveFamily] = useState<ColourFamily | null>(null)
  const [timeHover, setTimeHover] = useState<HeatmapHover>(null)
  const [settingsHover, setSettingsHover] = useState<HeatmapHover>(null)

  const { fun } = metrics
  const span =
    metrics.firstYear === null
      ? undefined
      : metrics.firstYear === metrics.lastYear
        ? String(metrics.firstYear)
        : `${metrics.firstYear}–${metrics.lastYear}`

  return (
    <div className="space-y-16">
      <nav className="flex flex-wrap justify-center gap-2">
        {NAV.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="bg-fill-quaternary text-text-secondary hover:bg-fill-tertiary hover:text-text rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200"
          >
            {item.label}
          </a>
        ))}
      </nav>

      {/* ------------------------------ Fun stats ------------------------------ */}
      <Section id="fun-stats" eyebrow="At a glance" title="Fun stats">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <StatTile label="Photos" value={metrics.total.toLocaleString()} hint={span} />
          <StatTile
            label="Cameras"
            value={metrics.cameras.length.toLocaleString()}
            hint={`${metrics.lenses.length} lenses`}
          />
          <StatTile label="Countries" value={metrics.countries.length.toLocaleString()} />
          <StatTile label="Peak hour" value={hourLabel(fun.peakHour)} hint="Most photos taken" />
          <StatTile
            label="Top camera"
            value={fun.topCamera?.name ?? '—'}
            hint={fun.topCamera ? `${fun.topCamera.count.toLocaleString()} photos` : undefined}
          />
          <StatTile
            label="Top lens"
            value={fun.topLens?.name ?? '—'}
            hint={fun.topLens ? `${fun.topLens.count.toLocaleString()} photos` : undefined}
          />
          <StatTile
            label="Top country"
            value={fun.topCountry?.name ?? '—'}
            hint={fun.topCountry ? `${fun.topCountry.count.toLocaleString()} photos` : undefined}
          />
          <StatTile label="Weekend share" value={pct(fun.weekendShare)} hint="Shot on Sat or Sun" />
          <StatTile
            label="Prime vs zoom"
            value={fun.primeShare === null ? '—' : `${pct(fun.primeShare)} prime`}
            hint={fun.primeShare === null ? undefined : `${pct(1 - fun.primeShare)} zoom`}
          />
          <StatTile label="Comfort settings" value={comfortLabel(fun.comfort)} hint="Most common values" />
          <StatTile label="Night owl" value={pct(fun.nightShare)} hint="Shot between 9 PM and 5 AM" />
          <StatTile
            label="Colour mood"
            value={colour ? (colour.families[0]?.name ?? '—') : '…'}
            hint={colour?.families[0] ? 'Most common dominant colour' : undefined}
          />
        </div>

        <Card title="Most viewed photos">
          <MostViewedPhotos />
        </Card>
      </Section>

      {/* ---------------------------- Recent trends ---------------------------- */}
      <Section id="recent-trends" eyebrow="Lately" title="Recent trends">
        <Card title="Photos per month" note="The last five years, month by month.">
          <Heatmap
            rowLabels={metrics.recent.years.map(String)}
            colLabels={MONTH_LABELS}
            grid={metrics.recent.grid}
            rowLabelWidth={44}
            cellHeightClass="h-9"
            minCellWidth={34}
          />
        </Card>
      </Section>

      {/* --------------------------------- Time -------------------------------- */}
      <Section id="time" eyebrow="All time" title="When you shoot">
        <Card
          title="Time of day"
          note={fun.peakHour === null ? undefined : `Busiest hour: ${hourLabel(fun.peakHour)} (camera local time).`}
        >
          <ColumnChart values={metrics.hours} labels={HOUR_LABELS} titles={HOUR_TITLES} labelEvery={3} />
        </Card>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card
            title="Time of day × aperture"
            note="Hover a square to highlight its band and hour across both heatmaps."
          >
            <Heatmap
              rowLabels={APERTURE_BANDS.map((b) => b.label)}
              colLabels={HOUR_LABELS}
              colTitles={HOUR_TITLES}
              grid={metrics.apertureByHour}
              colLabelEvery={3}
              showNumbers={false}
              rowLabelWidth={104}
              cellHeightClass="h-6"
              minCellWidth={14}
              rowDim="aperture"
              colDim="hour"
              hover={timeHover}
              onHover={setTimeHover}
            />
          </Card>
          <Card title="Time of day × ISO">
            <Heatmap
              rowLabels={ISO_BANDS.map((b) => b.label)}
              colLabels={HOUR_LABELS}
              colTitles={HOUR_TITLES}
              grid={metrics.isoByHour}
              colLabelEvery={3}
              showNumbers={false}
              rowLabelWidth={104}
              cellHeightClass="h-6"
              minCellWidth={14}
              rowDim="iso"
              colDim="hour"
              hover={timeHover}
              onHover={setTimeHover}
            />
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Archive cadence · day of week">
            <ColumnChart values={metrics.dayOfWeek} labels={DAY_LABELS} showValues />
          </Card>
          <Card title="Archive cadence · month">
            <ColumnChart values={metrics.monthOfYear} labels={MONTH_LABELS} showValues />
          </Card>
        </div>

        {metrics.daySpan && metrics.silences.length > 0 && (
          <Card title="Longest silences" note="Stretches with no photograph">
            <SilenceList silences={metrics.silences} span={metrics.daySpan} />
          </Card>
        )}
      </Section>

      {/* ----------------------------- How you shoot ---------------------------- */}
      <Section id="how-you-shoot" eyebrow="Shooting settings" title="How you shoot">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Focal length (35mm equiv.)" note={coverageNote(metrics.coverage.focal)}>
            <BarList items={metrics.focalBars} />
          </Card>
          <Card title="Focal length (actual)" note={coverageNote(metrics.coverage.focalActual)}>
            <BarList items={metrics.focalActualBars} />
          </Card>
          <Card title="Aperture" note={coverageNote(metrics.coverage.aperture)}>
            <BarList items={metrics.apertureBars} />
          </Card>
          <Card title="ISO" note={coverageNote(metrics.coverage.iso)}>
            <BarList items={metrics.isoBars} />
          </Card>
        </div>

        <div className="space-y-3 pt-2">
          <div>
            <h3 className="text-text font-serif text-xl">Settings relationships</h3>
            <p className="text-text-secondary mt-1 text-xs">
              Based on {metrics.relationships.total.toLocaleString()} photos with focal length, aperture, and ISO.
              Hover a square to trace the corresponding relationships across the other heatmaps.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card title="Focal length (35mm equiv.) × aperture">
              <Heatmap
                rowLabels={APERTURE_BANDS.map((b) => b.label)}
                colLabels={FOCAL_EQUIV_BANDS.map((b) => b.short)}
                colTitles={FOCAL_EQUIV_BANDS.map((b) => b.label)}
                grid={metrics.relationships.focalAperture}
                rowLabelWidth={104}
                minCellWidth={34}
                rowDim="aperture"
                colDim="focal"
                hover={settingsHover}
                onHover={setSettingsHover}
              />
            </Card>
            <Card title="Focal length (35mm equiv.) × ISO">
              <Heatmap
                rowLabels={ISO_BANDS.map((b) => b.label)}
                colLabels={FOCAL_EQUIV_BANDS.map((b) => b.short)}
                colTitles={FOCAL_EQUIV_BANDS.map((b) => b.label)}
                grid={metrics.relationships.focalIso}
                rowLabelWidth={56}
                minCellWidth={34}
                rowDim="iso"
                colDim="focal"
                hover={settingsHover}
                onHover={setSettingsHover}
              />
            </Card>
            <Card title="Aperture × ISO">
              <Heatmap
                rowLabels={ISO_BANDS.map((b) => b.label)}
                colLabels={APERTURE_BANDS.map((b) => b.short)}
                colTitles={APERTURE_BANDS.map((b) => b.label)}
                grid={metrics.relationships.apertureIso}
                rowLabelWidth={56}
                minCellWidth={38}
                rowDim="iso"
                colDim="aperture"
                hover={settingsHover}
                onHover={setSettingsHover}
              />
            </Card>
          </div>
        </div>
      </Section>

      {/* ---------------------------------- Gear -------------------------------- */}
      <Section id="gear" eyebrow="Cameras and lenses" title="Gear over time">
        <Card
          title="Gear over time"
          note="Photos per year, split by camera body or lens."
          action={
            <div className="flex flex-wrap justify-end gap-2">
              <Segmented
                options={[
                  { value: 'bodies', label: 'Bodies' },
                  { value: 'lenses', label: 'Lenses' },
                ]}
                value={gearView}
                onChange={setGearView}
              />
              <Segmented
                options={[
                  { value: 'count', label: 'Count' },
                  { value: 'share', label: 'Share' },
                ]}
                value={gearShare ? 'share' : 'count'}
                onChange={(v) => setGearShare(v === 'share')}
              />
            </div>
          }
        >
          <StackedColumns data={gearView === 'bodies' ? metrics.gearBodies : metrics.gearLenses} share={gearShare} />
        </Card>

        <Card
          title="Focal length over time"
          note="35mm equivalent, grouped into bands."
          action={
            <Segmented
              options={[
                { value: 'count', label: 'Count' },
                { value: 'share', label: 'Share' },
              ]}
              value={focalShare ? 'share' : 'count'}
              onChange={(v) => setFocalShare(v === 'share')}
            />
          }
        >
          <StackedColumns data={metrics.focalOverTime} share={focalShare} />
        </Card>

        {metrics.zoomUsage.length === 0 ? (
          <Card title="Where a zoom is used">
            <EmptyNote>No zoom lens with enough photos yet.</EmptyNote>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {metrics.zoomUsage.map((usage) => (
              <Card
                key={usage.lens}
                title={`Where a zoom is used · ${usage.lens}`}
                note={`Wide to long · dot size shows photo count · ${usage.total.toLocaleString()} photos`}
              >
                <ZoomDotPlot usage={usage} />
              </Card>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Every camera">
            <BarList items={metrics.cameras} limit={10} />
          </Card>
          <Card title="Every lens">
            <BarList items={metrics.lenses} limit={10} />
          </Card>
        </div>
      </Section>

      {/* --------------------------------- Colour ------------------------------- */}
      <Section id="colour" eyebrow="Colour" title="Colour">
        {colour === null ? (
          <Card title="Colour">
            <EmptyNote>Analysing colours…</EmptyNote>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Card
              title="Dominant colour families"
              note={`Estimated from each photo's preview. ${countOf(colour.families).toLocaleString()} photos analysed.`}
            >
              <ColourFamilyBars items={colour.families} active={activeFamily} onSelect={setActiveFamily} />
            </Card>
            <Card
              title="Colour over time"
              note={
                activeFamily
                  ? `Showing ${activeFamily} · click it again to clear.`
                  : 'One dot per photo. Pick a family to isolate it.'
              }
            >
              <ColourTimeline years={colour.timeline.years} cells={colour.timeline.cells} active={activeFamily} />
            </Card>
          </div>
        )}
      </Section>

      {/* -------------------------------- Places -------------------------------- */}
      {metrics.countries.length > 0 && (
        <Section id="places" eyebrow="Places" title="Geographic reach">
          <Card title="Countries">
            <BarList items={metrics.countries} limit={10} />
          </Card>
        </Section>
      )}
    </div>
  )
}
