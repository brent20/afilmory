import type { CameraInfo, LensInfo, PhotoManifestItem } from '@afilmory/builder'

/**
 * The Lightroom keyword that marks a photo for the "Featured work" section on /work.
 * Change it here if you ever want a different keyword. Matching ignores case and also
 * accepts a hierarchical keyword (e.g. "Website|featured-work").
 */
export const FEATURED_KEYWORD = 'featured-work'

const keywordLeaf = (keyword: string) => keyword.split('|').pop()?.trim().toLowerCase() ?? ''

export const isFeaturedKeyword = (keyword: string) => keywordLeaf(keyword) === FEATURED_KEYWORD

export const isFeaturedPhoto = (photo: { keywords?: string[] }) => photo.keywords?.some(isFeaturedKeyword) ?? false

class PhotoLoader {
  private photos: PhotoManifestItem[] = []
  private photoMap: Record<string, PhotoManifestItem> = {}
  private cameras: CameraInfo[] = []
  private lenses: LensInfo[] = []

  constructor() {
    this.getAllTags = this.getAllTags.bind(this)
    this.getAllCameras = this.getAllCameras.bind(this)
    this.getAllLenses = this.getAllLenses.bind(this)
    this.getPhotos = this.getPhotos.bind(this)
    this.getPhoto = this.getPhoto.bind(this)

    // The featured keyword is only a flag for the /work page, so keep it out of the
    // public tag lists (gallery filter, photo info panel, search). `keywords` is untouched.
    this.photos = (__MANIFEST__.data as unknown as PhotoManifestItem[]).map((photo) =>
      photo.tags?.some(isFeaturedKeyword) ? { ...photo, tags: photo.tags.filter((tag) => !isFeaturedKeyword(tag)) } : photo,
    )
    this.cameras = __MANIFEST__.cameras as unknown as CameraInfo[]
    this.lenses = __MANIFEST__.lenses as unknown as LensInfo[]

    this.photos.forEach((photo) => {
      this.photoMap[photo.id] = photo
    })
  }

  getPhotos() {
    return this.photos
  }

  getPhoto(id: string) {
    return this.photoMap[id]
  }

  getAllTags() {
    const tagSet = new Set<string>()
    this.photos.forEach((photo) => {
      photo.tags.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }

  getAllCameras() {
    return this.cameras
  }

  getAllLenses() {
    return this.lenses
  }
}
export const photoLoader = new PhotoLoader()
