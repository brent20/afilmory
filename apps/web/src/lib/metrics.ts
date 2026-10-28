import type { PhotoManifestItem, ToneType } from '@afilmory/typing'
import { decompressUint8Array } from '@afilmory/utils'
import { thumbHashToRGBA } from 'thumbhash'

import type { CaptureTime, ZoneHints } from './capture-time'
import { resolveCapture } from './capture-time'
import type { LightPhase } from './sun'
import { lightPhase, sunPosition } from './sun'

/* -------------------------------------------------------------------------- */
/*  Bands                                                                     */
/* -------------------------------------------------------------------------- */

export interface Band {
  /** Full label, e.g. "35–49mm · normal" */
  label: string
  /** Compact label for axes and legends */
  short: string
  /** Inclusive upper bound. */
  max: number
}

/** 35mm-equivalent focal length. */
export const FOCAL_EQUIV_BANDS: Band[] = [
  { label: '<24mm · ultra-wide', short: '<24', max: 23 },
  { label: '24–34mm · wide', short: '24–34', max: 34 },
  { label: '35–49mm · normal', short: '35–49', max: 49 },
  { label: '50–84mm · short tele', short: '50–84', max: 84 },
  { label: '85–134mm · tele', short: '85–134', max: 134 },
  { label: '135mm+ · long tele', short: '135+', max: Infinity },
]

/** Focal length as marked on the lens. */
export const FOCAL_ACTUAL_BANDS: Band[] = [
  { label: '<18mm · ultra-wide', short: '<18mm', max: 17 },
  { label: '18–22mm · wide', short: '18–22', max: 22 },
  { label: '23–34mm · normal', short: '23–34', max: 34 },
  { label: '35–55mm · short tele', short: '35–55', max: 55 },
  { label: '56–99mm · tele', short: '56–99', max: 99 },
  { label: '100mm+ · long tele', short: '100mm+', max: Infinity },
]

export const APERTURE_BANDS: Band[] = [
  { label: 'f/1.8 and faster', short: 'f/1.8', max: 1.9 },
  { label: 'around f/2', short: 'f/2', max: 2.4 },
  { label: 'around f/2.8', short: 'f/2.8', max: 3.4 },
  { label: 'around f/4', short: 'f/4', max: 4.7 },
  { label: 'around f/5.6', short: 'f/5.6', max: 6.7 },
  { label: 'f/8–11', short: 'f/8–11', max: 12 },
  { label: 'f/16+', short: 'f/16+', max: Infinity },
]

export const ISO_BANDS: Band[] = [
  { label: '≤200', short: '≤200', max: 200 },
  { label: '400', short: '400', max: 400 },
  { label: '800', short: '800', max: 800 },
  { label: '1600', short: '1600', max: 1600 },
  { label: '3200', short: '3200', max: 3200 },
  { label: '6400+', short: '6400+', max: Infinity },
]

export const bandIndex = (value: number | null, bands: Band[]): number => {
  if (value === null) {
    return -1
  }
  return bands.findIndex(b => value <= b.max)
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
  'Gray',
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
  Gray: 'hsl(0 0% 56%)',
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
  if (d === 0) {
    return [0, 0, l]
  }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === rn) {
    h = ((gn - bn) / d) % 6
  }
  else if (max === gn) {
    h = (bn - rn) / d + 2
  }
  else { h = (rn - gn) / d + 4 }
  h *= 60
  if (h < 0) {
    h += 360
  }
  return [h, s, l]
}

const classifyPixel = (r: number, g: number, b: number): ColourFamily => {
  const [h, s, l] = rgbToHsl(r, g, b)
  if (l < 0.12) {
    return 'Black'
  }
  if (l > 0.93) {
    return 'White'
  }
  if (s < 0.14) {
    if (l < 0.22) {
      return 'Black'
    }
    if (l > 0.82) {
      return 'White'
    }
    return 'Gray'
  }
  if (h < 15 || h >= 345) {
    return 'Red'
  }
  if (h < 45) {
    return l < 0.4 ? 'Brown' : 'Orange'
  }
  if (h < 70) {
    return l < 0.35 ? 'Brown' : 'Yellow'
  }
  if (h < 165) {
    return 'Green'
  }
  if (h < 200) {
    return 'Teal'
  }
  if (h < 255) {
    return 'Blue'
  }
  if (h < 300) {
    return 'Purple'
  }
  return 'Pink'
}

