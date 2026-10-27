/**
 * Work out when a photo was taken on the camera's own clock.
 *
 * The manifest stores `DateTimeOriginal` as an ISO string. Depending on how it was extracted it can be
 *  - local wall time with an offset ("2025-03-15T23:15:00.000+09:00"),
 *  - UTC ("2025-03-15T14:15:00.000Z"), or
 *  - local wall time with no zone at all ("2025-03-15T23:15:00").
 * Reading the hour straight off a UTC string would put photos in the wrong part of the day, so a "Z"
 * string is shifted back using the photo's recorded UTC offset or IANA timezone when we have one.
 */

export interface CaptureTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  /** The real instant in time, when the zone is known */
  utcMs: number | null
}

export interface ZoneHints {
  /** EXIF offset such as "+09:00" (OffsetTimeOriginal / OffsetTime) */
  offset?: unknown
  /** IANA name such as "Asia/Tokyo", or "UTC+9" */
  tz?: unknown
}

const ISO_RE = /^(\d{4})[-:](\d{2})[-:](\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i

/** "+09:00" / "-0530" / "Z" → minutes east of UTC */
export const parseOffsetMinutes = (value: unknown): number | null => {
  if (typeof value !== 'string') {
    return null
  }
  const text = value.trim()
  if (/^(?:z|utc|gmt)$/i.test(text)) {
    return 0
  }
  const m = /^(?:utc|gmt)?\s*([+-])(\d{1,2})(?::?(\d{2}))?$/i.exec(text)
  if (!m) {
    return null
  }
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0)
  if (minutes > 14 * 60) {
    return null
  }
  return m[1] === '-' ? -minutes : minutes
}

const formatters = new Map<string, Intl.DateTimeFormat | null>()

const formatterFor = (tz: string): Intl.DateTimeFormat | null => {
  if (formatters.has(tz)) {
    return formatters.get(tz)!
  }
  let formatter: Intl.DateTimeFormat | null = null
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
  }
  catch {
    formatter = null
  }
  formatters.set(tz, formatter)
  return formatter
}

/** Minutes east of UTC for an IANA zone at a given instant */
const zoneOffsetAt = (utcMs: number, tz: string): number | null => {
  const formatter = formatterFor(tz)
  if (!formatter) {
    return null
  }
  const parts: Record<string, number> = {}
  for (const part of formatter.formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') {
      parts[part.type] = Number(part.value)
    }
  }
  const asUtc = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!)
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60_000)
}

/** Offset (minutes east of UTC) for a known instant */
const offsetForInstant = (utcMs: number, hints: ZoneHints): number | null => {
  const fixed = parseOffsetMinutes(hints.offset)
  if (fixed !== null) {
    return fixed
  }
  if (typeof hints.tz !== 'string') {
    return null
  }
  const tz = hints.tz.trim()
  const fixedTz = parseOffsetMinutes(tz)
  if (fixedTz !== null) {
    return fixedTz
  }
  return zoneOffsetAt(utcMs, tz)
}

/** Offset for a wall-clock reading with no zone attached */
const offsetForWallClock = (wallAsUtcMs: number, hints: ZoneHints): number | null => {
  const fixed = parseOffsetMinutes(hints.offset)
  if (fixed !== null) {
    return fixed
  }
  if (typeof hints.tz !== 'string') {
    return null
  }
  const tz = hints.tz.trim()
  const fixedTz = parseOffsetMinutes(tz)
  if (fixedTz !== null) {
    return fixedTz
  }
  const first = zoneOffsetAt(wallAsUtcMs, tz)
  if (first === null) {
    return null
  }
  // one refinement handles the hours around a daylight-saving change
  return zoneOffsetAt(wallAsUtcMs - first * 60_000, tz) ?? first
}

const fromWall = (utcMs: number, offsetMinutes: number): Omit<CaptureTime, 'utcMs'> => {
  const d = new Date(utcMs + offsetMinutes * 60_000)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  }
}

export const resolveCapture = (value: unknown, hints: ZoneHints = {}): CaptureTime | null => {
  if (typeof value !== 'string') {
    return null
  }
  const m = ISO_RE.exec(value.trim())
  if (!m) {
    return null
  }

  const [year, month, day, hour, minute] = [m[1], m[2], m[3], m[4], m[5]].map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ]
  const second = Number(m[6] ?? 0)
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null
  }
  const fieldsAsUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  const suffix = m[7]

  if (suffix && suffix.toUpperCase() !== 'Z') {
    // explicit offset: the fields already are the camera's wall clock
    const offset = parseOffsetMinutes(suffix) ?? 0
    return { year, month, day, hour, minute, utcMs: fieldsAsUtc - offset * 60_000 }
  }

  if (suffix) {
    // UTC: shift to the camera's wall clock if we know where it was
    const offset = offsetForInstant(fieldsAsUtc, hints)
    if (offset === null) {
      return { year, month, day, hour, minute, utcMs: fieldsAsUtc }
    }
    return { ...fromWall(fieldsAsUtc, offset), utcMs: fieldsAsUtc }
  }

  // no zone: it's wall-clock time already
  const offset = offsetForWallClock(fieldsAsUtc, hints)
  return { year, month, day, hour, minute, utcMs: offset === null ? null : fieldsAsUtc - offset * 60_000 }
}
