import { createHash } from 'node:crypto'

import type { PhotoManifestItem } from '@afilmory/typing'
import sharp from 'sharp'

import type { BuilderPlugin } from './types.js'

const PLUGIN_NAME = 'afilmory:ai-tagging'
const DEFAULT_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct'
const DEFAULT_CACHE_KEY = '.afilmory/ai-tags.json'
const CACHE_VERSION = 1
// Bump when the prompt changes in a way that should invalidate cached tags.
const PROMPT_VERSION = 1
// Llama 3.2 Vision splits images into 560px tiles; one tile keeps token usage (and Neurons) low.
const IMAGE_MAX_SIDE = 560
const REQUEST_TIMEOUT_MS = 60_000
const MAX_CONSECUTIVE_FAILURES = 3

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
  'Black & White',
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
}

interface TagCache {
  version: number
  settingsHash: string
  entries: Record<string, string[]>
}

interface ModelResult {
  ok: boolean
  status: number
  text?: string
  error?: string
}

type ImageMode = 'array' | 'base64'

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
    'Reply with only a JSON array of strings, for example ["Landscape","Mountains"]. Do not add any other text.',
  ].join('\n')
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

export default function aiTaggingPlugin(options: AiTaggingPluginOptions = {}): BuilderPlugin {
  const vocabulary = (options.vocabulary?.length ? options.vocabulary : DEFAULT_AI_TAG_VOCABULARY)
    .map((tag) => tag.trim())
    .filter(Boolean)
  const model = options.model || DEFAULT_MODEL
  const maxTags = Math.max(1, Math.round(options.maxTagsPerPhoto ?? 5))
  const maxPerRun = Math.max(0, Math.round(options.maxPerRun ?? 400))
  const concurrency = Math.max(1, Math.round(options.concurrency ?? 2))
  const cacheKey = options.cacheKey || DEFAULT_CACHE_KEY
  const settingsHash = createHash('sha1')
    .update(JSON.stringify({ model, vocabulary, promptVersion: PROMPT_VERSION }))
    .digest('hex')
    .slice(0, 12)

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
                log.info('Tag cache was created with different settings, starting fresh')
              }
            }
          } catch (error) {
            log.warn(`Could not read tag cache, starting fresh: ${String(error)}`)
          }

          // 2. Apply cached tags; queue photos that still need analysis.
          const pending: PhotoManifestItem[] = []
          let applied = 0
          for (const item of items) {
            const id = item.digest || item.id
            const cached = cache.entries[id]
            if (cached) {
              item.tags = uniqueMerge(item.tags ?? [], cached)
              applied++
            } else {
              pending.push(item)
            }
          }

          const batch = pending.slice(0, maxPerRun)
          log.info(
            `${applied} photos tagged from cache, ${pending.length} need tagging (analyzing ${batch.length} this build)`,
          )
          if (batch.length === 0) return

          // 3. Analyze new photos.
          const prompt = buildPrompt(vocabulary, maxTags)
          let imageMode: ImageMode = 'array'
          let licensePromise: Promise<ModelResult> | null = null
          let stop = false
          let consecutiveFailures = 0
          let tagged = 0
          let cursor = 0

          const analyze = async (item: PhotoManifestItem): Promise<void> => {
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

            // Meta's Llama license must be accepted once per account before first use.
            // All workers wait on the same request so none runs before it finishes.
            licensePromise ??= callModel(credentials, { prompt: 'agree' })
            await licensePromise

            const buildBody = (mode: ImageMode) => ({
              prompt,
              image: mode === 'array' ? [...jpeg] : jpeg.toString('base64'),
              max_tokens: 60,
              temperature: 0.2,
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
            const aiTags = parseTags(result.text ?? '', vocabulary, maxTags)
            if (aiTags.length === 0) {
              log.warn(`No usable tags returned for ${item.s3Key}: ${(result.text ?? '').slice(0, 120)}`)
              return
            }

            cache.entries[item.digest || item.id] = aiTags
            item.tags = uniqueMerge(item.tags ?? [], aiTags)
            tagged++
          }

          const workers = Array.from({ length: Math.min(concurrency, batch.length) }, async () => {
            while (!stop && cursor < batch.length) {
              const item = batch[cursor++]
              try {
                await analyze(item)
              } catch (error) {
                log.warn(`Unexpected error tagging ${item.s3Key}: ${String(error)}`)
              }
            }
          })
          await Promise.all(workers)

          // 4. Persist the cache so the next build only handles new photos.
          if (tagged > 0) {
            try {
              await storage.uploadFile(cacheKey, Buffer.from(JSON.stringify(cache)), {
                contentType: 'application/json',
              })
            } catch (error) {
              log.warn(`Could not save tag cache (photos will be re-tagged next build): ${String(error)}`)
            }
          }

          log.info(`AI tagging finished: ${tagged} new photos tagged, ${pending.length - tagged} still untagged`)
        } catch (error) {
          // Tagging is a nice-to-have: never fail the site build because of it.
          log.error(`AI tagging failed, continuing without it: ${String(error)}`)
        }
      },
    },
  }
}
