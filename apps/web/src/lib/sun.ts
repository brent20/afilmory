/** Sun position and distance helpers used by the metrics page. Pure functions, no dependencies. */

const RAD = Math.PI / 180
const DEG = 180 / Math.PI

export interface SunPosition {
  /** Degrees above the horizon (negative = below) */
  elevation: number
  /** True solar time in minutes after midnight; before 720 the sun is rising */
  solarMinutes: number
}

/** NOAA solar position algorithm (accurate to a fraction of a degree) */
export const sunPosition = (utcMs: number, latitude: number, longitude: number): SunPosition => {
  const jd = utcMs / 86_400_000 + 2_440_587.5
  const t = (jd - 2_451_545) / 36_525

  const meanLong = (280.466_46 + t * (36_000.769_83 + 0.000_303_2 * t)) % 360
  const meanAnomaly = 357.529_11 + t * (35_999.050_29 - 0.000_153_7 * t)
  const eccentricity = 0.016_708_634 - t * (0.000_042_037 + 0.000_000_126_7 * t)
  const center
    = Math.sin(meanAnomaly * RAD) * (1.914_602 - t * (0.004_817 + 0.000_014 * t))
      + Math.sin(2 * meanAnomaly * RAD) * (0.019_993 - 0.000_101 * t)
      + Math.sin(3 * meanAnomaly * RAD) * 0.000_289
  const trueLong = meanLong + center
  const omega = 125.04 - 1934.136 * t
  const apparentLong = trueLong - 0.005_69 - 0.004_78 * Math.sin(omega * RAD)

  const meanObliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.000_59 - t * 0.001_813))) / 60) / 60
  const obliquity = meanObliquity + 0.002_56 * Math.cos(omega * RAD)
  const declination = Math.asin(Math.sin(obliquity * RAD) * Math.sin(apparentLong * RAD))

  const y = Math.tan((obliquity * RAD) / 2) ** 2
  const equationOfTime
    = 4
      * DEG
      * (y * Math.sin(2 * meanLong * RAD)
        - 2 * eccentricity * Math.sin(meanAnomaly * RAD)
        + 4 * eccentricity * y * Math.sin(meanAnomaly * RAD) * Math.cos(2 * meanLong * RAD)
        - 0.5 * y * y * Math.sin(4 * meanLong * RAD)
        - 1.25 * eccentricity * eccentricity * Math.sin(2 * meanAnomaly * RAD))

  const minutesUtc = (((utcMs % 86_400_000) + 86_400_000) % 86_400_000) / 60_000
  const solarMinutes = (((minutesUtc + equationOfTime + 4 * longitude) % 1440) + 1440) % 1440
  let hourAngle = solarMinutes / 4 - 180
  if (hourAngle < -180) {
    hourAngle += 360
  }

  const cosZenith
    = Math.sin(latitude * RAD) * Math.sin(declination)
      + Math.cos(latitude * RAD) * Math.cos(declination) * Math.cos(hourAngle * RAD)
  const elevation = 90 - Math.acos(Math.max(-1, Math.min(1, cosZenith))) * DEG
  return { elevation, solarMinutes }
}

export type LightPhase = 'golden' | 'blue' | 'day' | 'night'

/** Golden hour: sun from 4° below to 6° above the horizon. Blue hour: 8° to 4° below. */
export const lightPhase = (elevation: number): LightPhase => {
  if (elevation >= 6) {
    return 'day'
  }
  if (elevation >= -4) {
    return 'golden'
  }
  if (elevation >= -8) {
    return 'blue'
  }
  return 'night'
}

const EARTH_RADIUS_MILES = 3958.8

export const distanceMiles = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const dLat = (lat2 - lat1) * RAD
  const dLon = (lon2 - lon1) * RAD
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)))
}
