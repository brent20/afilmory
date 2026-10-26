import type { PhotoManifestItem } from '@afilmory/typing'
import { decompressUint8Array } from '@afilmory/utils'
import { thumbHashToRGBA } from 'thumbhash'

/* -------------------------------------------------------------------------- */
/*  Bands                                                                     */
/* -------------------------------------------------------------------------- */

export interface Band {
  label: string
  /** Inclusive upper bound. */
  max: number
}

export const FOCAL_BANDS: Band[] = [
  { label: '<18mm', max: 17 },
  { label: '18–23', max: 23 },
  { label: '24–34', max: 34 },
  { label: '35–49', max: 49 },
  { label: '50–69', max: 69 },
  { label: '70–99', max: 99 },
  { label: '100mm+', max: Infinity },
]

export const APERTURE_BANDS: Band[] = [
  { label: 'f/1.8', max: 1.85 },
  { label: 'f/2–2.8', max: 2.85 },
  { label: 'f/3.2–4', max: 4.05 },
  { label: 'f/4.5–5.6', max: 5.65 },
  { label: 'f/6.3–8', max: 8.05 },
  { label: 'f/9–11', max: 11.05 },
  { label: 'f/13+', max: Infinity },
]

export const ISO_BANDS: Band[] = [
  { label: '≤200', max: 200 },
  { label: '400', max: 400 },
  { label: '800', max: 800 },
  { label: '1600', max: 1600 },
  { label: '3200', max: 3200 },
  { label: '6400', max: 6400 },
  { label: '12800+', max: Infinity },
]

export const bandIndex = (value: number | null, bands: Band[]): number => {
  if (value === null) return -1
  return bands.findIndex((b) => value <= b.max)
}

/* -------------------------------------------------------------------------- */
/*  Colour families (derived from the thumbhash, so approximate)              */
/* -------------------------------------------------------------------------- */

export const COLOUR_FAMILIES = [
  'Red',
  'Orange',
  'Brown',
  'Yellow',
  'Green',
  'Teal',
  'Blue',
  'Purple',
  'Pink',
  'Black',
  'Grey',
  'White',
] as const

export type ColourFamily = (typeof COLOUR_FAMILIES)[number]

/** Swatch colours. These are *data* colours (what the photos look like), not UI chrome. */
export const COLOUR_FAMILY_SWATCH: Record<ColourFamily, string> = {
  Red: 'hsl(2 72% 52%)',
  Orange: 'hsl(26 90% 54%)',
  Brown: 'hsl(25 45% 34%)',
  Yellow: 'hsl(48 92% 55%)',
  Green: 'hsl(130 48% 42%)',
  Teal: 'hsl(180 55% 42%)',
  Blue: 'hsl(215 75% 55%)',
  Purple: 'hsl(272 55% 56%)',
  Pink: 'hsl(330 68% 62%)',
  Black: 'hsl(0 0% 14%)',
  Grey: 'hsl(0 0% 56%)',
  White: 'hsl(0 0% 93%)',
}

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === rn) h = ((gn - bn) / d) % 6
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  h *= 60
  if (h < 0) h += 360
  return [h, s, l]
}

const classifyPixel = (r: number, g: number, b: number): ColourFamily => {
  const [h, s, l] = rgbToHsl(r, g, b)
  if (l < 0.12) return 'Black'
  if (l > 0.93) return 'White'
  if (s < 0.14) {
    if (l < 0.22) return 'Black'
    if (l > 0.82) return 'White'
    return 'Grey'
  }
  if (h < 15 || h >= 345) return 'Red'
  if (h < 45) return l < 0.4 ? 'Brown' : 'Orange'
  if (h < 70) return l < 0.35 ? 'Brown' : 'Yellow'
  if (h < 165) return 'Green'
  if (h < 200) return 'Teal'
  if (h < 255) return 'Blue'
  if (h < 300) return 'Purple'
  return 'Pink'
}

