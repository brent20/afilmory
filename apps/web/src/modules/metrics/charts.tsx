import { clsxm, focusRing } from '@afilmory/utils'
import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ColourFamily, Count, Silence, StackedSeries, WarmthSplit, ZoomLensUsage } from '~/lib/metrics'
import { COLOUR_FAMILY_SWATCH, formatDay, formatMonthYear, formatMonthYearFromDay, formatSilenceLength } from '~/lib/metrics'
import type { GearSpan } from '~/lib/metrics-extras'

import { formatInt } from './format'
import { useReadout } from './hooks'
import { EmptyNote, ReadoutLine } from './ui'

/* -------------------------------------------------------------------------- */
/*  Column chart (hours, weekdays, months, years)                             */
/* -------------------------------------------------------------------------- */

export const ColumnChart = ({
  values,
  labels,
  titles,
  label,
  labelEvery = 1,
  showValues = false,
  heightClass = 'h-36',
  unit = '',
}: {
  values: number[]
  labels: string[]
  /** Full names for the readout when the visible labels are abbreviated */
  titles?: string[]
  /** Text alternative describing the whole chart */
  label: string
  labelEvery?: number
  showValues?: boolean
  heightClass?: string
  unit?: string
}) => {
  const { t } = useTranslation()
  const readout = useReadout()
  const max = Math.max(1, ...values)
  const peak = values.indexOf(Math.max(...values))
  return (
    <div>
      <div role="img" aria-label={label} className="flex flex-col gap-1.5" onMouseLeave={readout.clear}>
        <div className={clsxm('flex items-end gap-[3px]', heightClass)}>
          {values.map((value, i) => (
            <div
              key={`${labels[i]}-${i}`}
              className="flex h-full min-w-0 flex-1 cursor-default flex-col items-center justify-end gap-1"
              onMouseEnter={() => readout.set(`${titles?.[i] ?? labels[i]} · ${formatInt(value)}${unit}`)}
              onClick={() => readout.set(`${titles?.[i] ?? labels[i]} · ${formatInt(value)}${unit}`)}
            >
              {showValues && <span className="text-text-tertiary font-mono text-[10px]">{value || ''}</span>}
              <div
                className={clsxm('bg-accent w-full rounded-t-[3px]', i === peak ? 'opacity-100' : 'opacity-60')}
                style={{ height: `${(value / max) * 100}%`, minHeight: value > 0 ? 2 : 0 }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {labels.map((text, i) => (
            <span
              key={`${text}-${i}`}
              className="text-text-tertiary flex min-w-0 flex-1 justify-center font-mono text-[10px] whitespace-nowrap"
            >
              {i % labelEvery === 0 ? text : ''}
            </span>
          ))}
        </div>
      </div>
      <ReadoutLine text={readout.text} idle={t('metrics.readout.idle')} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Horizontal bar list                                                       */
/* -------------------------------------------------------------------------- */

export const BarList = ({ items, limit, label }: { items: Count[], limit?: number, label: string }) => {
  const shown = limit ? items.slice(0, limit) : items
  const max = Math.max(1, ...shown.map(i => i.count))
  if (shown.every(i => i.count === 0)) {
    return <EmptyNote />
  }
  return (
    <ul aria-label={label} className="space-y-2.5">
      {shown.map(item => (
        <li key={item.name} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-text-secondary truncate">{item.name}</span>
            <span className="text-text-tertiary shrink-0 font-mono">{formatInt(item.count)}</span>
          </div>
          <div aria-hidden="true" className="bg-fill-quaternary h-1.5 overflow-hidden rounded-full">
            <div className="bg-accent h-full rounded-full" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/* -------------------------------------------------------------------------- */
/*  Gear list: names open the gallery filtered to that camera or lens         */
/* -------------------------------------------------------------------------- */

export const GearList = ({
  spans,
  hrefOf,
  label,
}: {
  spans: GearSpan[]
  hrefOf: (span: GearSpan) => string | null
  label: string
}) => {
  const { t } = useTranslation()
  if (spans.length === 0) {
    return <EmptyNote />
  }
  const max = Math.max(1, ...spans.map(s => s.count))
  return (
    <ul aria-label={label} className="space-y-3">
      {spans.map((span) => {
        const href = hrefOf(span)
        return (
          <li key={span.name} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              {href ? (
                <a href={href} className={clsxm(focusRing, 'text-text hover:text-accent truncate underline-offset-4 hover:underline')}>
                  {span.name}
                </a>
              ) : (
                <span className="text-text truncate">{span.name}</span>
              )}
              <span className="text-text-tertiary shrink-0 font-mono text-xs">{formatInt(span.count)}</span>
            </div>
            <div aria-hidden="true" className="bg-fill-quaternary h-1.5 overflow-hidden rounded-full">
              <div className="bg-accent h-full rounded-full" style={{ width: `${(span.count / max) * 100}%` }} />
            </div>
            {span.firstDay > 0 && (
              <p className="text-text-tertiary text-[11px]">
                {t('metrics.gear.span', { from: formatMonthYearFromDay(span.firstDay), to: formatMonthYearFromDay(span.lastDay) })}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/* -------------------------------------------------------------------------- */
/*  Heatmap                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Hover state shared between heatmaps: a map of dimension name → band index.
 * A cell lights up when its row or column band matches the hovered band of that dimension,
 * so a hover in one heatmap traces the same bands in any other heatmap that uses them.
 */
export type HeatmapHover = Record<string, number> | null

export const Heatmap = ({
  rowLabels,
  colLabels,
  colTitles,
  grid,
  label,
  colLabelEvery = 1,
  showNumbers = true,
  rowLabelWidth = 64,
  cellHeightClass = 'h-7',
  minCellWidth = 26,
  rowDim = 'row',
  colDim = 'col',
  hover: controlledHover,
  onHover,
}: {
  rowLabels: string[]
  colLabels: string[]
  colTitles?: string[]
  grid: number[][]
  label: string
  colLabelEvery?: number
  showNumbers?: boolean
  rowLabelWidth?: number
  cellHeightClass?: string
  minCellWidth?: number
  rowDim?: string
  colDim?: string
  hover?: HeatmapHover
  onHover?: (hover: HeatmapHover) => void
}) => {
  const { t } = useTranslation()
  const readout = useReadout()
  const [localHover, setLocalHover] = useState<HeatmapHover>(null)
  const hover = controlledHover === undefined ? localHover : controlledHover
  const setHover = onHover ?? setLocalHover

  const max = useMemo(() => Math.max(1, ...grid.flat()), [grid])
  const total = useMemo(() => grid.flat().reduce((a, b) => a + b, 0), [grid])
  if (total === 0) {
    return <EmptyNote />
  }

  const leave = () => {
    setHover(null)
    readout.clear()
  }

  return (
    <div>
      <div role="img" aria-label={label} className="overflow-x-auto pb-1" onMouseLeave={leave}>
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `${rowLabelWidth}px repeat(${colLabels.length}, minmax(${minCellWidth}px, 1fr))` }}
        >
          <div />
          {colLabels.map((text, c) => (
            <div
              key={`${text}-${c}`}
              className={clsxm(
                'flex justify-center font-mono text-[10px] whitespace-nowrap transition-colors',
                hover?.[colDim] === c ? 'text-text' : 'text-text-tertiary',
              )}
            >
              {c % colLabelEvery === 0 ? text : ''}
            </div>
          ))}
          {grid.map((row, r) => (
            <Fragment key={rowLabels[r]}>
              <div
                className={clsxm(
                  'flex items-center justify-end pr-2 text-right font-mono text-[10px] leading-tight transition-colors',
                  hover?.[rowDim] === r ? 'text-text' : 'text-text-tertiary',
                )}
              >
                {rowLabels[r]}
              </div>
              {row.map((count, c) => {
                const rowOn = hover?.[rowDim] === r
                const colOn = hover?.[colDim] === c
                const describe = () =>
                  readout.set(`${rowLabels[r]} · ${colTitles?.[c] ?? colLabels[c]}: ${t('metrics.photos', { count })}`)
                return (
                  <div
                    key={`${colLabels[c]}-${c}`}
                    onMouseEnter={() => {
                      setHover({ [rowDim]: r, [colDim]: c })
                      describe()
                    }}
                    onClick={() => {
                      setHover({ [rowDim]: r, [colDim]: c })
                      describe()
                    }}
                    className={clsxm(
                      'bg-fill-quaternary relative flex items-center justify-center rounded-[4px] transition-shadow',
                      cellHeightClass,
                      (rowOn || colOn) && 'ring-text-tertiary/50 ring-1',
                      rowOn && colOn && 'ring-text ring-2',
                    )}
                  >
                    {count > 0 && (
                      <div
                        className="bg-accent absolute inset-0 rounded-[4px]"
                        style={{ opacity: 0.18 + 0.82 * Math.sqrt(count / max) }}
                      />
                    )}
                    {showNumbers && count > 0 && (
                      <span className="text-text relative font-mono text-[10px] leading-none">{count}</span>
                    )}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <ReadoutLine text={readout.text} idle={t('metrics.readout.idle')} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Stacked columns by year                                                   */
/* -------------------------------------------------------------------------- */

const SERIES_CLASSES = ['bg-blue', 'bg-orange', 'bg-green', 'bg-purple', 'bg-pink', 'bg-teal', 'bg-yellow', 'bg-indigo'] as const

export const StackedColumns = ({
  data,
  label,
  share = false,
}: {
  data: StackedSeries
  label: string
  share?: boolean
}) => {
  const { t } = useTranslation()
  const readout = useReadout()
  const { years, series, totals } = data
  if (years.length === 0 || totals.every(n => n === 0)) {
    return <EmptyNote />
  }
  const max = share ? 1 : Math.max(1, ...totals)
  const labelEvery = years.length > 16 ? 3 : years.length > 9 ? 2 : 1

  const classFor = (name: string, i: number) =>
    name === 'Other' ? 'bg-fill-secondary' : SERIES_CLASSES[i % SERIES_CLASSES.length]

  return (
    <div className="space-y-3">
      <div role="img" aria-label={label} className="flex flex-col gap-1.5" onMouseLeave={readout.clear}>
        <div className="flex h-48 items-end gap-1.5">
          {years.map((year, yi) => {
            const total = totals[yi]!
            return (
              <div key={year} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div
                  className="flex w-full flex-col-reverse overflow-hidden rounded-t-[3px]"
                  style={{ height: `${((share ? (total ? 1 : 0) : total / max) * 100).toFixed(2)}%` }}
                >
                  {series.map((s, si) => {
                    const count = s.counts[yi]!
                    if (count === 0) {
                      return null
                    }
                    const text = `${year} · ${s.name}: ${t('metrics.photos', { count })}`
                    return (
                      <div
                        key={s.name}
                        className={clsxm('w-full', classFor(s.name, si))}
                        style={{ height: `${(count / total) * 100}%` }}
                        onMouseEnter={() => readout.set(text)}
                        onClick={() => readout.set(text)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-1.5">
          {years.map((year, yi) => (
            <span key={year} className="text-text-tertiary min-w-0 flex-1 text-center font-mono text-[10px]">
              {yi % labelEvery === 0 ? String(year).slice(share || years.length > 12 ? -2 : 0) : ''}
            </span>
          ))}
        </div>
      </div>
      <ReadoutLine text={readout.text} idle={t('metrics.readout.idle')} />
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((s, si) => (
          <li key={s.name} className="text-text-secondary flex min-w-0 items-center gap-1.5 text-xs">
            <span aria-hidden="true" className={clsxm('size-2.5 shrink-0 rounded-[3px]', classFor(s.name, si))} />
            <span className="truncate">{s.name}</span>
            <span className="text-text-tertiary font-mono">{s.counts.reduce((a, b) => a + b, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Dot plot: where a zoom is used                                            */
/* -------------------------------------------------------------------------- */

export const ZoomDotPlot = ({ usage }: { usage: ZoomLensUsage }) => {
  const { t } = useTranslation()
  const readout = useReadout()
  const W = 640
  const left = 44
  const right = 14
  const rowH = 24
  const top = 6
  const axisH = 26
  const rows = usage.years.length
  const H = top + rows * rowH + axisH
  const span = Math.max(1, usage.max - usage.min)
  const x = (focal: number) => left + ((focal - usage.min) / span) * (W - left - right)
  const rowOf = (year: number) => usage.years.indexOf(year)
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round(usage.min + (span * i) / 4))

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={t('metrics.zoom.label', { lens: usage.lens })}
        onMouseLeave={readout.clear}
      >
        {usage.years.map((year, i) => (
          <g key={year}>
            <line
              x1={left}
              x2={W - right}
              y1={top + i * rowH + rowH / 2}
              y2={top + i * rowH + rowH / 2}
              className="stroke-fill-tertiary"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <text
              x={left - 8}
              y={top + i * rowH + rowH / 2 + 3}
              textAnchor="end"
              className="fill-text-tertiary font-mono"
              style={{ fontSize: 10 }}
            >
              {year}
            </text>
          </g>
        ))}
        {ticks.map(tick => (
          <g key={tick}>
            <line x1={x(tick)} x2={x(tick)} y1={top} y2={top + rows * rowH} className="stroke-fill-quaternary" strokeWidth={1} />
            <text
              x={x(tick)}
              y={top + rows * rowH + 16}
              textAnchor="middle"
              className="fill-text-tertiary font-mono"
              style={{ fontSize: 10 }}
            >
              {tick}
              mm
            </text>
          </g>
        ))}
        {usage.dots.map((dot) => {
          const text = `${dot.year} · ${dot.focal}mm: ${t('metrics.photos', { count: dot.count })}`
          return (
            <circle
              key={`${dot.focal}-${dot.year}`}
              cx={x(dot.focal)}
              cy={top + rowOf(dot.year) * rowH + rowH / 2}
              r={2.5 + (rowH / 2 - 3) * Math.sqrt(dot.count / usage.maxDot)}
              className="fill-accent"
              fillOpacity={0.75}
              onMouseEnter={() => readout.set(text)}
              onClick={() => readout.set(text)}
            />
          )
        })}
      </svg>
      <ReadoutLine text={readout.text} idle={t('metrics.readout.idle')} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Color charts                                                              */
/* -------------------------------------------------------------------------- */

export const ColourFamilyBars = ({
  items,
  active,
  onSelect,
}: {
  items: Count[]
  active: ColourFamily | null
  onSelect: (family: ColourFamily | null) => void
}) => {
  const max = Math.max(1, ...items.map(i => i.count))
  if (items.length === 0) {
    return <EmptyNote />
  }
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const family = item.name as ColourFamily
        const selected = active === family
        return (
          <li key={item.name}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(selected ? null : family)}
              className={clsxm(
                focusRing,
                'hover:bg-fill-quaternary flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors',
                selected && 'bg-fill-quaternary',
                active && !selected && 'opacity-50',
              )}
            >
              <span
                aria-hidden="true"
                className="border-border size-3.5 shrink-0 rounded-full border"
                style={{ backgroundColor: COLOUR_FAMILY_SWATCH[family] }}
              />
              <span className="text-text-secondary w-14 shrink-0 text-xs">{item.name}</span>
              <span aria-hidden="true" className="bg-fill-quaternary h-1.5 flex-1 overflow-hidden rounded-full">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(item.count / max) * 100}%`, backgroundColor: COLOUR_FAMILY_SWATCH[family] }}
                />
              </span>
              <span className="text-text-tertiary w-10 shrink-0 text-right font-mono text-xs">{item.count}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

const MAX_DOTS_PER_MONTH = 60
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

export const ColourTimeline = ({
  years,
  cells,
  active,
  label,
}: {
  years: number[]
  cells: ColourFamily[][][]
  active: ColourFamily | null
  label: string
}) => {
  const { t } = useTranslation()
  if (years.length === 0) {
    return <EmptyNote />
  }
  return (
    <div role="img" aria-label={label} className="overflow-x-auto pb-1">
      <div className="grid min-w-[560px] gap-[3px]" style={{ gridTemplateColumns: '40px repeat(12, minmax(0, 1fr))' }}>
        <div />
        {MONTHS.map((m, i) => (
          <div key={i} className="text-text-tertiary text-center font-mono text-[10px]">
            {m}
          </div>
        ))}
        {years.map((year, yi) => (
          <Fragment key={year}>
            <div className="text-text-tertiary flex items-start justify-end pt-1.5 pr-2 font-mono text-[10px]">{year}</div>
            {cells[yi]!.map((families, mi) => (
              <div
                key={mi}
                className="bg-fill-quaternary flex min-h-9 flex-wrap content-start gap-[2px] rounded-[4px] p-[3px]"
                title={`${formatMonthYear(year, mi + 1)}: ${t('metrics.photos', { count: families.length })}`}
              >
                {families.slice(0, MAX_DOTS_PER_MONTH).map((family, i) => (
                  <span
                    key={i}
                    className={clsxm('size-[5px] rounded-full transition-opacity', active && active !== family && 'opacity-15')}
                    style={{ backgroundColor: COLOUR_FAMILY_SWATCH[family] }}
                  />
                ))}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

/** One pixel-wide stripe per photo, sorted around the color wheel */
export const RainbowStrip = ({ colors, label }: { colors: string[], label: string }) => {
  if (colors.length === 0) {
    return <EmptyNote />
  }
  return (
    <div role="img" aria-label={label} className="flex h-16 overflow-hidden rounded-xl">
      {colors.map((color, i) => (
        <span key={i} className="h-full min-w-0 flex-1" style={{ backgroundColor: color }} />
      ))}
    </div>
  )
}

const WARMTH_KEYS = {
  warm: 'metrics.warmth.warm',
  neutral: 'metrics.warmth.neutral',
  cool: 'metrics.warmth.cool',
} as const

/** Warm / neutral / cool as a split bar per row. Data colors, so they are literal. */
export const SplitBars = ({ rows, label }: { rows: WarmthSplit[], label: string }) => {
  const { t } = useTranslation()
  return (
    <ul aria-label={label} className="space-y-3">
      {rows.map((row) => {
        const total = Math.max(1, row.total)
        const parts = [
          { key: 'warm', count: row.warm, color: 'hsl(24 85% 55%)' },
          { key: 'neutral', count: row.neutral, color: 'hsl(0 0% 60%)' },
          { key: 'cool', count: row.cool, color: 'hsl(212 75% 55%)' },
        ] as const
        return (
          <li key={row.label} className="space-y-1">
            <div className="text-text-secondary flex justify-between text-xs">
              <span>{row.label}</span>
              <span className="text-text-tertiary font-mono">
                {parts.map(p => `${Math.round((p.count / total) * 100)}%`).join(' · ')}
              </span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full" title={parts.map(p => `${t(WARMTH_KEYS[p.key])} ${p.count}`).join(' · ')}>
              {parts.map(p => (
                <span key={p.key} style={{ width: `${(p.count / total) * 100}%`, backgroundColor: p.color }} />
              ))}
            </div>
          </li>
        )
      })}
      <li className="text-text-tertiary flex gap-4 text-[11px]">
        <span>
          {t('metrics.warmth.warm')}
          {' '}
          ·
          {' '}
          {t('metrics.warmth.neutral')}
          {' '}
          ·
          {' '}
          {t('metrics.warmth.cool')}
        </span>
      </li>
    </ul>
  )
}

/* -------------------------------------------------------------------------- */
/*  Longest silences                                                          */
/* -------------------------------------------------------------------------- */

export const SilenceList = ({ silences, span }: { silences: Silence[], span: { first: number, last: number } }) => {
  const length = Math.max(1, span.last - span.first)
  const yearOf = (day: number) => new Date(day * 86_400_000).getUTCFullYear()
  return (
    <div className="space-y-5">
      <div>
        <div aria-hidden="true" className="bg-fill-quaternary relative h-2 overflow-hidden rounded-full">
          {silences.map(silence => (
            <div
              key={silence.fromDay}
              className="bg-accent absolute top-0 h-full opacity-70"
              style={{
                left: `${((silence.fromDay - span.first) / length) * 100}%`,
                width: `${Math.max(0.6, (silence.days / length) * 100)}%`,
              }}
            />
          ))}
        </div>
        <div className="text-text-tertiary mt-1.5 flex justify-between font-mono text-[10px]">
          <span>{yearOf(span.first)}</span>
          <span>{yearOf(span.last)}</span>
        </div>
      </div>
      <ol className="divide-border divide-y">
        {silences.map(silence => (
          <li key={silence.fromDay} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
            <span className="text-text font-serif text-lg">{formatSilenceLength(silence.days)}</span>
            <span className="text-text-secondary text-xs">
              {formatDay(silence.fromDay)}
              {' '}
              →
              {formatDay(silence.toDay)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
