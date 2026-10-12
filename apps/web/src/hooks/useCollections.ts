import { photoLoader } from '@afilmory/data'
import { useMemo } from 'react'

import type { ResolvedCollection } from '~/lib/collections'
import { COLLECTIONS_ENABLED, resolveCollections } from '~/lib/collections'

const allPhotos = photoLoader.getPhotos()

/** The collections that currently have enough photos to be shown. */
export const useCollections = (): ResolvedCollection[] => {
  return useMemo(() => (COLLECTIONS_ENABLED ? resolveCollections(allPhotos) : []), [])
}
