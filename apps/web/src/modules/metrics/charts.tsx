import { clsxm } from '@afilmory/utils'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

import type { ColourFamily, Count, StackedSeries, ZoomLensUsage } from '~/lib/metrics'
import { COLOUR_FAMILY_SWATCH } from '~/lib/metrics'

/* -------------------------------------------------------------------------- */
/*  Layout primitives                                                         */
/* -------------------------------------------------------------------------- */

export const Section = ({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  children: ReactNode
}) => (
  <section id={id} className="scroll-mt-24 space-y-5">
    <header>
      <p className="text-accent font-mono text-xs tracking-widest uppercase">{eyebrow}</p>
      <h2 className="text-text mt-1 font-serif text-2xl md:text-3xl">{title}</h2>
    </header>
    <div className="space-y-5">{children}</div>
  </section>
)

export const Card = ({
  title,
  note,
  action,
  children,
  className,
}: {
  title: string
  note?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) => (
  <div className={clsxm('bg-material-thin border-border flex flex-col gap-4 rounded-2xl border p-5', className)}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-text-secondary font-mono text-xs tracking-widest uppercase">{title}</h3>
        {note && <p className="text-text-tertiary mt-1 text-xs">{note}</p>}
      </div>
      {action}
    </div>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
)

export const Segmented = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) => (
  <div className="bg-fill-quaternary flex shrink-0 rounded-lg p-0.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={clsxm(
          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200',
          option.value === value ? 'bg-accent text-white' : 'text-text-secondary hover:text-text',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
)

