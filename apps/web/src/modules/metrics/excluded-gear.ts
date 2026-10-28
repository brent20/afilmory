import type { PhotoManifestItem } from '@afilmory/typing'

const EXCLUDED_CAMERAS = ['Canon EOS REBEL T3i', 'Canon PowerShot S5 IS']

const EXCLUDED_LENSES = ['EF-S18-55mm f/3.5-5.6 IS II', 'EF-S55-250mm f/4-5.6 IS II']

const normalize = (value: string | undefined): string => (value ?? '').toLowerCase().replaceAll(/[^a-z0-9]/g, '')

const excludedCameras = new Set(EXCLUDED_CAMERAS.map(normalize))
const excludedLenses = new Set(EXCLUDED_LENSES.map(normalize))

const matches = (excluded: Set<string>, ...names: (string | undefined)[]): boolean =>
  names.some(name => name !== undefined && excluded.has(normalize(name)))

export const isExcludedFromMetrics = (photo: PhotoManifestItem): boolean => {
  const exif = photo.exif
  const make = exif?.Make?.trim()
  const model = exif?.Model?.trim()
  const lensMake = exif?.LensMake?.trim()
  const lensModel = exif?.LensModel?.trim()
  return (
    matches(excludedCameras, model, make && model ? `${make} ${model}` : undefined)
    || matches(excludedLenses, lensModel, lensMake && lensModel ? `${lensMake} ${lensModel}` : undefined)
  )
}
