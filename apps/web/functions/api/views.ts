type Env = { DB: D1Database }

const MAX_PHOTO_ID_LENGTH = 200
const MAX_TRACKED_PHOTOS = 5000
const LIST_LIMIT = 2000
const LIST_CACHE_SECONDS = 60
const DEDUPE_SECONDS = 3600
const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|python|curl|wget|httpclient|monitor|uptime/i

const INCREMENT_SQL = `
  INSERT INTO photo_views (photo_id, views, updated_at)
  SELECT ?1, 1, ?2
  WHERE EXISTS (SELECT 1 FROM photo_views WHERE photo_id = ?1)
     OR (SELECT COUNT(*) FROM photo_views) < ?3
  ON CONFLICT(photo_id) DO UPDATE SET views = views + 1, updated_at = ?2
  RETURNING views
`

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })

const attempt = async <T>(task: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await task()
  } catch {
    return undefined
  }
}

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const readPhotoId = async (request: Request) => {
  if (Number(request.headers.get('Content-Length') ?? 0) > 1024) return null
  const body = await attempt(() => request.json<{ photoId?: unknown }>())
  const photoId = body?.photoId
  if (typeof photoId !== 'string') return null
  if (photoId.length === 0 || photoId.length > MAX_PHOTO_ID_LENGTH) return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(photoId)) return null
  return photoId
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const cache = caches.default
  const cacheKey = new Request(new URL(request.url).origin + '/api/views')

  const cached = await attempt(() => cache.match(cacheKey))
  if (cached) return cached

  const { results } = await env.DB.prepare(
    'SELECT photo_id AS id, views FROM photo_views ORDER BY views DESC LIMIT ?1',
  )
    .bind(LIST_LIMIT)
    .all<{ id: string; views: number }>()

  const views: Record<string, number> = {}
  for (const row of results) views[row.id] = row.views

  const response = json(
    { views },
    { headers: { 'Cache-Control': `public, max-age=${LIST_CACHE_SECONDS}` } },
  )
  await attempt(() => cache.put(cacheKey, response.clone()))
  return response
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  if (request.headers.get('Origin') !== url.origin) {
    return json({ error: 'forbidden' }, { status: 403 })
  }

  const userAgent = request.headers.get('User-Agent') ?? ''
  if (!userAgent || BOT_PATTERN.test(userAgent)) {
    return json({ counted: false }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const photoId = await readPhotoId(request)
  if (!photoId) return json({ error: 'bad request' }, { status: 400 })

  const cache = caches.default
  const visitor = await sha256(`${request.headers.get('CF-Connecting-IP') ?? ''}|${photoId}`)
  const dedupeKey = new Request(`${url.origin}/__views-dedupe/${visitor}`)
  if (await attempt(() => cache.match(dedupeKey))) {
    return json({ counted: false }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const row = await env.DB.prepare(INCREMENT_SQL)
    .bind(photoId, Date.now(), MAX_TRACKED_PHOTOS)
    .first<{ views: number }>()

  await attempt(() =>
    cache.put(dedupeKey, new Response(null, { headers: { 'Cache-Control': `max-age=${DEDUPE_SECONDS}` } })),
  )

  return json({ counted: true, views: row?.views ?? 0 }, { headers: { 'Cache-Control': 'no-store' } })
}

export const onRequest: PagesFunction<Env> = async () => json({ error: 'method not allowed' }, { status: 405 })