export const StatTile = ({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) => (
  <div className="bg-material-thin border-border flex min-w-0 flex-col gap-1.5 rounded-2xl border p-5">
    <span className="text-text-tertiary font-mono text-[10px] tracking-widest uppercase">{label}</span>
    <span className="text-text truncate font-serif text-2xl md:text-3xl" title={typeof value === 'string' ? value : undefined}>
      {value}
    </span>
    {hint && <span className="text-text-secondary truncate text-xs">{hint}</span>}
  </div>
)

export const EmptyNote = ({ children }: { children: ReactNode }) => (
  <p className="text-text-tertiary py-6 text-center text-sm">{children}</p>
)

/* -------------------------------------------------------------------------- */
/*  Column chart (hours, weekdays, months)                                    */
/* -------------------------------------------------------------------------- */

export const ColumnChart = ({
  values,
  labels,
  labelEvery = 1,
  showValues = false,
  heightClass = 'h-36',
}: {
  values: number[]
  labels: string[]
  labelEvery?: number
  showValues?: boolean
  heightClass?: string
}) => {
  const max = Math.max(1, ...values)
  const peak = values.indexOf(Math.max(...values))
  return (
    <div className="flex flex-col gap-1.5">
      <div className={clsxm('flex items-end gap-[3px]', heightClass)}>
        {values.map((value, i) => (
          <div
            key={labels[i]}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            title={`${labels[i]}: ${value.toLocaleString()}`}
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
        {labels.map((label, i) => (
          <span key={label} className="text-text-tertiary min-w-0 flex-1 text-center font-mono text-[10px]">
            {i % labelEvery === 0 ? label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Horizontal bar list                                                       */
/* -------------------------------------------------------------------------- */

export const BarList = ({ items, limit }: { items: Count[]; limit?: number }) => {
  const shown = limit ? items.slice(0, limit) : items
  const max = Math.max(1, ...shown.map((i) => i.count))
  if (shown.every((i) => i.count === 0)) return <EmptyNote>No data yet.</EmptyNote>
  return (
    <ul className="space-y-2.5">
      {shown.map((item) => (
        <li key={item.name} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-text-secondary truncate">{item.name}</span>
            <span className="text-text-tertiary shrink-0 font-mono">{item.count.toLocaleString()}</span>
          </div>
          <div className="bg-fill-quaternary h-1.5 overflow-hidden rounded-full">
            <div className="bg-accent h-full rounded-full" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/* -------------------------------------------------------------------------- */
/*  Heatmap                                                                   */
/* -------------------------------------------------------------------------- */

export const Heatmap = ({
  rowLabels,
  colLabels,
  grid,
  colLabelEvery = 1,
  showNumbers = true,
  rowLabelWidth = 64,
  cellHeightClass = 'h-7',
  minCellWidth = 26,
}: {
  rowLabels: string[]
  colLabels: string[]
  grid: number[][]
  colLabelEvery?: number
  showNumbers?: boolean
  rowLabelWidth?: number
  cellHeightClass?: string
  minCellWidth?: number
}) => {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null)
  const max = useMemo(() => Math.max(1, ...grid.flat()), [grid])
  const total = useMemo(() => grid.flat().reduce((a, b) => a + b, 0), [grid])
  if (total === 0) return <EmptyNote>No data yet.</EmptyNote>

  return (
    <div className="overflow-x-auto pb-1" onMouseLeave={() => setHover(null)}>
      <div
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `${rowLabelWidth}px repeat(${colLabels.length}, minmax(${minCellWidth}px, 1fr))`,
        }}
      >
        <div />
        {colLabels.map((label, c) => (
          <div
            key={label}
            className={clsxm(
              'text-center font-mono text-[10px] transition-colors',
              hover?.c === c ? 'text-text' : 'text-text-tertiary',
            )}
          >
            {c % colLabelEvery === 0 ? label : ''}
          </div>
        ))}
        {grid.map((row, r) => (
          <HeatmapRow
            key={rowLabels[r]}
            label={rowLabels[r]!}
            row={row}
            r={r}
            max={max}
            hover={hover}
            setHover={setHover}
            showNumbers={showNumbers}
            cellHeightClass={cellHeightClass}
            colLabels={colLabels}
          />
        ))}
      </div>
    </div>
  )
}

const HeatmapRow = ({
  label,
  row,
  r,
  max,
  hover,
  setHover,
  showNumbers,
  cellHeightClass,
  colLabels,
}: {
  label: string
  row: number[]
  r: number
  max: number
  hover: { r: number; c: number } | null
  setHover: (value: { r: number; c: number } | null) => void
  showNumbers: boolean
  cellHeightClass: string
  colLabels: string[]
}) => (
  <>
    <div
      className={clsxm(
        'flex items-center justify-end pr-2 font-mono text-[10px] transition-colors',
        hover?.r === r ? 'text-text' : 'text-text-tertiary',
      )}
    >
      {label}
    </div>
    {row.map((count, c) => {
      const active = hover && (hover.r === r || hover.c === c)
      return (
        <div
          key={colLabels[c]}
          onMouseEnter={() => setHover({ r, c })}
          title={`${label} · ${colLabels[c]}: ${count.toLocaleString()}`}
          className={clsxm(
            'bg-fill-quaternary relative flex items-center justify-center rounded-[4px] transition-shadow',
            cellHeightClass,
            active && 'ring-text-tertiary/50 ring-1',
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
  </>
)

/* -------------------------------------------------------------------------- */
/*  Stacked columns by year                                                   */
/* -------------------------------------------------------------------------- */

const SERIES_CLASSES = [
  'bg-blue',
  'bg-orange',
  'bg-green',
  'bg-purple',
  'bg-pink',
  'bg-teal',
  'bg-yellow',
  'bg-indigo',
] as const

export const StackedColumns = ({ data, share = false }: { data: StackedSeries; share?: boolean }) => {
  const { years, series, totals } = data
  if (years.length === 0 || totals.every((t) => t === 0)) return <EmptyNote>No data yet.</EmptyNote>
  const max = share ? 1 : Math.max(1, ...totals)
  const labelEvery = years.length > 16 ? 3 : years.length > 9 ? 2 : 1

  const classFor = (name: string, i: number) =>
    name === 'Other' ? 'bg-fill-secondary' : SERIES_CLASSES[i % SERIES_CLASSES.length]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
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
                    if (count === 0) return null
                    return (
                      <div
                        key={s.name}
                        className={clsxm('w-full', classFor(s.name, si))}
                        style={{ height: `${(count / total) * 100}%` }}
                        title={`${year} · ${s.name}: ${count.toLocaleString()}`}
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
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((s, si) => (
          <li key={s.name} className="text-text-secondary flex min-w-0 items-center gap-1.5 text-xs">
            <span className={clsxm('size-2.5 shrink-0 rounded-[3px]', classFor(s.name, si))} />
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Focal lengths used with ${usage.lens}`}>
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
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={x(tick)}
            x2={x(tick)}
            y1={top}
            y2={top + rows * rowH}
            className="stroke-fill-quaternary"
            strokeWidth={1}
          />
          <text
            x={x(tick)}
            y={top + rows * rowH + 16}
            textAnchor="middle"
            className="fill-text-tertiary font-mono"
            style={{ fontSize: 10 }}
          >
            {tick}mm
          </text>
        </g>
      ))}
      {usage.dots.map((dot) => (
        <circle
          key={`${dot.focal}-${dot.year}`}
          cx={x(dot.focal)}
          cy={top + rowOf(dot.year) * rowH + rowH / 2}
          r={2.5 + (rowH / 2 - 3) * Math.sqrt(dot.count / usage.maxDot)}
          className="fill-accent"
          fillOpacity={0.75}
        >
          <title>{`${dot.year} · ${dot.focal}mm: ${dot.count} photo${dot.count === 1 ? '' : 's'}`}</title>
        </circle>
      ))}
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/*  Colour charts                                                             */
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
  const max = Math.max(1, ...items.map((i) => i.count))
  if (items.length === 0) return <EmptyNote>No colour data yet.</EmptyNote>
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const family = item.name as ColourFamily
        const selected = active === family
        return (
          <li key={item.name}>
            <button
              type="button"
              onClick={() => onSelect(selected ? null : family)}
              className={clsxm(
                'hover:bg-fill-quaternary flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors',
                selected && 'bg-fill-quaternary',
                active && !selected && 'opacity-50',
              )}
            >
              <span
                className="border-border size-3.5 shrink-0 rounded-full border"
                style={{ backgroundColor: COLOUR_FAMILY_SWATCH[family] }}
              />
              <span className="text-text-secondary w-14 shrink-0 text-xs">{item.name}</span>
              <span className="bg-fill-quaternary h-1.5 flex-1 overflow-hidden rounded-full">
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
}: {
  years: number[]
  cells: ColourFamily[][][]
  active: ColourFamily | null
}) => {
  if (years.length === 0) return <EmptyNote>No dated photos yet.</EmptyNote>
  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[560px] gap-[3px]" style={{ gridTemplateColumns: '40px repeat(12, minmax(0, 1fr))' }}>
        <div />
        {MONTHS.map((m, i) => (
          <div key={i} className="text-text-tertiary text-center font-mono text-[10px]">
            {m}
          </div>
        ))}
        {years.map((year, yi) => (
          <ColourYearRow key={year} year={year} row={cells[yi]!} active={active} />
        ))}
      </div>
    </div>
  )
}

const ColourYearRow = ({ year, row, active }: { year: number; row: ColourFamily[][]; active: ColourFamily | null }) => (
  <>
    <div className="text-text-tertiary flex items-start justify-end pt-1.5 pr-2 font-mono text-[10px]">{year}</div>
    {row.map((families, mi) => (
      <div
        key={mi}
        className="bg-fill-quaternary flex min-h-9 flex-wrap content-start gap-[2px] rounded-[4px] p-[3px]"
        title={`${year}-${String(mi + 1).padStart(2, '0')}: ${families.length} photo${families.length === 1 ? '' : 's'}`}
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
  </>
)
