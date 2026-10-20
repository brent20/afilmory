import { createHash } from 'node:crypto'

import type { PhotoManifestItem } from '@afilmory/typing'
import sharp from 'sharp'

import type { BuilderPlugin } from './types.js'

const PLUGIN_NAME = 'afilmory:ai-tagging'
const DEFAULT_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct'
const DEFAULT_CACHE_KEY = '.afilmory/ai-tags.json'
// v2: entries are keyed by file path (s3Key) instead of digest, so the JSON is human-readable.
const CACHE_VERSION = 2
// Bump when the prompt changes in a way that should invalidate cached tags.
// v2: "Black & White" is no longer decided by the model (see classifyColor).
const PROMPT_VERSION = 2
// Llama 3.2 Vision splits images into 560px tiles; one tile keeps token usage (and Neurons) low.
const IMAGE_MAX_SIDE = 560
const REQUEST_TIMEOUT_MS = 60_000
const MAX_CONSECUTIVE_FAILURES = 3

export const BLACK_AND_WHITE_TAG = 'Black & White'

const TITLE_MAX_WORDS = 6
const TITLE_MAX_LENGTH = 60
/** Example titles used in the prompt. If the model copies one, it is rejected and retried on a later build. */
const EXAMPLE_TITLES = ['quiet harbor', 'amber hours', 'stillness', 'concrete bloom', 'where the light lands', 'distant weather']
const TITLE_INSTRUCTIONS = [
  'The title must be abstract and evocative: capture the mood, light or feeling of the photo rather than listing what is in it.',
  'Use 1 to 4 words in Title Case, with no quotes and no punctuation. Never include place names, dates, camera terms, or the words Photo, Image, Picture or Untitled.',
  'The style is like these examples (never reuse them): Quiet Harbor, Amber Hours, Stillness, Concrete Bloom, Where the Light Lands.',
]

// Color detection thresholds. Chroma = max(R,G,B) - min(R,G,B) per pixel (0-255).
const COLOR_SAMPLE_SIZE = 96
/** A pixel with at least this much chroma counts as clearly colored. */
const COLORFUL_CHROMA = 40
/** A pixel with at least this much chroma counts as tinted (even slightly). */
const TINTED_CHROMA = 16
/** Black & White only if the image is essentially neutral gray everywhere. */
const MONO_MAX_MEAN_CHROMA = 4
const MONO_MAX_TINTED_SHARE = 0.03
/** Clearly a color photo above either of these. */
const COLOR_MIN_COLORFUL_SHARE = 0.05
const COLOR_MIN_MEAN_CHROMA = 18

export const DEFAULT_AI_TAG_VOCABULARY = [
  'Landscape',
  'Portrait',
  'Street',
  'Architecture',
  'Nature',
  'Wildlife',
  'Birds',
  'Pets',
  'Flowers',
  'Trees',
  'Mountains',
  'Water',
  'Beach',
  'Ocean',
  'Lake',
  'River',
  'Sky',
  'Clouds',
  'Sunset',
  'Sunrise',
  'Night',
  'City',
  'Urban',
  'People',
  'Family',
  'Food',
  'Travel',
  'Cars',
  'Trains',
  'Aircraft',
  'Boats',
  'Bridges',
  'Interior',
  'Abstract',
  'Macro',
  BLACK_AND_WHITE_TAG,
  'Snow',
  'Winter',
  'Autumn',
  'Fog',
  'Sports',
  'Music',
  'Technology',
  'Signs & Text',
]

export interface AiTaggingPluginOptions {
  /** Turn the plugin on. Defaults to false. */
  enable?: boolean
  /** Cloudflare account ID. */
  accountId?: string
  /** Cloudflare API token with the "Workers AI" permission. */
  apiToken?: string
  /** Workers AI vision model. Defaults to Llama 3.2 11B Vision. */
  model?: string
  /** Tags the model may choose from. Defaults to DEFAULT_AI_TAG_VOCABULARY. */
  vocabulary?: string[]
  /** Maximum number of AI tags per photo. Defaults to 5. */
  maxTagsPerPhoto?: number
  /** Maximum number of NEW photos to analyze per build (protects the free tier). Defaults to 400. */
  maxPerRun?: number
  /** Parallel requests. Defaults to 2. */
  concurrency?: number
  /** Storage key for the tag cache JSON file (stored in your bucket). */
  cacheKey?: string
  /** Ignore the cached tags and re-tag every photo (still limited by maxPerRun per build). Titles are kept. */
  forceRetag?: boolean
  /** Also give every photo an AI-written title. Defaults to true. A title set in Lightroom always wins. */
  generateTitles?: boolean
}

