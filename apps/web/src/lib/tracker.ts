import { photoLoader } from '@afilmory/data'

import { injectConfig } from '~/config'
import { client } from '~/lib/client'

import { trackEvent } from './analytics'

export const trackView = (photoId: string) => {
  // Google Analytics: which photos get opened
  const photo = photoLoader.getPhoto(photoId)
  trackEvent('photo_view', {
    photo_id: photoId,
    photo_title: photo?.title,
    photo_tags: photo?.tags?.slice(0, 5).join(', '),
  })

  if (!injectConfig.useApi) return
  client.actView({
    refKey: photoId,
  })
}
