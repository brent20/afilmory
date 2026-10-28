import type { Count, PhotoMetrics, PhotoRecord, StackedSeries } from './metrics'
import { countBy, stackByYear } from './metrics'
import { distanceMiles } from './sun'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/** A photo that holds a record, with the value that put it there */
export interface PhotoPick {
  photoId: string
  value: number
}

export interface GearSpan {
  name: string
  /** Name the gallery filter uses (for ?cameras= / ?lenses= links) */
  filter: string | null
  count: number
  firstDay: number
  lastDay: number
}

export interface YearSeries {
  years: number[]
  counts: number[]
}

export interface PlacePick {
  photoId: string
  place: string | null
}

export interface ExtraMetrics {
  perYear: YearSeries

  /** Records for "the most …" tiles. Values are in the units named in each field. */
  extremes: {
    /** mm, as marked on the lens */
    widest: PhotoPick | null
    longest: PhotoPick | null
    /** f-number */
    fastestAperture: PhotoPick | null
    highestIso: PhotoPick | null
    /** seconds */
    longestExposure: PhotoPick | null
    fastestShutter: PhotoPick | null
  }

  shutter: { bands: Count[], coverage: number }

  exposure: {
    programs: Count[]
    /** Average exposure compensation in EV */
    avgComp: number | null
    comp: { under: number, neutral: number, over: number }
    flashShare: number | null
    lowLightShare: number | null
    wideOpenShare: number | null
  }

  framing: { orientation: Count[], aspects: Count[] }

  mood: {
    tones: Count[]
    avgBrightness: number | null
    brightest: PhotoPick | null
    darkest: PhotoPick | null
  }

  /** Photos with GPS and a known timezone, split by where the sun was */
  light: {
    total: number
    golden: number
    blue: number
    day: number
    night: number
    goldenMorning: number
    goldenEvening: number
  }

  travel: {
    geoTagged: number
    topPlaces: Count[]
    placeCount: number
    home: { place: string, lat: number, lon: number } | null
    farthest: (PlacePick & { miles: number }) | null
    highest: (PlacePick & { feet: number }) | null
    northernmost: (PlacePick & { lat: number }) | null
    southernmost: (PlacePick & { lat: number }) | null
    newPlacesPerYear: YearSeries
  }

  habits: {
    activeDays: number
    photosPerActiveDay: number | null
    busiestDay: { day: number, count: number, photoId: string } | null
    streak: { days: number, fromDay: number, toDay: number, photoId: string } | null
    outings: {
      count: number
      avgPhotos: number | null
      longest: { minutes: number, photos: number, day: number, photoId: string } | null
    }
  }

  gear: {
    cameras: GearSpan[]
    lenses: GearSpan[]
    favoriteFocal: { mm: number, kind: 'equivalent' | 'actual', count: number, share: number, photoId: string } | null
    topLens: { name: string, share: number } | null
    primeZoomByYear: StackedSeries
  }

  fun: {
    slideshowSeconds: number
    /** 36-exposure rolls of film */
    rolls: number
    hdrShare: number | null
    videos: number
  }

  tags: { top: Count[], byYear: StackedSeries }
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const share = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null)

const mean = (values: number[]): number | null =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null

const pick = (
  records: PhotoRecord[],
  valueOf: (r: PhotoRecord) => number | null,
  better: (candidate: number, current: number) => boolean,
  plausible: (value: number) => boolean = () => true,
): PhotoPick | null => {
  let best: PhotoPick | null = null
  for (const record of records) {
    const value = valueOf(record)
    if (value === null || !plausible(value)) {
      continue
    }
    if (best === null || better(value, best.value)) {
      best = { photoId: record.id, value }
    }
  }
  return best
}
const maxOf = (candidate: number, current: number) => candidate > current
const minOf = (candidate: number, current: number) => candidate < current

const fillYears = (years: number[]): number[] => {
  if (years.length === 0) {
    return []
  }
  const lo = Math.min(...years)
  const hi = Math.max(...years)
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}

const yearSeries = (yearCounts: Map<number, number>): YearSeries => {
  const years = fillYears([...yearCounts.keys()])
  return { years, counts: years.map(y => yearCounts.get(y) ?? 0) }
}