export interface ThumbAnalysis {
  family: ColourFamily
  /** Average colour, 0–255 */
  r: number
  g: number
  b: number
}

/** Decode a thumbhash once: dominant colour family (most pixels) plus the average colour. */
export const analyseThumbHash = (thumbHash: string | null | undefined): ThumbAnalysis | null => {
  if (!thumbHash) {
    return null
  }
  try {
    const { w, h, rgba } = thumbHashToRGBA(decompressUint8Array(thumbHash))
    const pixels = w * h
    if (pixels === 0) {
      return null
    }
    const counts = new Map<ColourFamily, number>()
    let r = 0
    let g = 0
    let b = 0
    for (let i = 0; i < pixels; i++) {
      const pr = rgba[i * 4]!
      const pg = rgba[i * 4 + 1]!
      const pb = rgba[i * 4 + 2]!
      r += pr
      g += pg
      b += pb
      const family = classifyPixel(pr, pg, pb)
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
    return best ? { family: best, r: r / pixels, g: g / pixels, b: b / pixels } : null
  }
  catch {
    return null
  }
}

/** Dominant colour family of a thumbhash: the family covering the most pixels. */
export const dominantFamilyFromThumbHash = (thumbHash: string | null | undefined): ColourFamily | null =>
  analyseThumbHash(thumbHash)?.family ?? null

/* -------------------------------------------------------------------------- */
/*  Per-photo records                                                         */
/* -------------------------------------------------------------------------- */

export type ExposureProgram = 'manual' | 'aperture' | 'shutter' | 'program' | 'other'

export interface PhotoRecord {
  id: string
  year: number | null
  /** 1–12 */
  month: number | null
  /** 1–31 */
  dayOfMonth: number | null
  /** 0–23, the camera's local clock (never converted to the viewer's timezone) */
  hour: number | null
  /** 0 = Sunday */
  dow: number | null
  /** Calendar day as days since 1970-01-01 (the camera's local date) */
  day: number | null
  /** Local wall-clock minutes since 1970-01-01 00:00, for ordering shots within a day */
  ts: number | null
  /** Display name, e.g. "X-T5" or "FUJIFILM X100V" */
  camera: string | null
  /** Exactly how the gallery filter names this camera (used for ?cameras= links) */
  cameraFilter: string | null
  lens: string | null
  /** Exactly how the gallery filter names this lens (used for ?lenses= links) */
  lensFilter: string | null
  /** 35mm-equivalent focal length (from EXIF, or actual × crop factor when only that is recorded) */
  focal: number | null
  /** Actual focal length as marked on the lens */
  focalActual: number | null
  aperture: number | null
  iso: number | null
  /** Shutter time in seconds */
  shutter: number | null
  /** Exposure compensation in EV */
  expComp: number | null
  flash: boolean | null
  program: ExposureProgram | null
  width: number
  height: number
  orientation: Orientation | null
  /** "3:2", "2:3", "16:9", … */
  aspect: string | null
  tone: ToneType | null
  /** 0–100 */
  brightness: number | null
  contrast: number | null
  country: string | null
  state: string | null
  /** Clean city/town name */
  city: string | null
  /** "Omaha, Nebraska" */
  place: string | null
  lat: number | null
  lon: number | null
  altitudeFt: number | null
  /** Sun phase when the photo was made (needs GPS and a known timezone) */
  light: LightPhase | null
  goldenSide: 'morning' | 'evening' | null
  tags: string[]
  hdr: boolean
  video: boolean
}

export type Orientation = 'landscape' | 'portrait' | 'square'

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== 'string') {
    return null
  }
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

/** "1/250", "0.004", 2 → seconds */
export const parseShutter = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null
  }
  if (typeof value !== 'string') {
    return null
  }
  const text = value.trim().replace(/s$/i, '')
  const fraction = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(text)
  const seconds = fraction ? Number(fraction[1]) / Number(fraction[2]) : Number.parseFloat(text)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

const programOf = (value: unknown): ExposureProgram | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }
  const text = value.toLowerCase()
  if (text.includes('manual')) {
    return 'manual'
  }
  if (text.includes('aperture')) {
    return 'aperture'
  }
  if (text.includes('shutter')) {
    return 'shutter'
  }
  if (text.includes('program')) {
    return 'program'
  }
  return 'other'
}