interface TagCacheEntry {
  /** Content hash of the photo when it was tagged; if it changes the photo is re-tagged. */
  digest: string
  /** The AI tags for this photo. Safe to edit by hand. */
  tags: string[]
  /** The AI title for this photo. Safe to edit by hand; delete the line to get a new one next build. */
  title?: string
}

/** One photo waiting for the model: it may need tags, a title, or both. */
interface Job {
  item: PhotoManifestItem
  needTags: boolean
  needTitle: boolean
}

interface TagCache {
  version: number
  settingsHash: string
  /** Keyed by the photo's file path in storage, e.g. "2024/IMG_1234.jpg". */
  entries: Record<string, TagCacheEntry>
}

interface ModelResult {
  ok: boolean
  status: number
  text?: string
  error?: string
}

type ImageMode = 'array' | 'base64'
type ColorClass = 'monochrome' | 'color' | 'unclear'

const lower = (value: string) => value.trim().toLowerCase()

function uniqueMerge(...groups: string[][]): string[] {
  const seen = new Set<string>()
  const merged: string[] = []
  for (const group of groups) {
    for (const value of group) {
      const normalized = value.trim()
      const key = normalized.toLowerCase()
      if (!normalized || seen.has(key)) continue
      seen.add(key)
      merged.push(normalized)
    }
  }
  return merged
}

export function buildPrompt(vocabulary: string[], maxTags: number): string {
  return [
    'You are tagging photos for a photography portfolio.',
    `Choose between 1 and ${maxTags} tags that best describe this photo, using ONLY words from this list:`,
    vocabulary.join(', '),
    'Only choose a tag if its subject is clearly visible in the photo. Fewer accurate tags are better than many guesses.',
    'Reply with only a JSON array of strings, for example ["Landscape","Mountains"]. Do not add any other text.',
  ].join('\n')
}

/** Prompt used when a photo needs both tags and a title. */
export function buildCombinedPrompt(vocabulary: string[], maxTags: number): string {
  return [
    'You are tagging and titling photos for a photography portfolio.',
    `First choose between 1 and ${maxTags} tags that best describe this photo, using ONLY words from this list:`,
    vocabulary.join(', '),
    'Only choose a tag if its subject is clearly visible in the photo. Fewer accurate tags are better than many guesses.',
    'Then give the photo a title.',
    ...TITLE_INSTRUCTIONS,
    'Reply with only a JSON object, for example {"tags":["Landscape","Mountains"],"title":"Distant Weather"}. Do not add any other text.',
  ].join('\n')
}

/** Prompt used when a photo already has tags and only needs a title. */
export function buildTitlePrompt(): string {
  return [
    'You are titling a photo for a photography portfolio.',
    ...TITLE_INSTRUCTIONS,
    'Reply with only a JSON object, for example {"title":"Distant Weather"}. Do not add any other text.',
  ].join('\n')
}

/** Tidy up a title from the model; returns null if it is unusable (too long, generic, or a copied example). */
export function cleanTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const title = raw
    .replaceAll(/["“”`]/g, '')
    .replaceAll(/^['‘’]+|['‘’]+$/g, '')
    .replaceAll(/[.!?,:;]+$/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
  if (!title || title.length > TITLE_MAX_LENGTH) return null
  if (title.split(' ').length > TITLE_MAX_WORDS) return null
  if (/^(?:untitled|photo|image|picture)$/i.test(title)) return null
  if (EXAMPLE_TITLES.includes(title.toLowerCase())) return null
  return title
}

/** Read a reply to the combined prompt: tags drawn from the vocabulary plus a cleaned title. */
export function parseCombinedReply(
  raw: string,
  vocabulary: string[],
  maxTags: number,
): { tags: string[]; title: string | null } {
  const objectMatch = raw.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[0]) as { tags?: unknown; title?: unknown }
      const tags = Array.isArray(parsed.tags) ? parseTags(JSON.stringify(parsed.tags), vocabulary, maxTags) : []
      return { tags, title: cleanTitle(parsed.title) }
    } catch {
      // fall through to loose parsing
    }
  }
  const titleMatch = raw.match(/"title"\s*:\s*"([^"]+)"/i)
  return {
    tags: parseTags(raw.replace(/"title"\s*:\s*"[^"]*"/i, ''), vocabulary, maxTags),
    title: cleanTitle(titleMatch?.[1]),
  }
}

