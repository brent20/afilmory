import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Private share links.
 *
 * Tag photos in Lightroom with a keyword like `share:japan-k7x2q9`.
 * Every photo carrying a `share:` keyword is:
 *   1. REMOVED from the public manifest (so it is not in the gallery, map, search,
 *      filters, RSS, sitemap or the page HTML), and
 *   2. written to apps/web/public/_s/<secret>.json, which the site loads only when
 *      someone opens  https://your-site/?s=<secret>
 *
 * The part after `share:` is the secret. Make it long and random.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DEFAULT_MANIFEST_PATH = path.resolve(__dirname, '../../../packages/data/src/photos-manifest.json')
const DEFAULT_OUT_DIR = path.resolve(__dirname, '../public/_s')

const SHARE_PREFIX = 'share:'
// The secret doubles as a file name and a URL value. Require 8+ characters so it can't be guessed.
const VALID_SLUG = /^[a-z0-9][a-z0-9_-]{7,63}$/

type AnyPhoto = Record<string, any>

const isShareKeyword = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().toLowerCase().startsWith(SHARE_PREFIX)

const toSlug = (keyword: string) => keyword.trim().slice(SHARE_PREFIX.length).trim().toLowerCase()

function buildCameras(photos: AnyPhoto[]) {
  const map = new Map<string, { make: string, model: string, displayName: string }>()
  for (const photo of photos) {
    if (!photo.exif?.Make || !photo.exif?.Model) continue
    const make = String(photo.exif.Make).trim()
    const model = String(photo.exif.Model).trim()
    const displayName = `${make} ${model}`
    if (!map.has(displayName)) map.set(displayName, { make, model, displayName })
  }
  return [...map.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
}

function buildLenses(photos: AnyPhoto[]) {
  const map = new Map<string, { make?: string, model: string, displayName: string }>()
  for (const photo of photos) {
    if (!photo.exif?.LensModel) continue
    const model = String(photo.exif.LensModel).trim()
    const make = photo.exif.LensMake ? String(photo.exif.LensMake).trim() : undefined
    const displayName = make ? `${make} ${model}` : model
    if (!map.has(displayName)) map.set(displayName, { make, model, displayName })
  }
  return [...map.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
}

// Copy of a photo with every `share:` keyword removed, so one share link can never reveal another.
function scrub(photo: AnyPhoto): AnyPhoto {
  const copy: AnyPhoto = { ...photo }
  if (Array.isArray(copy.keywords)) copy.keywords = copy.keywords.filter((k: unknown) => !isShareKeyword(k))
  if (Array.isArray(copy.tags)) copy.tags = copy.tags.filter((t: unknown) => !isShareKeyword(t))
  return copy
}

export function splitShares(options: { manifestPath?: string, outDir?: string } = {}) {
  const manifestPath = options.manifestPath ?? DEFAULT_MANIFEST_PATH
  const outDir = options.outDir ?? DEFAULT_OUT_DIR

  // Always start clean so a share you removed in Lightroom disappears on the next build.
  rmSync(outDir, { recursive: true, force: true })

  if (!existsSync(manifestPath)) {
    console.info('[shares] No manifest found, skipping.')
    return
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  if (!manifest || !Array.isArray(manifest.data)) {
    console.info('[shares] Manifest has no photo list, skipping.')
    return
  }

  const publicPhotos: AnyPhoto[] = []
  const shares = new Map<string, AnyPhoto[]>()
  let hiddenCount = 0

  for (const photo of manifest.data as AnyPhoto[]) {
    const shareKeywords: string[] = Array.isArray(photo.keywords) ? photo.keywords.filter(isShareKeyword) : []

    if (shareKeywords.length === 0) {
      publicPhotos.push(photo)
      continue
    }

    // Any share: keyword means "not public", even if the secret turns out to be invalid below.
    hiddenCount++

    for (const keyword of shareKeywords) {
      const slug = toSlug(keyword)
      if (!VALID_SLUG.test(slug)) {
        console.warn(
          `[shares] "${keyword}" on ${photo.id} is not a valid share secret (use 8-64 letters, numbers, - or _). `
          + 'The photo is hidden from the public site and not shared anywhere.',
        )
        continue
      }
      if (!shares.has(slug)) shares.set(slug, [])
      shares.get(slug)!.push(scrub(photo))
    }
  }

  if (hiddenCount === 0) {
    console.info('[shares] No share: keywords found. Public manifest unchanged.')
    return
  }

  // 1. Public manifest without the private photos.
  writeFileSync(
    manifestPath,
    JSON.stringify({
      ...manifest,
      data: publicPhotos,
      cameras: buildCameras(publicPhotos),
      lenses: buildLenses(publicPhotos),
    }),
  )

  // 2. One JSON per share, in the same shape as the public manifest.
  if (shares.size > 0) mkdirSync(outDir, { recursive: true })
  for (const [slug, photos] of shares) {
    writeFileSync(
      path.join(outDir, `${slug}.json`),
      JSON.stringify({
        ...manifest,
        data: photos,
        cameras: buildCameras(photos),
        lenses: buildLenses(photos),
      }),
    )
    console.info(`[shares] share:${slug.slice(0, 4)}… -> ${photos.length} photo(s)`)
  }

  console.info(
    `[shares] Removed ${hiddenCount} photo(s) from the public gallery. ${publicPhotos.length} remain public.`,
  )
}

// Allow running by hand:  pnpm --filter web exec tsx scripts/split-shares.ts
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  splitShares()
}
