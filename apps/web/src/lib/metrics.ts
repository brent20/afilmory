import type { PhotoManifestItem } from '@afilmory/typing'

export interface PhotoMetrics {
  cameras: { name: string; count: number }[]
  lenses: { name: string; count: number }[]
  apertures: { value: string; count: number }[]
  focalLengths: { value: string; count: number }[]
  isos: { value: string; count: number }[]
  timeOfDay: { label: string; count: number }[]
  timeline: { period: string; count: number }[]
  geoReach: { name: string; count: number }[]
  exposure: {
    avgShutter: string
    minShutter: string
    maxShutter: string
  }
}

export function computePhotoMetrics(photos: PhotoManifestItem[]): PhotoMetrics {
  const cameraCounts: Record<string, number> = {}
  const lensCounts: Record<string, number> = {}
  const apertureCounts: Record<string, number> = {}
  const focalCounts: Record<string, number> = {}
  const isoCounts: Record<string, number> = {}
  const timeCounts: Record<string, number> = {
    'Night (00-06)': 0,
    'Morning (06-12)': 0,
    'Afternoon (12-18)': 0,
    'Evening (18-00)': 0,
  }
  const timelineCounts: Record<string, number> = {}
  const geoCounts: Record<string, number> = {}

  let shutterSpeeds: number[] = []

  photos.forEach(photo => {
    const exif = photo.exif
    if (!exif) return

    // Cameras
    if (exif.Make && exif.Model) {
      const name = `${exif.Make} ${exif.Model}`
      cameraCounts[name] = (cameraCounts[name] || 0) + 1
    }

    // Lenses
    if (exif.LensModel) {
      const name = exif.LensModel
      lensCounts[name] = (lensCounts[name] || 0) + 1
    }

    // Aperture
    if (exif.FNumber) {
      const val = `f/${exif.FNumber}`
      apertureCounts[val] = (apertureCounts[val] || 0) + 1
    }

    // Focal Length
    if (exif.FocalLengthIn35mmFormat) {
      const val = `${exif.FocalLengthIn35mmFormat}mm`
      focalCounts[val] = (focalCounts[val] || 0) + 1
    }

    // ISO
    if (exif.ISO) {
      const val = `ISO ${exif.ISO}`
      isoCounts[val] = (isoCounts[val] || 0) + 1
    }

    // Time of Day
    if (exif.DateTimeOriginal) {
      const date = new Date(exif.DateTimeOriginal)
      const hour = date.getHours()
      if (hour >= 0 && hour < 6) timeCounts['Night (00-06)']++
      else if (hour >= 6 && hour < 12) timeCounts['Morning (06-12)']++
      else if (hour >= 12 && hour < 18) timeCounts['Afternoon (12-18)']++
      else timeCounts['Evening (18-00)']++

      // Timeline
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      timelineCounts[period] = (timelineCounts[period] || 0) + 1
    }

    // Geo
    if (photo.location?.country) {
      const name = photo.location.country
      geoCounts[name] = (geoCounts[name] || 0) + 1
    }

    // Shutter Speed
    if (exif.ExposureTime) {
      const val = typeof exif.ExposureTime === 'string' ? parseFloat(exif.ExposureTime) : exif.ExposureTime
      if (!isNaN(val)) shutterSpeeds.push(val)
    }
  })

  const sortCounts = (obj: Record<string, number>) =>
    Object.entries(obj)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)

  const formatShutter = (val: number) => {
    if (val >= 1) return `${val}s`
    return `1/${Math.round(1 / val)}s`
  }

  const avgShutter = shutterSpeeds.length
    ? formatShutter(shutterSpeeds.reduce((a, b) => a + b, 0) / shutterSpeeds.length)
    : 'N/A'
  const minShutter = shutterSpeeds.length
    ? formatShutter(Math.min(...shutterSpeeds))
    : 'N/A'
  const maxShutter = shutterSpeeds.length
    ? formatShutter(Math.max(...shutterSpeeds))
    : 'N/A'

  return {
    cameras: sortCounts(cameraCounts).map(i => ({ name: i.value, count: i.count })),
    lenses: sortCounts(lensCounts).map(i => ({ name: i.value, count: i.count })),
    apertures: sortCounts(apertureCounts).map(i => ({ value: i.value, count: i.count })),
    focalLengths: sortCounts(focalCounts).map(i => ({ value: i.value, count: i.count })),
    isos: sortCounts(isoCounts).map(i => ({ value: i.value, count: i.count })),
    timeOfDay: Object.entries(timeCounts).map(([label, count]) => ({ label, count })),
    timeline: Object.entries(timelineCounts).map(([period, count]) => ({ period, count })).sort((a, b) => a.period.localeCompare(b.period)),
    geoReach: sortCounts(geoCounts).map(i => ({ name: i.value, count: i.count })),
    exposure: {
      avgShutter,
      minShutter,
      maxShutter,
    }
  }
}