/** Read a reply to the title-only prompt. */
export function parseTitleReply(raw: string): string | null {
  const objectMatch = raw.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    try {
      return cleanTitle((JSON.parse(objectMatch[0]) as { title?: unknown }).title)
    } catch {
      // fall through to loose parsing
    }
  }
  const titleMatch = raw.match(/"title"\s*:\s*"([^"]+)"/i)
  if (titleMatch) return cleanTitle(titleMatch[1])
  return cleanTitle(raw.split('\n')[0])
}

function toRoman(value: number): string {
  const numerals: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let rest = value
  let out = ''
  for (const [size, symbol] of numerals) {
    while (rest >= size) {
      out += symbol
      rest -= size
    }
  }
  return out
}

/** Make a title unique across the site: a repeat becomes "Quiet Harbor II", "Quiet Harbor III", ... */
export function uniqueTitle(title: string, used: Set<string>): string {
  if (!used.has(lower(title))) return title
  for (let n = 2; n < 100; n++) {
    const candidate = `${title} ${toRoman(n)}`
    if (!used.has(lower(candidate))) return candidate
  }
  return `${title} ${used.size + 1}`
}

/** The title set in Lightroom (XMP Title / IPTC Title), if any. It always wins over an AI title. */
function embeddedTitle(item: PhotoManifestItem): string {
  const title = item.exif?.Title
  if (typeof title === 'string' && title.trim()) return title.trim()
  const objectName = item.exif?.ObjectName
  return typeof objectName === 'string' ? objectName.trim() : ''
}

/** Turn the model's free-text reply into a list of tags drawn from the vocabulary. */
export function parseTags(raw: string, vocabulary: string[], maxTags: number): string[] {
  const canonical = new Map(vocabulary.map((tag) => [tag.toLowerCase(), tag]))
  let candidates: string[] = []

  const arrayMatch = raw.match(/\[[\s\S]*?\]/)
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0])
      if (Array.isArray(parsed)) {
        candidates = parsed.filter((v): v is string => typeof v === 'string')
      }
    } catch {
      // fall through to loose parsing
    }
  }

  if (candidates.length === 0) {
    candidates = raw
      .split(/[,\n]/)
      .map((part) => part.replaceAll(/^[\s"'\-*\d.]+|[\s"'.]+$/g, ''))
      .filter(Boolean)
  }

  const result: string[] = []
  for (const candidate of candidates) {
    const match = canonical.get(candidate.trim().toLowerCase())
    if (match && !result.includes(match)) {
      result.push(match)
    }
    if (result.length >= maxTags) break
  }
  return result
}

/**
 * Decide from the actual pixels whether a photo is black & white. Vision models are unreliable at
 * this, so the model is never asked: a photo is only tagged when it is essentially neutral gray.
 */
export async function classifyColor(
  image: Buffer,
): Promise<{ kind: ColorClass; meanChroma: number; colorfulShare: number; tintedShare: number }> {
  const { data, info } = await sharp(image, { failOn: 'none' })
    .resize(COLOR_SAMPLE_SIZE, COLOR_SAMPLE_SIZE, { fit: 'inside' })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true })

  const channels = info.channels
  const pixels = Math.floor(data.length / channels)
  let chromaSum = 0
  let colorful = 0
  let tinted = 0
  for (let i = 0; i < pixels; i++) {
    const offset = i * channels
    const r = data[offset]
    const g = data[offset + 1]
    const b = data[offset + 2]
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    chromaSum += chroma
    if (chroma >= COLORFUL_CHROMA) colorful++
    if (chroma >= TINTED_CHROMA) tinted++
  }

  const meanChroma = pixels ? chromaSum / pixels : 0
  const colorfulShare = pixels ? colorful / pixels : 0
  const tintedShare = pixels ? tinted / pixels : 0

  let kind: ColorClass = 'unclear'
  if (meanChroma <= MONO_MAX_MEAN_CHROMA && tintedShare <= MONO_MAX_TINTED_SHARE) {
    kind = 'monochrome'
  } else if (colorfulShare >= COLOR_MIN_COLORFUL_SHARE || meanChroma >= COLOR_MIN_MEAN_CHROMA) {
    kind = 'color'
  }
  return { kind, meanChroma, colorfulShare, tintedShare }
}

