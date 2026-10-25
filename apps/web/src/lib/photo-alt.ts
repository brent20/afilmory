/**
 * Alt text for a photograph.
 *
 * Titles that are just camera filenames (DSC01234, IMG_0042.jpg) are useless to a screen
 * reader and to image search, so in that case this falls back to the photo's description,
 * then to a short sentence built from where it was taken and its tags.
 *
 * The same naming rules are used when the site is pre-rendered for search engines
 * (see apps/web/plugins/vite/seo.ts), so visitors and crawlers get consistent wording.
 */

interface AltSource {
  title?: string | null
  description?: string | null
  tags?: string[] | null
  location?: {
    cityName?: string
    city?: string
    locationName?: string
  } | null
}

const FILE_EXTENSION = /\.(?:jpe?g|png|heic|heif|webp|tiff?|dng|arw|raw)$/i
const CAMERA_FILENAME = /^[a-z]{0,6}[_-]?\d{3,}(?:[_-]\w+)*$/i
const MAX_LENGTH = 125

const isFilenameLike = (title: string) => !title || FILE_EXTENSION.test(title) || CAMERA_FILENAME.test(title)

const clip = (value: string) => {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length <= MAX_LENGTH ? text : `${text.slice(0, MAX_LENGTH - 1).trimEnd()}…`
}

export function photoAltText(photo: AltSource): string {
  const title = (photo.title ?? '').trim()
  if (!isFilenameLike(title)) return clip(title)

  const description = (photo.description ?? '').trim()
  if (description) return clip(description)

  const place = photo.location?.cityName || photo.location?.city || photo.location?.locationName || ''
  const tags = (photo.tags ?? []).slice(0, 3).join(', ')

  if (place && tags) return clip(`Photograph in ${place}: ${tags}`)
  if (place) return `Photograph in ${place}`
  if (tags) return clip(`Photograph: ${tags}`)
  return 'Photograph'
}