const flashOf = (value: unknown): boolean | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }
  return /fired/i.test(value) && !/did not fire|not fire|no flash/i.test(value)
}

const ASPECTS = [1, 5 / 4, 4 / 3, 3 / 2, 16 / 9, 2]
const ASPECT_LABELS = ['1:1', '5:4', '4:3', '3:2', '16:9', '2:1']

const aspectOf = (width: number, height: number): { orientation: Orientation | null, aspect: string | null } => {
  if (!(width > 0) || !(height > 0)) {
    return { orientation: null, aspect: null }
  }
  const long = Math.max(width, height) / Math.min(width, height)
  const orientation: Orientation = long < 1.03 ? 'square' : width > height ? 'landscape' : 'portrait'
  const index = ASPECTS.findIndex(a => Math.abs(long - a) / a < 0.03)
  if (index < 0) {
    return { orientation, aspect: 'Other' }
  }
  const label = ASPECT_LABELS[index]!
  return { orientation, aspect: orientation === 'portrait' ? label.split(':').reverse().join(':') : label }
}

const cameraName = (make?: string, model?: string): string | null => {
  const mk = make?.trim()
  const md = model?.trim()
  if (!md) {
    return null
  }
  if (!mk) {
    return md
  }
  return md.toLowerCase().startsWith(mk.split(' ')[0]!.toLowerCase()) ? md : `${mk} ${md}`
}

/** Calendar day number (days since 1970-01-01) */
export const dayNumber = (year: number, month: number, day: number): number =>
  Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)

const UNITED_STATES = /^(?:united states(?: of america)?|usa|us|u\.s\.a?\.?)$/i

const placeOf = (city?: string, state?: string, country?: string): string | null => {
  if (!city) {
    return null
  }
  const isUnitedStates = country !== undefined && UNITED_STATES.test(country.trim())
  const region = state && (isUnitedStates || state !== city) ? state : country
  return region ? `${city}, ${region}` : city
}

const PLAUSIBLE_ALTITUDE_FT = [-1500, 29_500] as const

export const toRecords = (photos: PhotoManifestItem[]): PhotoRecord[] =>
  photos.map((photo) => {
    const exif = photo.exif
    const hints: ZoneHints = { offset: exif?.OffsetTimeOriginal ?? exif?.OffsetTime, tz: exif?.tz }
    const capture: CaptureTime | null
      = resolveCapture(exif?.DateTimeOriginal, hints) ?? resolveCapture(photo.dateTaken, hints)
    const day = capture ? dayNumber(capture.year, capture.month, capture.day) : null

    const actual = parseNumber(exif?.FocalLength)
    const scale = parseNumber(exif?.ScaleFactor35efl)
    const equiv
      = parseNumber(exif?.FocalLengthIn35mmFormat) ?? (actual !== null && scale !== null && scale > 0 ? actual * scale : null)

    const location = photo.location
    const lat = location && Number.isFinite(location.latitude) ? location.latitude : null
    const lon = location && Number.isFinite(location.longitude) ? location.longitude : null
    const hasFix = lat !== null && lon !== null && !(lat === 0 && lon === 0)
    const sun = hasFix && capture?.utcMs != null ? sunPosition(capture.utcMs, lat, lon) : null

    const lensModel = exif?.LensModel?.trim()
    const lensMake = exif?.LensMake?.trim()
    const make = exif?.Make?.trim()
    const model = exif?.Model?.trim()
    const city = location?.cityName?.trim() || location?.city?.trim() || null

    const altitudeMeters = parseNumber(exif?.GPSAltitude)
    const below = typeof exif?.GPSAltitudeRef === 'string' && /below/i.test(exif.GPSAltitudeRef)
    const altitudeFeet = altitudeMeters === null ? null : Math.round(Math.abs(altitudeMeters) * 3.280_84) * (below ? -1 : 1)

    const { orientation, aspect } = aspectOf(photo.width, photo.height)
    const tone = photo.toneAnalysis

    return {
      id: photo.id,
      year: capture?.year ?? null,
      month: capture?.month ?? null,
      dayOfMonth: capture?.day ?? null,
      hour: capture?.hour ?? null,
      dow: day === null ? null : (((day + 4) % 7) + 7) % 7,
      day,
      ts: capture && day !== null ? day * 1440 + capture.hour * 60 + capture.minute : null,
      camera: cameraName(make, model),
      cameraFilter: make && model ? `${make} ${model}` : null,
      lens: lensModel || null,
      lensFilter: lensModel ? (lensMake ? `${lensMake} ${lensModel}` : lensModel) : null,
      focal: equiv === null ? null : Math.round(equiv),
      focalActual: actual === null ? null : Math.round(actual),
      aperture: parseNumber(exif?.FNumber),
      iso: parseNumber(exif?.ISO),
      shutter: parseShutter(exif?.ExposureTime) ?? parseShutter(exif?.ShutterSpeed ?? exif?.ShutterSpeedValue),
      expComp: parseNumber(exif?.ExposureCompensation),
      flash: flashOf(exif?.Flash),
      program: programOf(exif?.ExposureProgram),
      width: photo.width,
      height: photo.height,
      orientation,
      aspect,
      tone: tone?.toneType ?? null,
      brightness: tone ? tone.brightness : null,
      contrast: tone ? tone.contrast : null,
      country: location?.country ?? null,
      state: location?.state?.trim() || null,
      city,
      place: placeOf(city ?? undefined, location?.state, location?.country),
      lat: hasFix ? lat : null,
      lon: hasFix ? lon : null,
      altitudeFt:
        altitudeFeet !== null && altitudeFeet >= PLAUSIBLE_ALTITUDE_FT[0] && altitudeFeet <= PLAUSIBLE_ALTITUDE_FT[1]
          ? altitudeFeet
          : null,
      light: sun ? lightPhase(sun.elevation) : null,
      goldenSide: sun && lightPhase(sun.elevation) === 'golden' ? (sun.solarMinutes < 720 ? 'morning' : 'evening') : null,
      tags: Array.isArray(photo.tags) ? photo.tags : [],
      hdr: photo.isHDR === true,
      video: photo.video !== undefined,
    }
  })