async function callModel(
  options: { accountId: string; apiToken: string; model: string },
  body: Record<string, unknown>,
): Promise<ModelResult> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/ai/run/${options.model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    )

    const json = (await response.json().catch(() => null)) as {
      success?: boolean
      result?: { response?: unknown } | null
      errors?: unknown
    } | null

    if (!response.ok || json?.success === false) {
      return {
        ok: false,
        status: response.status,
        error: JSON.stringify(json?.errors ?? json ?? 'no response body').slice(0, 400),
      }
    }

    const reply = json?.result?.response
    const text = typeof reply === 'string' ? reply : reply === undefined ? '' : JSON.stringify(reply)
    return { ok: true, status: response.status, text }
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) }
  }
}

function isQuotaError(result: ModelResult): boolean {
  if (result.status === 429) return true
  return /allocation|neurons|quota|rate limit/i.test(result.error ?? '')
}

/** Directory names in the photo's path; these become tags elsewhere in the pipeline and are not ours. */
function pathTagSet(item: PhotoManifestItem): Set<string> {
  const parts = item.s3Key.split('/')
  parts.pop()
  return new Set(parts.map(lower).filter(Boolean))
}

export default function aiTaggingPlugin(options: AiTaggingPluginOptions = {}): BuilderPlugin {
  const vocabulary = (options.vocabulary?.length ? options.vocabulary : DEFAULT_AI_TAG_VOCABULARY)
    .map((tag) => tag.trim())
    .filter(Boolean)
  // The model never chooses "Black & White"; classifyColor does.
  const modelVocabulary = vocabulary.filter((tag) => lower(tag) !== lower(BLACK_AND_WHITE_TAG))
  const detectBlackAndWhite = modelVocabulary.length !== vocabulary.length
  const aiOwned = new Set(vocabulary.map(lower))
  const model = options.model || DEFAULT_MODEL
  const maxTags = Math.max(1, Math.round(options.maxTagsPerPhoto ?? 5))
  const maxPerRun = Math.max(0, Math.round(options.maxPerRun ?? 400))
  const concurrency = Math.max(1, Math.round(options.concurrency ?? 2))
  const cacheKey = options.cacheKey || DEFAULT_CACHE_KEY
  const generateTitles = options.generateTitles !== false
  const settingsHash = createHash('sha1')
    .update(JSON.stringify({ model, vocabulary, promptVersion: PROMPT_VERSION }))
    .digest('hex')
    .slice(0, 12)

  /**
   * Set the photo's AI tags. Unchanged photos are carried over from the previous manifest with their old
   * tags, so tags we own (from the vocabulary) that are no longer wanted are removed first. Tags that
   * come from the photo's folder path are left alone.
   */
  const applyTags = (item: PhotoManifestItem, aiTags: string[]) => {
    const wanted = new Set(aiTags.map(lower))
    const fromPath = pathTagSet(item)
    const kept = (item.tags ?? []).filter((tag) => {
      const key = lower(tag)
      return !aiOwned.has(key) || wanted.has(key) || fromPath.has(key)
    })
    item.tags = uniqueMerge(kept, aiTags)
  }

  /** Use the AI title unless the photo has a title from Lightroom, which always wins. */
  const applyTitle = (item: PhotoManifestItem, title: string | undefined) => {
    const fromLightroom = embeddedTitle(item)
    if (fromLightroom) {
      item.title = fromLightroom
    } else if (generateTitles && title) {
      item.title = title
    }
  }

  return {
    name: PLUGIN_NAME,
    hooks: {
      afterProcessTasks: async ({ builder, payload, logger }) => {
        if (!options.enable) return

        const log = logger.main.withTag('AI-TAGS')
        if (!options.accountId || !options.apiToken) {
          log.warn('AI tagging is enabled but the account ID or API token is missing, skipping')
          return
        }
        const credentials = { accountId: options.accountId, apiToken: options.apiToken, model }

        try {
          const storage = builder.getStorageManager()
          const items = payload.manifest.filter(Boolean) as PhotoManifestItem[]

          // 1. Load the tag cache from storage (so builds don't re-analyze every photo).
          let cache: TagCache = { version: CACHE_VERSION, settingsHash, entries: {} }
          try {
            const buffer = await storage.getFile(cacheKey)
            if (buffer) {
              const parsed = JSON.parse(buffer.toString('utf8')) as TagCache
              if (parsed?.version === CACHE_VERSION && parsed.settingsHash === settingsHash && parsed.entries) {
                cache = parsed
              } else {
                log.info('Tag cache was created with different settings or an older format, re-tagging all photos')
              }
            }
          } catch (error) {
            log.warn(`Could not read tag cache, starting fresh: ${String(error)}`)
          }
          // Titles survive a forced re-tag: an accepted title should not change because tags are redone.
          const previousTitles = new Map<string, string>()
          for (const [key, entry] of Object.entries(cache.entries)) {
            if (entry.title) previousTitles.set(key, entry.title)
          }
          if (options.forceRetag) {
            log.info('Re-tag requested: ignoring cached tags')
            cache = { version: CACHE_VERSION, settingsHash, entries: {} }
          }

          // Every title already in use (AI titles and Lightroom titles) so new ones can be made unique.
          const usedTitles = new Set<string>()
          for (const title of previousTitles.values()) usedTitles.add(lower(title))
          for (const entry of Object.values(cache.entries)) {
            if (entry.title) usedTitles.add(lower(entry.title))
          }
          for (const item of items) {
            const fromLightroom = embeddedTitle(item)
            if (fromLightroom) usedTitles.add(lower(fromLightroom))
          }

          // 2. Apply cached tags and titles; queue photos that still need analysis.
          const pending: Job[] = []
          let applied = 0
          for (const item of items) {
            const entry = cache.entries[item.s3Key]
            const entryDigest = entry?.digest
            const itemDigest = item.digest || item.id
            const hasLightroomTitle = Boolean(embeddedTitle(item))
            const knownTitle = entry?.title ?? previousTitles.get(item.s3Key)
            if (entry && Array.isArray(entry.tags) && (!entryDigest || entryDigest === itemDigest)) {
              applyTags(item, entry.tags)
              applyTitle(item, entry.title)
              applied++
              if (generateTitles && !entry.title && !hasLightroomTitle) {
                pending.push({ item, needTags: false, needTitle: true })
              }
            } else {
              // A replaced photo keeps the title it already had.
              applyTitle(item, knownTitle)
              // Waiting for (re-)tagging: drop a possibly wrong "Black & White" tag right away.
              if (detectBlackAndWhite && !pathTagSet(item).has(lower(BLACK_AND_WHITE_TAG))) {
                item.tags = (item.tags ?? []).filter((tag) => lower(tag) !== lower(BLACK_AND_WHITE_TAG))
              }
              pending.push({
                item,
                needTags: true,
                needTitle: generateTitles && !knownTitle && !hasLightroomTitle,
              })
            }
          }

          const batch = pending.slice(0, maxPerRun)
          log.info(
            `${applied} photos done from cache, ${pending.length} need tags or a title (analyzing ${batch.length} this build)`,
          )
          if (batch.length === 0) return

          // 3. Analyze new photos.
          const tagPrompt = buildPrompt(modelVocabulary, maxTags)
          const combinedPrompt = buildCombinedPrompt(modelVocabulary, maxTags)
          const titlePrompt = buildTitlePrompt()
          let imageMode: ImageMode = 'array'
          let licensePromise: Promise<ModelResult> | null = null
          let stop = false
          let consecutiveFailures = 0
          let tagged = 0
          let titled = 0
          let done = 0
          let cursor = 0

          const analyze = async ({ item, needTags, needTitle }: Job): Promise<void> => {
            const source = await storage.getFile(item.s3Key)
            if (!source) {
              log.warn(`Could not download ${item.s3Key}, skipping`)
              return
            }

            let jpeg: Buffer
            try {
              jpeg = await sharp(source, { failOn: 'none' })
                .rotate()
                .resize(IMAGE_MAX_SIDE, IMAGE_MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toBuffer()
            } catch (error) {
              log.warn(`Could not decode ${item.s3Key}, skipping: ${String(error)}`)
              return
            }

            // Black & White is decided from the pixels, not by the model.
            let monochrome = false
            if (needTags && detectBlackAndWhite) {
              try {
                const color = await classifyColor(jpeg)
                monochrome = color.kind === 'monochrome'
                if (monochrome) {
                  log.info(
                    `Black & White: ${item.s3Key} (mean chroma ${color.meanChroma.toFixed(1)}, tinted ${(color.tintedShare * 100).toFixed(1)}%)`,
                  )
                }
              } catch (error) {
                log.warn(`Color check failed for ${item.s3Key}, not tagging Black & White: ${String(error)}`)
              }
            }

            // Meta's Llama license must be accepted once per account before first use.
            // All workers wait on the same request so none runs before it finishes.
            licensePromise ??= callModel(credentials, { prompt: 'agree' })
            await licensePromise

            // Tags and title together, tags only, or title only (for photos whose tags are already cached).
            const prompt = needTags ? (needTitle ? combinedPrompt : tagPrompt) : titlePrompt
            const maxTokens = needTags ? (needTitle ? 100 : 60) : 40
            // A little more variety for titles; tags stay conservative.
            const temperature = needTitle ? (needTags ? 0.5 : 0.7) : 0.2

            const buildBody = (mode: ImageMode) => ({
              prompt,
              image: mode === 'array' ? [...jpeg] : jpeg.toString('base64'),
              max_tokens: maxTokens,
              temperature,
            })

            let result = await callModel(credentials, buildBody(imageMode))
            if (!result.ok && result.status === 400) {
              const fallback: ImageMode = imageMode === 'array' ? 'base64' : 'array'
              const retry = await callModel(credentials, buildBody(fallback))
              if (retry.ok) {
                imageMode = fallback
                result = retry
              }
            }

            if (!result.ok) {
              if (isQuotaError(result)) {
                log.warn('Workers AI daily free allocation reached; remaining photos will be tagged on a later build')
                stop = true
                return
              }
              consecutiveFailures++
              log.warn(`Workers AI request failed for ${item.s3Key} (status ${result.status}): ${result.error}`)
              if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                log.error('Too many consecutive Workers AI failures, stopping AI tagging for this build')
                stop = true
              }
              return
            }

            consecutiveFailures = 0
            const reply = result.text ?? ''
            let aiTags: string[] | null = null
            let aiTitle: string | null = null
            if (needTags && needTitle) {
              const parsed = parseCombinedReply(reply, modelVocabulary, maxTags)
              aiTags = parsed.tags
              aiTitle = parsed.title
            } else if (needTags) {
              aiTags = parseTags(reply, modelVocabulary, maxTags)
            } else {
              aiTitle = parseTitleReply(reply)
            }

            if (needTags) {
              const withColor = monochrome ? uniqueMerge([BLACK_AND_WHITE_TAG], aiTags ?? []) : (aiTags ?? [])
              if (withColor.length === 0) {
                log.warn(`No usable tags returned for ${item.s3Key}: ${reply.slice(0, 120)}`)
                return
              }
              aiTags = withColor
            }
            if (needTitle && !aiTitle) {
              log.warn(`No usable title returned for ${item.s3Key}, will try again next build: ${reply.slice(0, 120)}`)
            }
            if (!needTags && !aiTitle) return

            const existing = cache.entries[item.s3Key]
            let finalTitle = existing?.title ?? previousTitles.get(item.s3Key)
            if (aiTitle) {
              finalTitle = uniqueTitle(aiTitle, usedTitles)
              usedTitles.add(lower(finalTitle))
            }

            cache.entries[item.s3Key] = {
              digest: needTags ? item.digest || item.id : existing?.digest || item.digest || item.id,
              tags: aiTags ?? existing?.tags ?? [],
              ...(finalTitle ? { title: finalTitle } : {}),
            }
            if (aiTags) {
              applyTags(item, aiTags)
              tagged++
            }
            applyTitle(item, finalTitle)
            if (aiTitle) titled++
            done++
          }

          const workers = Array.from({ length: Math.min(concurrency, batch.length) }, async () => {
            while (!stop && cursor < batch.length) {
              const job = batch[cursor++]
              try {
                await analyze(job)
              } catch (error) {
                log.warn(`Unexpected error tagging ${job.item.s3Key}: ${String(error)}`)
              }
            }
          })
          await Promise.all(workers)

          // 4. Persist the cache so the next build only handles new photos. Pretty-printed and sorted by
          //    file path so it is easy to find a photo and edit its tags or title by hand.
          if (done > 0) {
            try {
              const sortedEntries = Object.fromEntries(
                Object.entries(cache.entries).sort(([a], [b]) => a.localeCompare(b)),
              )
              const output: TagCache = { ...cache, entries: sortedEntries }
              await storage.uploadFile(cacheKey, Buffer.from(JSON.stringify(output, null, 2)), {
                contentType: 'application/json',
              })
            } catch (error) {
              log.warn(`Could not save tag cache (photos will be re-tagged next build): ${String(error)}`)
            }
          }

          log.info(
            `AI tagging finished: ${tagged} photos tagged, ${titled} titled, ${pending.length - done} still waiting`,
          )
        } catch (error) {
          // Tagging is a nice-to-have: never fail the site build because of it.
          log.error(`AI tagging failed, continuing without it: ${String(error)}`)
        }
      },
    },
  }
}