/** 1/250s, 30s, 2.5s */
export const formatShutter = (seconds: number): string => {
  if (seconds >= 1) {
    return `${Number.parseFloat(seconds.toFixed(1))}s`
  }
  return `1/${Math.round(1 / seconds)}s`
}

/** "35mm · f/1.4 · 1/250s · ISO 400" for whatever is known */
export const settingsLine = (record: PhotoRecord): string =>
  [
    record.focalActual === null ? null : `${record.focalActual}mm`,
    record.aperture === null ? null : `f/${Number.parseFloat(record.aperture.toFixed(1))}`,
    record.shutter === null ? null : formatShutter(record.shutter),
    record.iso === null ? null : `ISO ${record.iso}`,
  ]
    .filter(Boolean)
    .join(' · ')

/* -------------------------------------------------------------------------- */
/*  Shutter speed bands                                                       */
/* -------------------------------------------------------------------------- */

const SHUTTER_BANDS = [
  { label: '1/2000s and faster', max: 1 / 1500 },
  { label: 'Around 1/1000s', max: 1 / 700 },
  { label: 'Around 1/500s', max: 1 / 350 },
  { label: 'Around 1/250s', max: 1 / 180 },
  { label: 'Around 1/125s', max: 1 / 90 },
  { label: 'Around 1/60s', max: 1 / 45 },
  { label: 'Around 1/30s', max: 1 / 22 },
  { label: '1/15s to 1/2s', max: 0.6 },
  { label: 'Slower than 1/2s', max: Infinity },
]

/* -------------------------------------------------------------------------- */
/*  Computation                                                               */
/* -------------------------------------------------------------------------- */

const HOME = { place: 'Omaha, Nebraska', lat: 41.2565, lon: -95.9345 }

const OUTING_GAP_MINUTES = 240
const MAX_GEAR_ROWS = 12

