import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { isPrivateShare } from '~/lib/private-share'

export type PhotoViewCounts = Record<string, number>

const VIEWS_ENDPOINT = '/api/views'
const VIEWS_QUERY_KEY = ['photo-views'] as const
const COUNTED_STORAGE_KEY = 'photo-views:counted'
const IGNORE_STORAGE_KEY = 'photo-views:ignore'
const DWELL_MS = 1500
const STALE_MS = 60_000

const fetchPhotoViews = async (): Promise<PhotoViewCounts> => {
  const response = await fetch(VIEWS_ENDPOINT, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`Photo views request failed with status ${response.status}`)
  }
  const body: { views?: PhotoViewCounts } = await response.json()
  return body.views ?? {}
}

const postPhotoView = async (photoId: string): Promise<number | null> => {
  const response = await fetch(VIEWS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoId }),
    keepalive: true,
  })
  if (!response.ok) {
    return null
  }
  const body: { counted?: boolean, views?: number } = await response.json()
  return body.counted && typeof body.views === 'number' ? body.views : null
}

const readCountedPhotoIds = (): string[] => {
  try {
    const raw = sessionStorage.getItem(COUNTED_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  }
  catch {
    return []
  }
}

const markPhotoCounted = (photoId: string) => {
  try {
    sessionStorage.setItem(COUNTED_STORAGE_KEY, JSON.stringify([...readCountedPhotoIds(), photoId]))
  }
  catch {
    return
  }
}

const isCountingDisabled = () => {
  if (isPrivateShare()) {
    return true
  }
  try {
    return localStorage.getItem(IGNORE_STORAGE_KEY) !== null
  }
  catch {
    return false
  }
}

export const usePhotoViewCounts = () =>
  useQuery({
    queryKey: VIEWS_QUERY_KEY,
    queryFn: fetchPhotoViews,
    staleTime: STALE_MS,
    retry: false,
    enabled: !isPrivateShare(),
  })

export const usePhotoViewCount = (photoId: string): number | null => {
  const { data } = usePhotoViewCounts()
  return data?.[photoId] ?? null
}

export const useRecordPhotoView = (photoId: string) => {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (isCountingDisabled() || readCountedPhotoIds().includes(photoId)) {
      return
    }

    const timer = window.setTimeout(async () => {
      markPhotoCounted(photoId)
      try {
        const views = await postPhotoView(photoId)
        if (views === null) {
          return
        }
        queryClient.setQueryData<PhotoViewCounts>(VIEWS_QUERY_KEY, current => ({ ...current, [photoId]: views }))
      }
      catch {
        return
      }
    }, DWELL_MS)

    return () => window.clearTimeout(timer)
  }, [photoId, queryClient])
}