/** Dominant colour family of a thumbhash: the family covering the most pixels. */
export const dominantFamilyFromThumbHash = (thumbHash: string | null | undefined): ColourFamily | null => {
  if (!thumbHash) return null
  try {
    const { w, h, rgba } = thumbHashToRGBA(decompressUint8Array(thumbHash))
    const counts = new Map<ColourFamily, number>()
    for (let i = 0; i < w * h; i++) {
      const family = classifyPixel(rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!)
      counts.set(family, (counts.get(family) ?? 0) + 1)
    }
    let best: ColourFamily | null = null
    let bestCount = 0
    for (const [family, count] of counts) {
      if (count > bestCount) {
        best = family
        bestCount = count
      }
    }
    return best
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*  Per-photo records                                                         */
/* -------------------------------------------------------------------------- */

export interface PhotoRecord {
  id: string
  year: number | null
  /** 1–12 */
  month: number | null
  /** 0–23, the camera's local clock (never converted to the viewer's timezone) */
  hour: number | null
  /** 0 = Sunday */
  dow: number | null
  camera: string | null
  lens: string | null
  /** 35mm-equivalent focal length, falling back to the actual one */
  focal: number | null
  /** Actual focal length as written on the lens */
  focalActual: number | null
  aperture: number | null
  iso: number | null
  country: string | null
}

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

const DATE_RE = /^(\d{4})[-:](\d{2})[-:](\d{2})[T ](\d{2})/

const parseDate = (value: unknown) => {
  if (typeof value !== 'string') return null
  const m = DATE_RE.exec(value)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const hour = Number(m[4])
  if (year < 1990 || month < 1 || month > 12) return null
  return { year, month, hour, dow: new Date(Date.UTC(year, month - 1, day)).getUTCDay() }
}

const cameraName = (make?: string, model?: string): string | null => {
  const mk = make?.trim()
  const md = model?.trim()
  if (!md) return null
  if (!mk) return md
  return md.toLowerCase().startsWith(mk.split(' ')[0]!.toLowerCase()) ? md : `${mk} ${md}`
}

export const toRecords = (photos: PhotoManifestItem[]): PhotoRecord[] =>
  photos.map((photo) => {
    const exif = photo.exif
    const date = parseDate(exif?.DateTimeOriginal) ?? parseDate(photo.dateTaken)
    const actual = parseNumber(exif?.FocalLength)
    const equiv = parseNumber(exif?.FocalLengthIn35mmFormat)
    const focal = equiv ?? actual
    return {
      id: photo.id,
      year: date?.year ?? null,
      month: date?.month ?? null,
      hour: date?.hour ?? null,
      dow: date?.dow ?? null,
      camera: cameraName(exif?.Make, exif?.Model),
      lens: exif?.LensModel?.trim() || null,
      focal: focal === null ? null : Math.round(focal),
      focalActual: (actual ?? equiv) === null ? null : Math.round((actual ?? equiv)!),
      aperture: parseNumber(exif?.FNumber),
      iso: parseNumber(exif?.ISO),
      country: photo.location?.country ?? null,
    }
  })

/* -------------------------------------------------------------------------- */
/*  Aggregation helpers                                                       */
/* -------------------------------------------------------------------------- */

export interface Count {
  name: string
  count: number
}

const countBy = <T>(items: T[], keyOf: (item: T) => string | null): Count[] => {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyOf(item)
    if (key === null) continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}

export const crossTab = (
  records: PhotoRecord[],
  rowOf: (r: PhotoRecord) => number,
  colOf: (r: PhotoRecord) => number,
  rows: number,
  cols: number,
): number[][] => {
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0))
  for (const r of records) {
    const row = rowOf(r)
    const col = colOf(r)
    if (row >= 0 && col >= 0 && row < rows && col < cols) grid[row]![col]!++
  }
  return grid
}

export interface StackedSeries {
  years: number[]
  series: { name: string; counts: number[] }[]
  totals: number[]
}