/* -------------------------------------------------------------------------- */
/*  Aggregation helpers                                                       */
/* -------------------------------------------------------------------------- */

const zeros = (length: number): number[] => Array.from<number>({ length }).fill(0)

const emptyFamilies = (): ColourFamily[] => []

export interface Count {
  name: string
  count: number
}

export const countBy = <T>(items: T[], keyOf: (item: T) => string | null): Count[] => {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyOf(item)
    if (key === null) {
      continue
    }
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries(), ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}

export const crossTab = (
  records: PhotoRecord[],
  rowOf: (r: PhotoRecord) => number,
  colOf: (r: PhotoRecord) => number,
  rows: number,
  cols: number,
): number[][] => {
  const grid: number[][] = []
  for (let i = 0; i < rows; i++) {
    grid.push(zeros(cols))
  }
  for (const r of records) {
    const row = rowOf(r)
    const col = colOf(r)
    if (row >= 0 && col >= 0 && row < rows && col < cols) {
      grid[row]![col]!++
    }
  }
  return grid
}

export interface StackedSeries {
  years: number[]
  series: { name: string, counts: number[] }[]
  totals: number[]
}

/** Stack per-year counts by category. Rare categories collapse into "Other" when `maxSeries` is set. */
export const stackByYear = (
  records: PhotoRecord[],
  keyOf: (r: PhotoRecord) => string | null,
  opts: { order?: string[], maxSeries?: number } = {},
): StackedSeries => {
  const withYear = records.filter(r => r.year !== null && keyOf(r) !== null)
  const years = [...new Set(withYear.map(r => r.year!))].sort((a, b) => a - b)
  if (years.length > 0) {
    // fill gaps so the axis is continuous
    const filled: number[] = []
    for (let y = years[0]!; y <= years.at(-1)!; y++) {
      filled.push(y)
    }
    years.length = 0
    years.push(...filled)
  }

  let names = opts.order ?? countBy(withYear, keyOf).map(c => c.name)
  let keep = new Set(names)
  if (opts.maxSeries && names.length > opts.maxSeries) {
    names = names.slice(0, opts.maxSeries)
    keep = new Set(names)
  }

  const series = names.map(name => ({ name, counts: years.map(() => 0) }))
  const other = { name: 'Other', counts: years.map(() => 0) }
  const index = new Map(names.map((n, i) => [n, i]))

  for (const r of withYear) {
    const key = keyOf(r)!
    const yi = years.indexOf(r.year!)
    if (keep.has(key)) {
      series[index.get(key)!]!.counts[yi]!++
    }
    else { other.counts[yi]!++ }
  }
  if (other.counts.some(c => c > 0)) {
    series.push(other)
  }

  return {
    years,
    series,
    totals: years.map((_, i) => series.reduce((sum, s) => sum + s.counts[i]!, 0)),
  }
}

