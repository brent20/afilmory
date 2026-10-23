import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { useSetAtom } from 'jotai'
import type { MouseEvent } from 'react'
import { Link } from 'react-router'

import { gallerySettingAtom } from '~/atoms/app'
import { siteConfig } from '~/config'
import { usePhotos } from '~/hooks/usePhotoViewer'
import { useScrollGalleryToTop } from '~/hooks/useScrollGalleryToTop'

import { resolveSocialUrl, SocialIconButton } from './utils'

export const PageHeaderLeft = () => {
  const visiblePhotoCount = usePhotos().length
  const setGallerySetting = useSetAtom(gallerySettingAtom)
  const scrollToTop = useScrollGalleryToTop()

  // Clicking the site title clears every filter and returns to the start of the landing gallery.
  // The Link itself takes care of going to "/" (which also closes the photo viewer or map).
  const handleTitleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Leave "open in new tab" style clicks alone.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    setGallerySetting((prev) => ({
      ...prev,
      selectedTags: [],
      selectedCameras: [],
      selectedLenses: [],
      selectedRatings: null,
      selectedDateRange: null,
      tagFilterMode: 'union',
    }))
    scrollToTop()
  }

  const githubUrl =
    siteConfig.social && siteConfig.social.github
      ? resolveSocialUrl(siteConfig.social.github, { baseUrl: 'https://github.com/' })
      : undefined
  const twitterUrl =
    siteConfig.social && siteConfig.social.twitter
      ? resolveSocialUrl(siteConfig.social.twitter, { baseUrl: 'https://twitter.com/', stripAt: true })
      : undefined
  const hasRss = true
  const contactUrl = siteConfig.social?.contact?.trim() || siteConfig.author.url
  const usageUrl = siteConfig.social?.usage?.trim() || siteConfig.author.url

  return (
    <div className="flex items-center gap-2">
      {siteConfig.author.avatar ? (
        <AvatarPrimitive.Root>
          <AvatarPrimitive.Image
            src={siteConfig.author.avatar}
            className="size-7 rounded-lg lg:size-8"
            alt={siteConfig.author.name}
          />
          <AvatarPrimitive.Fallback>
            <div className="flex size-7 items-center justify-center rounded-lg bg-white/10 lg:size-8">
              <i className="i-mingcute-camera-2-line text-sm text-white/60 lg:text-base" />
            </div>
          </AvatarPrimitive.Fallback>
        </AvatarPrimitive.Root>
      ) : (
        <div className="flex size-7 items-center justify-center rounded-lg bg-white/10 lg:size-8">
          <i className="i-mingcute-camera-2-line text-sm text-white/60 lg:text-base" />
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <h1 className="truncate text-sm font-semibold text-white lg:text-base">
          <Link to="/" onClick={handleTitleClick} className="transition-opacity duration-200 hover:opacity-70">
            {siteConfig.name}
          </Link>
        </h1>
        <span className="text-xs text-white/40 lg:text-sm">{visiblePhotoCount}</span>
      </div>
      <div className="ml-1 hidden items-center gap-1 border-l border-white/10 pl-2 lg:flex">
        {githubUrl && <SocialIconButton icon="i-mingcute-github-fill" title="GitHub" href={githubUrl} />}
        {twitterUrl && <SocialIconButton icon="i-mingcute-twitter-fill" title="Twitter" href={twitterUrl} />}
        {hasRss && <SocialIconButton icon="i-mingcute-rss-2-fill" title="RSS" href="/feed.xml" />}
        {contactUrl && (
          <Link
            to="/work"
            className="inline-flex size-6 items-center justify-center rounded text-white/40 transition-colors duration-200 hover:text-white/80 lg:size-7"
            title="Contact"
          >
            <i className="i-mingcute-mail-fill text-sm lg:text-base" />
          </Link>
        )}
        {usageUrl && <SocialIconButton icon="i-mingcute-information-fill" title="Usage info" href={usageUrl} />}
      </div>
    </div>
  )
}