/** Stack per-year counts by category. Rare categories collapse into "Other" when `maxSeries` is set. */
const stackByYear = (
  records: PhotoRecord[],
  keyOf: (r: PhotoRecord) => string | null,
  opts: { order?: string[]; maxSeries?: number } = {},
): StackedSeries => {
  const withYear = records.filter((r) => r.year !== null && keyOf(r) !== null)
  const years = [...new Set(withYear.map((r) => r.year!))].sort((a, b) => a - b)
  if (years.length > 0) {
    // fill gaps so the axis is continuous
    const filled: number[] = []
    for (let y = years[0]!; y <= years.at(-1)!; y++) filled.push(y)
    years.length = 0
    years.push(...filled)
  }

  let names = opts.order ?? countBy(withYear, keyOf).map((c) => c.name)
  let keep = new Set(names)
  if (opts.maxSeries && names.length > opts.maxSeries) {
    names = names.slice(0, opts.maxSeries)
    keep = new Set(names)
  }

  const series = names.map((name) => ({ name, counts: years.map(() => 0) }))
  const other = { name: 'Other', counts: years.map(() => 0) }
  const index = new Map(names.map((n, i) => [n, i]))

  for (const r of withYear) {
    const key = keyOf(r)!
    const yi = years.indexOf(r.year!)
    if (keep.has(key)) series[index.get(key)!]!.counts[yi]!++
    else other.counts[yi]!++
  }
  if (other.counts.some((c) => c > 0)) series.push(other)

  return {
    years,
    series,
    totals: years.map((_, i) => series.reduce((sum, s) => sum + s.counts[i]!, 0)),
  }
}

const mode = (values: (number | null)[]): number | null => {
  const map = new Map<number, number>()
  for (const v of values) if (v !== null) map.set(v, (map.get(v) ?? 0) + 1)
  let best: number | null = null
  let bestCount = 0
  for (const [v, c] of map) {
    if (c > bestCount) {
      best = v
      bestCount = c
    }
  }
  return best
}

/* -------------------------------------------------------------------------- */
/*  Zoom detection                                                            */
/* -------------------------------------------------------------------------- */

const LENS_RANGE_RE = /(\d{1,3})\s*[-–]\s*(\d{1,3})\s*mm/i

const detectZoomLenses = (records: PhotoRecord[]): Set<string> => {
  const focals = new Map<string, Set<number>>()
  for (const r of records) {
    if (!r.lens || r.focalActual === null) continue
    if (!focals.has(r.lens)) focals.set(r.lens, new Set())
    focals.get(r.lens)!.add(r.focalActual)
  }
  const zooms = new Set<string>()
  const lenses = new Set(records.map((r) => r.lens).filter((l): l is string => l !== null))
  for (const lens of lenses) {
    const m = LENS_RANGE_RE.exec(lens)
    if (m && m[1] !== m[2]) {
      zooms.add(lens)
      continue
    }
    const seen = focals.get(lens)
    if (seen && seen.size >= 4) {
      const values = [...seen]
      if (Math.max(...values) >= Math.min(...values) * 1.3) zooms.add(lens)
    }
  }
  return zooms
}

/* -------------------------------------------------------------------------- */
/*  The metrics bundle                                                        */
/* -------------------------------------------------------------------------- */

export interface ZoomDot {
  focal: number
  year: number
  count: number
}

export interface ZoomLensUsage {
  lens: string
  total: number
  min: number
  max: number
  years: number[]
  dots: ZoomDot[]
  maxDot: number
}

export interface PhotoMetrics {
  total: number
  datedTotal: number
  firstYear: number | null
  lastYear: number | null
  cameras: Count[]
  lenses: Count[]
  countries: Count[]

  fun: {
    topCamera: Count | null
    topLens: Count | null
    topCountry: Count | null
    peakHour: number | null
    weekendShare: number | null
    nightShare: number | null
    primeShare: number | null
    comfort: { aperture: number | null; iso: number | null; focal: number | null }
  }

  /** Last five calendar years × 12 months */
  recent: { years: number[]; grid: number[][] }

  hours: number[]
  dayOfWeek: number[]
  monthOfYear: number[]
  apertureByHour: number[][]
  isoByHour: number[][]

  focalBars: Count[]
  apertureBars: Count[]
  isoBars: Count[]
  focalAperture: number[][]
  focalIso: number[][]
  apertureIso: number[][]