const mode = (values: (number | null)[]): number | null => {
  const map = new Map<number, number>()
  for (const v of values) {
    if (v !== null) {
      map.set(v, (map.get(v) ?? 0) + 1)
    }
  }
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
    if (!r.lens || r.focalActual === null) {
      continue
    }
    if (!focals.has(r.lens)) {
      focals.set(r.lens, new Set())
    }
    focals.get(r.lens)!.add(r.focalActual)
  }
  const zooms = new Set<string>()
  const lenses = new Set(records.map(r => r.lens).filter((l): l is string => l !== null))
  for (const lens of lenses) {
    const m = LENS_RANGE_RE.exec(lens)
    if (m && m[1] !== m[2]) {
      zooms.add(lens)
      continue
    }
    const seen = focals.get(lens)
    if (seen && seen.size >= 4) {
      const values = [...seen]
      if (Math.max(...values) >= Math.min(...values) * 1.3) {
        zooms.add(lens)
      }
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

export interface Silence {
  /** Last day with a photo before the gap (days since epoch) */
  fromDay: number
  /** First day with a photo after the gap */
  toDay: number
  days: number
}

export interface PhotoMetrics {
  /** One lightweight record per photo; reused by the extra stats and the interactive bits */
  records: PhotoRecord[]
  /** Lenses treated as zooms */
  zoomLensNames: string[]
  total: number
  datedTotal: number
  firstYear: number | null
  lastYear: number | null
  cameras: Count[]
  lenses: Count[]
  countries: Count[]
  states: Count[]

  fun: {
    topCamera: Count | null
    topLens: Count | null
    topState: Count | null
    peakHour: number | null
    weekendShare: number | null
    nightShare: number | null
    primeShare: number | null
    comfort: { aperture: number | null, iso: number | null, focal: number | null }
  }

  /** Last five calendar years × 12 months */
  recent: { years: number[], grid: number[][] }

  hours: number[]
  dayOfWeek: number[]
  monthOfYear: number[]
  apertureByHour: number[][]
  isoByHour: number[][]

  /** Share (0–1) of all photos that carry each value */
  coverage: { focal: number, focalActual: number, aperture: number, iso: number }
  focalBars: Count[]
  focalActualBars: Count[]
  apertureBars: Count[]
  isoBars: Count[]

  /**
   * Relationship grids use only photos that have focal length, aperture AND ISO.
   * Rows come first in each name: focalAperture is [aperture][focal], focalIso is [iso][focal],
   * apertureIso is [iso][aperture].
   */
  relationships: { total: number, focalAperture: number[][], focalIso: number[][], apertureIso: number[][] }

  /** Longest stretches with no photograph, longest first */
  silences: Silence[]
  /** First and last photographed day (days since epoch) */
  daySpan: { first: number, last: number } | null

  gearBodies: StackedSeries
  gearLenses: StackedSeries
  focalOverTime: StackedSeries
  zoomUsage: ZoomLensUsage[]
}

const bandCounts = (records: PhotoRecord[], valueOf: (r: PhotoRecord) => number | null, bands: Band[]): Count[] => {
  const counts = bands.map(b => ({ name: b.label, count: 0 }))
  for (const r of records) {
    const i = bandIndex(valueOf(r), bands)
    if (i >= 0) {
      counts[i]!.count++
    }
  }
  return counts
}

const MIN_SILENCE_DAYS = 30
const SILENCES_SHOWN = 5

/** "3.4 years", "2 years", "8 months", "12 days" */
export const formatSilenceLength = (days: number): string => {
  if (days < 60) {
    return `${days} days`
  }
  if (days < 365) {
    return `${Math.round(days / 30.44)} months`
  }
  const years = Math.round((days / 365.25) * 10) / 10
  return `${years} ${years === 1 ? 'year' : 'years'}`
}

/*
 * Date and time formats on the metrics page are always US style, regardless of the
 * visitor's browser locale: "December 15, 2011" and "4 PM".
 */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** "December 15, 2011" from a days-since-epoch value */
export const formatDay = (day: number): string => {
  const date = new Date(day * 86_400_000)
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

/** "March 2025" */
export const formatMonthYear = (year: number, month: number): string => `${MONTH_NAMES[month - 1]} ${year}`

/** "March 2025" from a days-since-epoch value */
export const formatMonthYearFromDay = (day: number): string => {
  const date = new Date(day * 86_400_000)
  return formatMonthYear(date.getUTCFullYear(), date.getUTCMonth() + 1)
}

/** 0–23 → "12 AM", "4 PM" */
export const formatHour = (hour: number): string => `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? 'AM' : 'PM'}`

/** 0–23 → "12a", "4p" (compact axis labels) */
export const formatHourShort = (hour: number): string => `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? 'a' : 'p'}`

export function computeMetrics(photos: PhotoManifestItem[]): PhotoMetrics {
  const records = toRecords(photos)
  const dated = records.filter(r => r.year !== null)
  const years = dated.map(r => r.year!)
  const firstYear = years.length ? Math.min(...years) : null
  const lastYear = years.length ? Math.max(...years) : null

  const cameras = countBy(records, r => r.camera)
  const lenses = countBy(records, r => r.lens)
  const countries = countBy(records, r => r.country)
  const states = countBy(records, r => r.state)

  // fun stats
  const hours = zeros(24)
  for (const r of records) {
    if (r.hour !== null) {
      hours[r.hour]!++
    }
  }
  const hourTotal = hours.reduce((a, b) => a + b, 0)
  const peak = hourTotal ? hours.indexOf(Math.max(...hours)) : null

  const dayOfWeek = zeros(7)
  const monthOfYear = zeros(12)
  for (const r of records) {
    if (r.dow !== null) {
      dayOfWeek[r.dow]!++
    }
    if (r.month !== null) {
      monthOfYear[r.month - 1]!++
    }
  }
  const dowTotal = dayOfWeek.reduce((a, b) => a + b, 0)

  const zoomLenses = detectZoomLenses(records)
  const withLens = records.filter(r => r.lens !== null)
  const night = hours.reduce((sum, c, h) => (h >= 21 || h < 5 ? sum + c : sum), 0)

  // recent trends: last five calendar years ending at the latest year with photos
  const recentYears = lastYear === null ? [] : Array.from({ length: 5 }, (_, i) => lastYear - 4 + i)
  const recentGrid = recentYears.map(() => zeros(12))
  for (const r of dated) {
    const yi = recentYears.indexOf(r.year!)
    if (yi >= 0 && r.month !== null) {
      recentGrid[yi]![r.month - 1]!++
    }
  }

  // zoom usage
  const zoomUsage: ZoomLensUsage[] = []
  const lensTotals = new Map(lenses.map(l => [l.name, l.count]))
  const zoomNames = [...zoomLenses]
    .filter(l => (lensTotals.get(l) ?? 0) >= 8)
    .sort((a, b) => (lensTotals.get(b) ?? 0) - (lensTotals.get(a) ?? 0))
    .slice(0, 4)
  for (const lens of zoomNames) {
    const rs = records.filter(r => r.lens === lens && r.focalActual !== null && r.year !== null)
    if (rs.length === 0) {
      continue
    }
    const focals = rs.map(r => r.focalActual!)
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
      years: [...new Set(rs.map(r => r.year!))].sort((a, b) => a - b),
      dots,
      maxDot: Math.max(...dots.map(d => d.count)),
    })
  }

  const fAp = (r: PhotoRecord) => bandIndex(r.aperture, APERTURE_BANDS)
  const fIso = (r: PhotoRecord) => bandIndex(r.iso, ISO_BANDS)
  const fFocal = (r: PhotoRecord) => bandIndex(r.focal, FOCAL_EQUIV_BANDS)
  const fHour = (r: PhotoRecord) => r.hour ?? -1

  const share = (has: (r: PhotoRecord) => boolean) => (records.length ? records.filter(has).length / records.length : 0)
  const complete = records.filter(r => r.focal !== null && r.aperture !== null && r.iso !== null)

  // longest silences: gaps between consecutive photographed days
  const photoDays = [...new Set(records.flatMap(r => (r.day === null ? [] : [r.day])))].sort((a, b) => a - b)
  const silences: Silence[] = []
  for (let i = 1; i < photoDays.length; i++) {
    const days = photoDays[i]! - photoDays[i - 1]!
    if (days >= MIN_SILENCE_DAYS) {
      silences.push({ fromDay: photoDays[i - 1]!, toDay: photoDays[i]!, days })
    }
  }
  silences.sort((a, b) => b.days - a.days)

  const modeAperture = mode(records.map(r => r.aperture))
  const modeIso = mode(records.map(r => r.iso))
  const modeFocal = mode(records.map(r => r.focal))

  return {
    records,
    zoomLensNames: [...zoomLenses],
    total: photos.length,
    datedTotal: dated.length,
    firstYear,
    lastYear,
    cameras,
    lenses,
    countries,
    states,

    fun: {
      topCamera: cameras[0] ?? null,
      topLens: lenses[0] ?? null,
      topState: states[0] ?? null,
      peakHour: peak,
      weekendShare: dowTotal ? (dayOfWeek[0]! + dayOfWeek[6]!) / dowTotal : null,
      nightShare: hourTotal ? night / hourTotal : null,
      primeShare: withLens.length ? withLens.filter(r => !zoomLenses.has(r.lens!)).length / withLens.length : null,
      comfort: { aperture: modeAperture, iso: modeIso, focal: modeFocal },
    },

    recent: { years: recentYears, grid: recentGrid },

    hours,
    dayOfWeek,
    monthOfYear,
    apertureByHour: crossTab(records, fAp, fHour, APERTURE_BANDS.length, 24),
    isoByHour: crossTab(records, fIso, fHour, ISO_BANDS.length, 24),

    coverage: {
      focal: share(r => r.focal !== null),
      focalActual: share(r => r.focalActual !== null),
      aperture: share(r => r.aperture !== null),
      iso: share(r => r.iso !== null),
    },
    focalBars: bandCounts(records, r => r.focal, FOCAL_EQUIV_BANDS),
    focalActualBars: bandCounts(records, r => r.focalActual, FOCAL_ACTUAL_BANDS),
    apertureBars: bandCounts(records, r => r.aperture, APERTURE_BANDS),
    isoBars: bandCounts(records, r => r.iso, ISO_BANDS),

    relationships: {
      total: complete.length,
      focalAperture: crossTab(complete, fAp, fFocal, APERTURE_BANDS.length, FOCAL_EQUIV_BANDS.length),
      focalIso: crossTab(complete, fIso, fFocal, ISO_BANDS.length, FOCAL_EQUIV_BANDS.length),
      apertureIso: crossTab(complete, fIso, fAp, ISO_BANDS.length, APERTURE_BANDS.length),
    },

    silences: silences.slice(0, SILENCES_SHOWN),
    daySpan: photoDays.length ? { first: photoDays[0]!, last: photoDays.at(-1)! } : null,

    gearBodies: stackByYear(records, r => r.camera, { maxSeries: 6 }),
    gearLenses: stackByYear(records, r => r.lens, { maxSeries: 6 }),
    focalOverTime: stackByYear(
      records,
      (r) => {
        const i = bandIndex(r.focalActual, FOCAL_ACTUAL_BANDS)
        return i >= 0 ? FOCAL_ACTUAL_BANDS[i]!.short : null
      },
      { order: FOCAL_ACTUAL_BANDS.map(b => b.short) },
    ),
    zoomUsage,
  }
}

/* -------------------------------------------------------------------------- */
/*  Colour metrics (separate: decoding thumbhashes is the slow part)          */
/* -------------------------------------------------------------------------- */

export interface WarmthSplit {
  label: string
  warm: number
  neutral: number
  cool: number
  total: number
}

export interface ColourMetrics {
  families: Count[]
  /** One row per year, 12 months each, listing the family of every photo in that month */
  timeline: { years: number[], cells: ColourFamily[][][] }
  /** Average colour of (a sample of) every photo, sorted around the colour wheel, as CSS colours */
  rainbow: string[]
  warmth: { overall: WarmthSplit, bySeason: WarmthSplit[], byDaypart: WarmthSplit[] }
}

const MAX_RAINBOW = 200
const SEASONS = ['Winter', 'Spring', 'Summer', 'Fall'] as const
const DAYPARTS = ['Night (9 PM–5 AM)', 'Morning (5–11 AM)', 'Afternoon (11 AM–5 PM)', 'Evening (5–9 PM)'] as const

/** 0 winter, 1 spring, 2 summer, 3 fall — flipped for the southern hemisphere */
const seasonIndex = (month: number, latitude: number | null): number => {
  const northern = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 0][month - 1]!
  return latitude !== null && latitude < 0 ? (northern + 2) % 4 : northern
}

