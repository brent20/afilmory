import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'

import { gallerySettingAtom } from '~/atoms/app'
import { useCollections } from '~/hooks/useCollections'
import { trackEvent } from '~/lib/analytics'
import { isCollectionSelected } from '~/lib/collections'

const FILTER_PARAMS = ['tags', 'cameras', 'lenses', 'rating', 'from', 'to']

/**
 * Logs what visitors filter for. Every route to a filter (tag clicks, camera/lens links, collections, the
 * search palette) ends up in the gallery settings, so watching them covers all of it.
 *
 * A collection link logs one `collection_view`, not one event per tag in it. A filtered link that the page
 * was opened with is marked source "landing"; everything else is "interaction".
 */
export const useFilterAnalytics = () => {
  const { selectedTags, selectedCameras, selectedLenses, selectedRatings, selectedDateRange } =
    useAtomValue(gallerySettingAtom)
  const collections = useCollections()

  const previous = useRef({ tags: [] as string[], cameras: [] as string[], lenses: [] as string[], rating: null as number | null, range: '' })
  const landingPending = useRef(
    typeof window !== 'undefined' && FILTER_PARAMS.some((key) => new URLSearchParams(window.location.search).has(key)),
  )

  useEffect(() => {
    const before = previous.current
    const range = selectedDateRange ? `${selectedDateRange.from ?? ''}..${selectedDateRange.to ?? ''}` : ''

    const addedTags = selectedTags.filter((tag) => !before.tags.includes(tag))
    const addedCameras = selectedCameras.filter((camera) => !before.cameras.includes(camera))
    const addedLenses = selectedLenses.filter((lens) => !before.lenses.includes(lens))
    const ratingChanged = selectedRatings !== null && selectedRatings !== before.rating
    const rangeChanged = range !== '' && range !== before.range

    previous.current = { tags: selectedTags, cameras: selectedCameras, lenses: selectedLenses, rating: selectedRatings, range }

    if (addedTags.length + addedCameras.length + addedLenses.length === 0 && !ratingChanged && !rangeChanged) return

    const source = landingPending.current ? 'landing' : 'interaction'
    landingPending.current = false

    const collection = addedTags.length > 0 ? collections.find((item) => isCollectionSelected(item, selectedTags)) : undefined
    if (collection) {
      trackEvent('collection_view', { collection: collection.title, source })
    }
    else {
      for (const tag of addedTags) trackEvent('filter_applied', { filter_type: 'tag', filter_value: tag, source })
    }
    for (const camera of addedCameras) trackEvent('filter_applied', { filter_type: 'camera', filter_value: camera, source })
    for (const lens of addedLenses) trackEvent('filter_applied', { filter_type: 'lens', filter_value: lens, source })
    if (ratingChanged) trackEvent('filter_applied', { filter_type: 'rating', filter_value: `${selectedRatings}+`, source })
    if (rangeChanged) trackEvent('filter_applied', { filter_type: 'date_range', filter_value: range, source })
  }, [selectedTags, selectedCameras, selectedLenses, selectedRatings, selectedDateRange, collections])
}

/** Logs what visitors search for, once they pause typing (not on every keystroke). */
export const useSearchAnalytics = (query: string) => {
  const lastLogged = useRef('')

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2 || term === lastLogged.current) return
    const timer = window.setTimeout(() => {
      lastLogged.current = term
      trackEvent('search', { search_term: term.toLowerCase() })
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [query])
}
