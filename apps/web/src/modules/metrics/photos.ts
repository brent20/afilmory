import { photoLoader } from '@afilmory/data'

export const findPhoto = (id: string | null | undefined) => (id ? photoLoader.getPhoto(id) : undefined)