const daypartIndex = (hour: number): number => {
  if (hour >= 21 || hour < 5) {
    return 0
  }
  if (hour < 11) {
    return 1
  }
  return hour < 17 ? 2 : 3
}

const emptySplit = (label: string): WarmthSplit => ({ label, warm: 0, neutral: 0, cool: 0, total: 0 })

/** Warm = reddish/yellowish average, cool = bluish, with a neutral band between */
const warmthOf = (r: number, b: number): 'warm' | 'neutral' | 'cool' => {
  const score = (r - b) / 255
  return score > 0.08 ? 'warm' : score < -0.08 ? 'cool' : 'neutral'
}

export function computeColourMetrics(photos: PhotoManifestItem[]): ColourMetrics {
  const tagged = photos.map((photo) => {
    const exif = photo.exif
    const hints: ZoneHints = { offset: exif?.OffsetTimeOriginal ?? exif?.OffsetTime, tz: exif?.tz }
    return {
      date: resolveCapture(exif?.DateTimeOriginal, hints) ?? resolveCapture(photo.dateTaken, hints),
      latitude: photo.location && Number.isFinite(photo.location.latitude) ? photo.location.latitude : null,
      analysis: analyseThumbHash(photo.thumbHash),
    }
  })

  const counts = new Map<ColourFamily, number>()
  for (const { analysis } of tagged) {
    if (analysis) {
      counts.set(analysis.family, (counts.get(analysis.family) ?? 0) + 1)
    }
  }
  const families = Array.from(counts.entries(), ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

  const years = tagged.flatMap(t => (t.date ? [t.date.year] : []))
  const first = years.length ? Math.min(...years) : null
  const last = years.length ? Math.max(...years) : null
  const rows: number[] = []
  if (first !== null && last !== null) {
    for (let y = first; y <= last; y++) {
      rows.push(y)
    }
  }

  const cells: ColourFamily[][][] = rows.map(() => Array.from({ length: 12 }, emptyFamilies))
  const overall = emptySplit('All photos')
  const bySeason = SEASONS.map(label => emptySplit(label))
  const byDaypart = DAYPARTS.map(label => emptySplit(label))
  const chromatic: { h: number, s: number, l: number }[] = []
  const neutrals: { h: number, s: number, l: number }[] = []

  for (const { date, latitude, analysis } of tagged) {
    if (!analysis) {
      continue
    }
    if (date) {
      cells[date.year - first!]![date.month - 1]!.push(analysis.family)
    }
    const warmth = warmthOf(analysis.r, analysis.b)
    overall[warmth]++
    overall.total++
    if (date) {
      const season = bySeason[seasonIndex(date.month, latitude)]!
      season[warmth]++
      season.total++
      const daypart = byDaypart[daypartIndex(date.hour)]!
      daypart[warmth]++
      daypart.total++
    }
    const [h, s, l] = rgbToHsl(analysis.r, analysis.g, analysis.b)
    ;(s >= 0.15 && l > 0.1 && l < 0.92 ? chromatic : neutrals).push({ h, s, l })
  }
  for (const row of cells) {
    for (const cell of row) {
      cell.sort((a, b) => COLOUR_FAMILIES.indexOf(a) - COLOUR_FAMILIES.indexOf(b))
    }
  }

  chromatic.sort((a, b) => a.h - b.h)
  neutrals.sort((a, b) => a.l - b.l)
  const ordered = [...chromatic, ...neutrals]
  const step = Math.max(1, ordered.length / MAX_RAINBOW)
  const rainbow: string[] = []
  for (let i = 0; i < ordered.length && rainbow.length < MAX_RAINBOW; i += step) {
    const { h, s, l } = ordered[Math.floor(i)]!
    rainbow.push(`hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`)
  }

  return {
    families,
    timeline: { years: rows, cells },
    rainbow,
    warmth: { overall, bySeason, byDaypart },
  }
}