const spans = (records: PhotoRecord[], nameOf: (r: PhotoRecord) => string | null, filterOf: (r: PhotoRecord) => string | null) => {
  const map = new Map<string, GearSpan>()
  for (const r of records) {
    const name = nameOf(r)
    if (name === null) {
      continue
    }
    const span = map.get(name) ?? { name, filter: filterOf(r), count: 0, firstDay: Infinity, lastDay: -Infinity }
    span.count++
    span.filter ??= filterOf(r)
    if (r.day !== null) {
      span.firstDay = Math.min(span.firstDay, r.day)
      span.lastDay = Math.max(span.lastDay, r.day)
    }
    map.set(name, span)
  }
  return Array.from(map.values(), s => (Number.isFinite(s.firstDay) ? s : { ...s, firstDay: 0, lastDay: 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_GEAR_ROWS)
}

export function computeExtras(metrics: PhotoMetrics): ExtraMetrics {
  const records = metrics.records
  const zoomLenses = new Set(metrics.zoomLensNames)

  // photos per year
  const yearCounts = new Map<number, number>()
  for (const r of records) {
    if (r.year !== null) {
      yearCounts.set(r.year, (yearCounts.get(r.year) ?? 0) + 1)
    }
  }

  // shutter
  const withShutter = records.filter(r => r.shutter !== null)
  const shutterBands = SHUTTER_BANDS.map(b => ({ name: b.label, count: 0 }))
  for (const r of withShutter) {
    const i = SHUTTER_BANDS.findIndex(b => r.shutter! <= b.max)
    shutterBands[i]!.count++
  }

  // exposure habits
  const withAperture = records.filter(r => r.aperture !== null)
  const withIso = records.filter(r => r.iso !== null)
  const withFlash = records.filter(r => r.flash !== null)
  const comps = records.flatMap(r => (r.expComp === null ? [] : [r.expComp]))
  const programs = countBy(records, (r) => {
    switch (r.program) {
      case 'manual': {
        return 'Manual'
      }
      case 'aperture': {
        return 'Aperture priority'
      }
      case 'shutter': {
        return 'Shutter priority'
      }
      case 'program': {
        return 'Program auto'
      }
      case 'other': {
        return 'Other modes'
      }
      default: {
        return null
      }
    }
  })

  // framing
  const orientation = countBy(records, r =>
    r.orientation === null ? null : r.orientation[0]!.toUpperCase() + r.orientation.slice(1))
  const aspects = countBy(records, r => r.aspect)

  // mood
  const withTone = records.filter(r => r.tone !== null)
  const toneName: Record<string, string> = {
    'low-key': 'Low-key (dark and moody)',
    'normal': 'Balanced',
    'high-key': 'High-key (bright and airy)',
    'high-contrast': 'High contrast',
  }
  const tones = countBy(withTone, r => toneName[r.tone!] ?? null)
  const brightRecords = records.filter(r => r.brightness !== null)

  // light
  const lit = records.filter(r => r.light !== null)
  const light = {
    total: lit.length,
    golden: lit.filter(r => r.light === 'golden').length,
    blue: lit.filter(r => r.light === 'blue').length,
    day: lit.filter(r => r.light === 'day').length,
    night: lit.filter(r => r.light === 'night').length,
    goldenMorning: lit.filter(r => r.goldenSide === 'morning').length,
    goldenEvening: lit.filter(r => r.goldenSide === 'evening').length,
  }

  // travel
  const located = records.filter(r => r.lat !== null && r.lon !== null)
  const placeRecords = records.filter(r => r.place !== null)
  const placeCounts = countBy(placeRecords, r => r.place)
  const home: ExtraMetrics['travel']['home'] = HOME
  let farthest: ExtraMetrics['travel']['farthest'] = null
  for (const r of located) {
    const miles = distanceMiles(home.lat, home.lon, r.lat!, r.lon!)
    if (miles >= 1 && (farthest === null || miles > farthest.miles)) {
      farthest = { photoId: r.id, place: r.place, miles }
    }
  }
  const highestRecord = pick(records, r => r.altitudeFt, maxOf)
  const northRecord = pick(located, r => r.lat, maxOf)
  const southRecord = pick(located, r => r.lat, minOf)
  const recordById = new Map(records.map(r => [r.id, r]))
  const placeOfPick = (p: PhotoPick | null) => (p ? (recordById.get(p.photoId)?.place ?? null) : null)

  const firstYearOfPlace = new Map<string, number>()
  for (const r of placeRecords) {
    if (r.year !== null) {
      const known = firstYearOfPlace.get(r.place!)
      if (known === undefined || r.year < known) {
        firstYearOfPlace.set(r.place!, r.year)
      }
    }
  }
  const newPlaces = new Map<number, number>()
  for (const year of firstYearOfPlace.values()) {
    newPlaces.set(year, (newPlaces.get(year) ?? 0) + 1)
  }

  // habits
  const perDay = new Map<number, { count: number, photoId: string }>()
  for (const r of records) {
    if (r.day !== null) {
      const entry = perDay.get(r.day)
      if (entry) {
        entry.count++
      }
      else {
        perDay.set(r.day, { count: 1, photoId: r.id })
      }
    }
  }
  let busiest: ExtraMetrics['habits']['busiestDay'] = null
  for (const [day, entry] of perDay) {
    if (busiest === null || entry.count > busiest.count) {
      busiest = { day, count: entry.count, photoId: entry.photoId }
    }
  }
  const days = [...perDay.keys()].sort((a, b) => a - b)
  let streak: ExtraMetrics['habits']['streak'] = null
  let runStart = 0
  for (let i = 0; i < days.length; i++) {
    if (i > 0 && days[i]! !== days[i - 1]! + 1) {
      runStart = i
    }
    const length = i - runStart + 1
    if (length >= 2 && (streak === null || length > streak.days)) {
      streak = { days: length, fromDay: days[runStart]!, toDay: days[i]!, photoId: perDay.get(days[runStart]!)!.photoId }
    }
  }

  const timed = records.filter(r => r.ts !== null).sort((a, b) => a.ts! - b.ts!)
  const outings: PhotoRecord[][] = []
  for (const r of timed) {
    const current = outings.at(-1)
    if (current && r.ts! - current.at(-1)!.ts! <= OUTING_GAP_MINUTES) {
      current.push(r)
    }
    else {
      outings.push([r])
    }
  }
  let longestOuting: ExtraMetrics['habits']['outings']['longest'] = null
  for (const group of outings) {
    const minutes = group.at(-1)!.ts! - group[0]!.ts!
    if (group.length >= 2 && (longestOuting === null || minutes > longestOuting.minutes)) {
      longestOuting = { minutes, photos: group.length, day: group[0]!.day!, photoId: group[0]!.id }
    }
  }

  // gear
  const focalValues = records.filter(r => r.focal !== null).length >= records.filter(r => r.focalActual !== null).length / 2
  const focalKind = focalValues ? 'equivalent' : 'actual'
  const focalOf = (r: PhotoRecord) => (focalValues ? r.focal : r.focalActual)
  const focalCounts = new Map<number, number>()
  for (const r of records) {
    const f = focalOf(r)
    if (f !== null) {
      focalCounts.set(f, (focalCounts.get(f) ?? 0) + 1)
    }
  }
  let favoriteFocal: ExtraMetrics['gear']['favoriteFocal'] = null
  for (const [mm, count] of focalCounts) {
    if (favoriteFocal === null || count > favoriteFocal.count) {
      favoriteFocal = { mm, count, share: 0, photoId: '', kind: focalKind }
    }
  }
  if (favoriteFocal) {
    const total = [...focalCounts.values()].reduce((a, b) => a + b, 0)
    favoriteFocal.share = favoriteFocal.count / total
    favoriteFocal.photoId = records.find(r => focalOf(r) === favoriteFocal!.mm)!.id
  }
  const withLens = records.filter(r => r.lens !== null)
  const topLens = metrics.lenses[0]
  const primeZoomByYear = stackByYear(
    withLens,
    r => (zoomLenses.has(r.lens!) ? 'Zoom' : 'Prime'),
    { order: ['Prime', 'Zoom'] },
  )

  // tags
  const tagCounts = new Map<string, number>()
  for (const r of records) {
    for (const tag of new Set(r.tags)) {
      if (tag.trim()) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      }
    }
  }
  const topTags = Array.from(tagCounts.entries(), ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
  const topFive = topTags.slice(0, 5).map(t => t.name)
  const tagYears = fillYears([...new Set(records.flatMap(r => (r.year === null ? [] : [r.year])))])
  const tagSeries = topFive.map(name => ({
    name,
    counts: tagYears.map(year => records.filter(r => r.year === year && r.tags.includes(name)).length),
  }))

  return {
    perYear: yearSeries(yearCounts),

    extremes: {
      widest: pick(records, r => r.focalActual, minOf, v => v >= 4 && v <= 2000),
      longest: pick(records, r => r.focalActual, maxOf, v => v >= 4 && v <= 2000),
      fastestAperture: pick(records, r => r.aperture, minOf, v => v >= 0.7 && v <= 64),
      highestIso: pick(records, r => r.iso, maxOf, v => v >= 25 && v <= 4_000_000),
      longestExposure: pick(records, r => r.shutter, maxOf, v => v >= 1 / 32_000 && v <= 3600),
      fastestShutter: pick(records, r => r.shutter, minOf, v => v >= 1 / 32_000 && v <= 3600),
    },

    shutter: { bands: shutterBands, coverage: share(withShutter.length, records.length) ?? 0 },

    exposure: {
      programs,
      avgComp: mean(comps),
      comp: {
        under: comps.filter(c => c < -0.2).length,
        neutral: comps.filter(c => c >= -0.2 && c <= 0.2).length,
        over: comps.filter(c => c > 0.2).length,
      },
      flashShare: share(withFlash.filter(r => r.flash).length, withFlash.length),
      lowLightShare: share(withIso.filter(r => r.iso! >= 1600).length, withIso.length),
      wideOpenShare: share(withAperture.filter(r => r.aperture! <= 2.8).length, withAperture.length),
    },

    framing: { orientation, aspects },

    mood: {
      tones,
      avgBrightness: mean(brightRecords.map(r => r.brightness!)),
      brightest: pick(brightRecords, r => r.brightness, maxOf),
      darkest: pick(brightRecords, r => r.brightness, minOf),
    },

    light,

    travel: {
      geoTagged: located.length,
      topPlaces: placeCounts.slice(0, 10),
      placeCount: placeCounts.length,
      home,
      farthest,
      highest: highestRecord
        ? { photoId: highestRecord.photoId, feet: highestRecord.value, place: placeOfPick(highestRecord) }
        : null,
      northernmost: northRecord
        ? { photoId: northRecord.photoId, lat: northRecord.value, place: placeOfPick(northRecord) }
        : null,
      southernmost: southRecord
        ? { photoId: southRecord.photoId, lat: southRecord.value, place: placeOfPick(southRecord) }
        : null,
      newPlacesPerYear: yearSeries(newPlaces),
    },

    habits: {
      activeDays: perDay.size,
      photosPerActiveDay: share(records.filter(r => r.day !== null).length, perDay.size),
      busiestDay: busiest,
      streak,
      outings: {
        count: outings.length,
        avgPhotos: outings.length ? timed.length / outings.length : null,
        longest: longestOuting,
      },
    },

    gear: {
      cameras: spans(records, r => r.camera, r => r.cameraFilter),
      lenses: spans(records, r => r.lens, r => r.lensFilter),
      favoriteFocal,
      topLens: topLens && withLens.length ? { name: topLens.name, share: topLens.count / withLens.length } : null,
      primeZoomByYear,
    },

    fun: {
      slideshowSeconds: records.length * 3,
      rolls: records.length / 36,
      hdrShare: share(records.filter(r => r.hdr).length, records.length),
      videos: records.filter(r => r.video).length,
    },

    tags: {
      top: topTags,
      byYear: { years: tagYears, series: tagSeries, totals: tagYears.map((_, i) => tagSeries.reduce((sum, s) => sum + s.counts[i]!, 0)) },
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Interactive helpers                                                       */
/* -------------------------------------------------------------------------- */

/** One photo per earlier year taken on this month and day, newest year first */
export const photosOnThisDay = (
  records: PhotoRecord[],
  month: number,
  dayOfMonth: number,
  currentYear: number,
  limit = 6,
): { photoId: string, year: number }[] => {
  const byYear = new Map<number, string>()
  for (const r of records) {
    if (r.year !== null && r.year < currentYear && r.month === month && r.dayOfMonth === dayOfMonth && !byYear.has(r.year)) {
      byYear.set(r.year, r.id)
    }
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, limit)
    .map(([year, photoId]) => ({ photoId, year }))
}

export type RollPreset = 'any' | 'wideOpen' | 'highIso' | 'longExposure' | 'tele' | 'golden' | 'night'

export const ROLL_PRESETS: RollPreset[] = ['any', 'wideOpen', 'highIso', 'longExposure', 'tele', 'golden', 'night']

export const rollMatches: Record<RollPreset, (r: PhotoRecord) => boolean> = {
  any: () => true,
  wideOpen: r => r.aperture !== null && r.aperture <= 2,
  highIso: r => r.iso !== null && r.iso >= 3200,
  longExposure: r => r.shutter !== null && r.shutter >= 1,
  tele: r => (r.focal ?? r.focalActual ?? 0) >= 135,
  golden: r => r.light === 'golden',
  night: r => r.light === 'night',
}

/** How many photos each preset can pick from */
export const presetCounts = (records: PhotoRecord[]): Record<RollPreset, number> => {
  const counts = {} as Record<RollPreset, number>
  for (const preset of ROLL_PRESETS) {
    counts[preset] = records.filter(rollMatches[preset]).length
  }
  return counts
}

export const pickRandom = (
  records: PhotoRecord[],
  preset: RollPreset,
  random: () => number = Math.random,
  avoidId?: string,
): PhotoRecord | null => {
  const pool = records.filter(rollMatches[preset])
  if (pool.length === 0) {
    return null
  }
  const candidates = pool.length > 1 && avoidId ? pool.filter(r => r.id !== avoidId) : pool
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]!
}
