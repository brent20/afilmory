import type { PhotoManifest } from '~/types/photo'

/**
 * Collections: curated groups of photos built from tags (including the AI tags).
 * A collection page is simply the gallery filtered to the collection's tags.
 */

/** Turn the whole collections feature off (the strip under the title and the tiles below the photos). */
export const COLLECTIONS_ENABLED = true

/** A collection only appears once it has at least this many photos. */
export const COLLECTION_MIN_PHOTOS = 12

export interface CollectionDefinition {
  slug: string
  title: string
  /** A photo belongs to the collection if it has ANY of these tags (not case-sensitive). */
  tags: string[]
}

/** Edit this list to rename, add or remove collections. Order here is the order shown on the site. */
export const COLLECTIONS: CollectionDefinition[] = [
  { slug: 'street', title: 'Street & City', tags: ['Street', 'City', 'Urban', 'People', 'Signs & Text'] },
  { slug: 'architecture', title: 'Architecture', tags: ['Architecture', 'Interior', 'Bridges'] },
  { slug: 'landscape', title: 'Landscape', tags: ['Landscape', 'Mountains', 'Trees', 'Sky', 'Clouds', 'Fog'  ] },
  { slug: 'everyday-life', title: 'Everyday Life', tags: ['Family', 'Food', 'Sports', 'Music', 'Technology'] },
  { slug: 'wildlife', title: 'Wildlife & Nature', tags: ['Wildlife', 'Birds', 'Pets', 'Flowers', 'Nature', 'Macro'] },
  { slug: 'night', title: 'Night', tags: ['Night'] },
  { slug: 'machines', title: 'Machines', tags: ['Cars', 'Trains', 'Aircraft', 'Boats'] },
  { slug: 'black-and-white', title: 'Black & White', tags: ['Black & White'] },
]

export interface ResolvedCollection extends CollectionDefinition {
  /** Number of photos in the collection. */
  count: number
  /** Photo used for the collection's tile. */
  cover: PhotoManifest | null
  /** The tags as they are actually spelled on your photos (only those that exist). */
  matchedTags: string[]
  /** Link to the gallery filtered to this collection. */
  href: string
}

export function collectionHref(tags: string[]): string {
  return `/?tags=${tags.map((tag) => encodeURIComponent(tag)).join(',')}`
}

/** Works out which collections have enough photos to be shown, with counts and covers. */
export function resolveCollections(photos: PhotoManifest[]): ResolvedCollection[] {
  // lower-cased tag -> the spelling used on the photos
  const spelling = new Map<string, string>()
  for (const photo of photos) {
    for (const tag of photo.tags ?? []) {
      const key = tag.toLowerCase()
      if (!spelling.has(key)) spelling.set(key, tag)
    }
  }

  const resolved: ResolvedCollection[] = []
  for (const definition of COLLECTIONS) {
    const matchedTags = definition.tags
      .map((tag) => spelling.get(tag.toLowerCase()))
      .filter((tag): tag is string => Boolean(tag))
    if (matchedTags.length === 0) continue

    const matched = new Set(matchedTags)
    let count = 0
    let cover: PhotoManifest | null = null
    let coverScore = 0
    for (const photo of photos) {
      const score = (photo.tags ?? []).filter((tag) => matched.has(tag)).length
      if (score === 0) continue
      count += 1
      // The cover is the photo that fits the collection best (the first one wins a tie).
      if (score > coverScore && photo.thumbnailUrl) {
        cover = photo
        coverScore = score
      }
    }

    if (count < COLLECTION_MIN_PHOTOS) continue
    resolved.push({ ...definition, count, cover, matchedTags, href: collectionHref(matchedTags) })
  }
  return resolved
}

/** True when the selected tags are exactly the tags of this collection. */
export function isCollectionSelected(collection: ResolvedCollection, selectedTags: string[]): boolean {
  if (selectedTags.length !== collection.matchedTags.length) return false
  const selected = new Set(selectedTags)
  return collection.matchedTags.every((tag) => selected.has(tag))
}