  gearBodies: StackedSeries
  gearLenses: StackedSeries
  focalOverTime: StackedSeries
  zoomUsage: ZoomLensUsage[]
}

const bandCounts = (records: PhotoRecord[], valueOf: (r: PhotoRecord) => number | null, bands: Band[]): Count[] => {
  const counts = bands.map((b) => ({ name: b.label, count: 0 }))
  for (const r of records) {
    const i = bandIndex(valueOf(r), bands)
    if (i >= 0) counts[i]!.count++
  }
  return counts
}

export function computeMetrics(photos: PhotoManifestItem[]): PhotoMetrics {
  const records = toRecords(photos)
  const dated = records.filter((r) => r.year !== null)
  const years = dated.map((r) => r.year!)
  const firstYear = years.length ? Math.min(...years) : null
  const lastYear = years.length ? Math.max(...years) : null

  const cameras = countBy(records, (r) => r.camera)
  const lenses = countBy(records, (r) => r.lens)
  const countries = countBy(records, (r) => r.country)

  // fun stats
  const hours = Array.from({ length: 24 }, () => 0)
  for (const r of records) if (r.hour !== null) hours[r.hour]!++
  const hourTotal = hours.reduce((a, b) => a + b, 0)
  const peak = hourTotal ? hours.indexOf(Math.max(...hours)) : null

  const dayOfWeek = Array.from({ length: 7 }, () => 0)
  const monthOfYear = Array.from({ length: 12 }, () => 0)
  for (const r of records) {
    if (r.dow !== null) dayOfWeek[r.dow]!++
    if (r.month !== null) monthOfYear[r.month - 1]!++
  }
  const dowTotal = dayOfWeek.reduce((a, b) => a + b, 0)

  const zoomLenses = detectZoomLenses(records)
  const withLens = records.filter((r) => r.lens !== null)
  const night = hours.reduce((sum, c, h) => (h >= 21 || h < 5 ? sum + c : sum), 0)

  // recent trends: last five calendar years ending at the latest year with photos
  const recentYears = lastYear === null ? [] : Array.from({ length: 5 }, (_, i) => lastYear - 4 + i)
  const recentGrid = recentYears.map(() => Array.from({ length: 12 }, () => 0))
  for (const r of dated) {
    const yi = recentYears.indexOf(r.year!)
    if (yi >= 0 && r.month !== null) recentGrid[yi]![r.month - 1]!++
  }

  // zoom usage
  const zoomUsage: ZoomLensUsage[] = []
  const lensTotals = new Map(lenses.map((l) => [l.name, l.count]))
  const zoomNames = [...zoomLenses]
    .filter((l) => (lensTotals.get(l) ?? 0) >= 8)
    .sort((a, b) => (lensTotals.get(b) ?? 0) - (lensTotals.get(a) ?? 0))
    .slice(0, 4)
  for (const lens of zoomNames) {
    const rs = records.filter((r) => r.lens === lens && r.focalActual !== null && r.year !== null)
    if (rs.length === 0) continue
    const focals = rs.map((r) => r.focalActual!)
    const min = Math.min(...focals)
    const max = Math.max(...focals)
    const width = Math.max(1, Math.round((max - min) / 24))
    const cells = new Map<string, ZoomDot>()
    for (const r of rs) {
      const bin = min + Math.round((r.focalActual! - min) / width) * width
      const key = `${bin}|${r.year}`
      const cell = cells.get(key) ?? { focal: bin, year: r.year!, count: 0 }
      cell.count++
      cells.set(key, cell)
    }
    const dots = [...cells.values()]
    zoomUsage.push({
      lens,
      total: lensTotals.get(lens) ?? rs.length,
      min,
      max,
      years: [...new Set(rs.map((r) => r.year!))].sort((a, b) => a - b),
      dots,
      maxDot: Math.max(...dots.map((d) => d.count)),
    })
  }

  const fAp = (r: PhotoRecord) => bandIndex(r.aperture, APERTURE_BANDS)
  const fIso = (r: PhotoRecord) => bandIndex(r.iso, ISO_BANDS)
  const fFocal = (r: PhotoRecord) => bandIndex(r.focal, FOCAL_BANDS)
  const fHour = (r: PhotoRecord) => r.hour ?? -1

  const modeAperture = mode(records.map((r) => r.aperture))
  const modeIso = mode(records.map((r) => r.iso))
  const modeFocal = mode(records.map((r) => r.focal))

  return {
    total: photos.length,
    datedTotal: dated.length,
    firstYear,
    lastYear,
    cameras,
    lenses,
    countries,

    fun: {
      topCamera: cameras[0] ?? null,
      topLens: lenses[0] ?? null,
      topCountry: countries[0] ?? null,
      peakHour: peak,
      weekendShare: dowTotal ? (dayOfWeek[0]! + dayOfWeek[6]!) / dowTotal : null,
      nightShare: hourTotal ? night / hourTotal : null,
      primeShare: withLens.length ? withLens.filter((r) => !zoomLenses.has(r.lens!)).length / withLens.length : null,
      comfort: { aperture: modeAperture, iso: modeIso, focal: modeFocal },
    },

    recent: { years: recentYears, grid: recentGrid },

    hours,
    dayOfWeek,
    monthOfYear,
    apertureByHour: crossTab(records, fAp, fHour, APERTURE_BANDS.length, 24),
    isoByHour: crossTab(records, fIso, fHour, ISO_BANDS.length, 24),

    focalBars: bandCounts(records, (r) => r.focal, FOCAL_BANDS),
    apertureBars: bandCounts(records, (r) => r.aperture, APERTURE_BANDS),
    isoBars: bandCounts(records, (r) => r.iso, ISO_BANDS),
    focalAperture: crossTab(records, fFocal, fAp, FOCAL_BANDS.length, APERTURE_BANDS.length),
    focalIso: crossTab(records, fFocal, fIso, FOCAL_BANDS.length, ISO_BANDS.length),
    apertureIso: crossTab(records, fAp, fIso, APERTURE_BANDS.length, ISO_BANDS.length),

    gearBodies: stackByYear(records, (r) => r.camera, { maxSeries: 6 }),
    gearLenses: stackByYear(records, (r) => r.lens, { maxSeries: 6 }),
    focalOverTime: stackByYear(
      records,
      (r) => {
        const i = bandIndex(r.focal, FOCAL_BANDS)
        return i >= 0 ? FOCAL_BANDS[i]!.label : null
      },
      { order: FOCAL_BANDS.map((b) => b.label) },
    ),
    zoomUsage,
  }
}

