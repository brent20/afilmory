import type { ModalComponent } from '@afilmory/ui'
import { Modal } from '@afilmory/ui'
import { clsxm } from '@afilmory/utils'
import type { MouseEvent, ReactElement, ReactNode } from 'react'
import { cloneElement, isValidElement, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { injectConfig, siteConfig } from '~/config'
import type { PhotoManifest } from '~/types/photo'

import { CopyButton } from './CopyButton'
import { ShareActionButton } from './ShareActionButton'

// OG image aspect ratio: 1200:628 (from og.renderer.tsx)
const OG_ASPECT_RATIO = 1200 / 628

interface ShareModalTriggerProps {
  photo: PhotoManifest
  trigger: ReactNode
  blobSrc?: string
}

interface ShareSheetProps {
  photo: PhotoManifest
  blobSrc?: string
}

interface SocialShareOption {
  id: string
  label: string
  icon: string
  url: string
}

export const ShareModal = ({ photo, trigger, blobSrc }: ShareModalTriggerProps) => {
  const handleOpen = useCallback(() => {
    Modal.present(ShareSheet, { photo, blobSrc }, { dismissOnOutsideClick: true })
  }, [blobSrc, photo])

  if (isValidElement(trigger)) {
    return cloneElement(trigger as ReactElement, {
      // @ts-expect-error - onClick is not a valid prop for the trigger element
      onClick: (event: MouseEvent<HTMLElement>) => {
        // @ts-expect-error - trigger is a valid React element
        trigger.props?.onClick?.(event)
        if (event.defaultPrevented) {
          return
        }
        handleOpen()
      },
    })
  }

  return (
    <button type="button" onClick={handleOpen} className="contents">
      {trigger}
    </button>
  )
}

const ShareSheet: ModalComponent<ShareSheetProps> = ({ photo, dismiss }) => {
  const { t } = useTranslation()
  const [isOgImageLoading, setIsOgImageLoading] = useState(true)

  const resolvedBaseUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin
    }
    return siteConfig.url?.replace(/\/$/, '') ?? ''
  }, [])

  const shareLink = useMemo(() => {
    const pathname = `/photos/${photo.id}`
    if (!resolvedBaseUrl) {
      return pathname
    }
    return `${resolvedBaseUrl}${pathname}`
  }, [photo.id, resolvedBaseUrl])

  const ogPreviewUrl = useMemo(() => {
    const path = `/og/${photo.id}`
    if (!resolvedBaseUrl) {
      return path
    }
    return `${resolvedBaseUrl}${path}`
  }, [photo.id, resolvedBaseUrl])

  const canEmbed = injectConfig.useNext || injectConfig.useCloud

  const embedCode = useMemo(() => {
    const base = resolvedBaseUrl || ''
    return `<script async src="${base}/share/embed.js" data-afilmory-photo="${photo.id}" data-aspect="${photo.width}:${photo.height}" data-width="100%"></script>`
  }, [photo.height, photo.id, photo.width, resolvedBaseUrl])

  const shareTitle = photo.title || t('photo.share.default.title')
  const shareText = t('photo.share.text', { title: shareTitle })

  const socialOptions = useMemo(() => getSocialOptions(t), [t])

  const actionColumns = 3 + (canEmbed ? 1 : 0)

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      toast.success(t('photo.share.linkCopied'))
    }
    catch {
      toast.error(t('photo.share.copy.failed'))
      throw new Error('Failed to copy')
    }
  }, [shareLink, t])

  const handleCopyEmbed = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(embedCode)
      toast.success(t('photo.share.embed.copied'))
    }
    catch {
      toast.error(t('photo.share.copy.failed'))
      throw new Error('Failed to copy')
    }
  }, [embedCode, t])

  const handleSocialShare = useCallback(
    (urlTemplate: string) => {
      const encodedUrl = encodeURIComponent(shareLink)
      const encodedTitle = encodeURIComponent(shareTitle)
      const encodedText = encodeURIComponent(shareText)
      const finalUrl = urlTemplate
        .replace('{url}', encodedUrl)
        .replace('{title}', encodedTitle)
        .replace('{text}', encodedText)
      window.open(finalUrl, '_blank', 'width=600,height=600')
      dismiss()
    },
    [dismiss, shareLink, shareText, shareTitle],
  )

  return (
    <div className="w-full text-base">
      <div className="mb-4">
        <div className="min-w-0">
          <p className="mb-0.5 text-xs font-medium text-white/50">{t('photo.share.title')}</p>
          <div className="truncate text-lg font-semibold text-white">{shareTitle}</div>
          {photo.location?.city && <p className="mt-0.5 text-xs text-white/40">{photo.location.city}</p>}
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-white/50">{t('photo.share.link')}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white">
          <span className="flex-1 truncate text-xs">{shareLink}</span>

          <CopyButton onCopy={handleCopyLink} />
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <p className="text-xs font-medium text-white/50">{t('photo.share.preview')}</p>
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
          {/* Fixed aspect ratio placeholder to prevent CLS */}
          <div className="w-full" style={{ aspectRatio: OG_ASPECT_RATIO }}>
            {isOgImageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/5">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
              </div>
            )}
            <img
              src={ogPreviewUrl}
              alt={photo.title}
              className={clsxm(
                'h-full w-full object-cover transition-opacity duration-300',
                isOgImageLoading ? 'opacity-0' : 'opacity-100',
              )}
              loading="lazy"
              onLoad={() => setIsOgImageLoading(false)}
              onError={() => setIsOgImageLoading(false)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-white/50">{t('photo.share.actions')}</p>
        <div
          className={clsxm(
            'grid gap-2',
            actionColumns === 4 && 'grid-cols-4',
            actionColumns === 3 && 'grid-cols-3',
          )}
        >
          {/* Social share buttons */}
          {socialOptions.map(option => (
            <ShareActionButton
              key={option.id}
              icon={option.icon}
              label={option.label}
              onClick={() => handleSocialShare(option.url)}
            />
          ))}
          {/* Embed iframe code (cloud / SSR only) */}
          {canEmbed && (
            <ShareActionButton
              icon="i-mingcute-code-line"
              label="Embed"
              onClick={handleCopyEmbed}
              title={t('photo.share.embed.description')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

ShareSheet.contentClassName = 'max-w-3xl w-full z-1000000'

function getSocialOptions(t: ReturnType<typeof useTranslation>['t']): SocialShareOption[] {
  return [
    {
      id: 'twitter',
      label: 'Twitter',
      icon: 'i-mingcute-twitter-fill',
      url: 'https://twitter.com/intent/tweet?text={text}&url={url}',
    },
    {
      id: 'telegram',
      label: 'Telegram',
      icon: 'i-mingcute-telegram-line',
      url: 'https://t.me/share/url?url={url}&text={text}',
    },
    {
      id: 'weibo',
      label: t('photo.share.weibo'),
      icon: 'i-mingcute-weibo-line',
      url: 'https://service.weibo.com/share/share.php?url={url}&title={text}',
    },
  ]
}

ShareSheet.displayName = 'ShareSheet'