/* -------------------------------------------------------------------------- */
/*  Colour metrics (separate: decoding thumbhashes is the slow part)          */
/* -------------------------------------------------------------------------- */

export interface ColourMetrics {
  families: Count[]
  /** One row per year, 12 months each, listing the family of every photo in that month */
  timeline: { years: number[]; cells: ColourFamily[][][] }
}

export function computeColourMetrics(photos: PhotoManifestItem[]): ColourMetrics {
  const tagged = photos.map((photo) => ({
    date: parseDate(photo.exif?.DateTimeOriginal) ?? parseDate(photo.dateTaken),
    family: dominantFamilyFromThumbHash(photo.thumbHash),
  }))

  const counts = new Map<ColourFamily, number>()
  for (const { family } of tagged) if (family) counts.set(family, (counts.get(family) ?? 0) + 1)
  const families = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

  const years = tagged.flatMap((t) => (t.date ? [t.date.year] : []))
  const first = years.length ? Math.min(...years) : null
  const last = years.length ? Math.max(...years) : null
  const rows: number[] = []
  if (first !== null && last !== null) for (let y = first; y <= last; y++) rows.push(y)

  const cells: ColourFamily[][][] = rows.map(() => Array.from({ length: 12 }, () => []))
  for (const { date, family } of tagged) {
    if (date && family) cells[date.year - first!]![date.month - 1]!.push(family)
  }
  for (const row of cells) {
    for (const cell of row) cell.sort((a, b) => COLOUR_FAMILIES.indexOf(a) - COLOUR_FAMILIES.indexOf(b))
  }

  return { families, timeline: { years: rows, cells } }
}
