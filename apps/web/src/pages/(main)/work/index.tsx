import { GlassButton, LinearBlur } from '@afilmory/ui'
import { useSetAtom } from 'jotai'
import { m } from 'motion/react'
import { startTransition, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import { isCommandPaletteOpenAtom } from '~/atoms/app'
import { siteConfig } from '~/config'
import work from '~/config/work.json'
import { useMobile } from '~/hooks/useMobile'
import { usePhotos } from '~/hooks/usePhotoViewer'
import { PageHeaderLeft } from '~/modules/gallery/PageHeader/PageHeaderLeft'
import { ActionIconButton } from '~/modules/gallery/PageHeader/utils'

/**
 * Same navbar as the gallery (blur, height, logo/title/icons on the left) so moving
 * between the gallery and this page feels like one continuous site. The right side
 * swaps the gallery-only view controls for search, map and a way back.
 */
const WorkHeader = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isMobile = useMobile()
  const setCommandPaletteOpen = useSetAtom(isCommandPaletteOpenAtom)

  return (
    <header className="fixed top-0 right-0 left-0 z-100">
      <LinearBlur
        className="pointer-events-none absolute inset-x-0 z-[-1] h-15"
        tint="var(--color-background)"
        strength={128}
        side="top"
      />
      <div className="flex h-12 items-center justify-between gap-2 px-3 lg:gap-3 lg:px-4">
        <PageHeaderLeft />
        <div className="bg-material-medium/40 flex items-center gap-1 rounded-lg">
          <ActionIconButton
            icon="i-mingcute-search-line"
            title={t('action.search.unified.title')}
            onClick={() => setCommandPaletteOpen(true)}
          />
          {!isMobile && (
            <ActionIconButton
              icon="i-mingcute-map-pin-line"
              title={t('action.map.explore')}
              onClick={() => navigate('/map')}
            />
          )}
          <ActionIconButton icon="i-mingcute-layout-grid-line" title="Gallery" onClick={() => navigate('/')} />
        </div>
      </div>
    </header>
  )
}

export const Component = () => {
  // Set this page's tab title, and put the gallery's title back when leaving.
  // (The gallery's own title is built the same way in plugins/vite/seo.ts.)
  useEffect(() => {
    const place = [work.location?.city, work.location?.region].filter(Boolean).join(', ')
    const homeTitle = `${siteConfig.name} | Candid, Landscape & Architecture Photographer${place ? ` in ${place}` : ''}`
    document.title = `Working together | ${siteConfig.name}`
    return () => {
      document.title = homeTitle
    }
  }, [])
  const { t } = useTranslation()
  const navigate = useNavigate()
  const photos = usePhotos()

  // Newest first.
  const recent = useMemo(
    () =>
      [...photos]
        .sort((a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime())
        .slice(0, 12),
    [photos],
  )

  const usageUrl = siteConfig.social?.usage?.trim()
  const avatarUrl = siteConfig.author.avatar
  const contactUrl = work.email ? `mailto:${work.email}` : work.contactUrl || siteConfig.author.url

  return (
    <>
      <WorkHeader />
      <m.div
        className="bg-background text-text fixed inset-0 z-10 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-8 sm:pt-24 sm:pb-20">
          {/* Same back button as the map page */}
          <GlassButton
            className="mb-6 sm:mb-8"
            onClick={() => startTransition(() => navigate('/'))}
            title={t('explory.back.to.gallery')}
            aria-label={t('explory.back.to.gallery')}
          >
            <i className="i-mingcute-arrow-left-line text-base text-white" aria-hidden="true" />
          </GlassButton>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-14">
            {/* Left: intro + contact. Stays in view on desktop while the right side scrolls. */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{work.headline}</h1>
              <p className="text-text-secondary mt-4 text-base leading-relaxed">{work.intro}</p>

              <div className="bg-material-medium/40 border-fill-tertiary mt-6 rounded-2xl border p-5 sm:mt-8">
                <div className="flex items-center gap-3">
                  {avatarUrl && (
                    <img
                      src={avatarUrl}
                      alt={siteConfig.author.name}
                      decoding="async"
                      className="ring-fill-tertiary size-12 shrink-0 rounded-full object-cover ring-1"
                    />
                  )}
                  <h2 className="text-lg font-semibold">{work.contactHeading}</h2>
                </div>
                <p className="text-text-secondary mt-4 text-sm leading-relaxed">{work.contactText}</p>

                <div className="mt-4 flex items-center gap-3">
                  <a
                    href={contactUrl}
                    aria-label="Contact me"
                    title="Contact me"
                    className="bg-accent inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-white transition-opacity hover:opacity-80"
                  >
                    <i className="i-mingcute-mail-fill text-xl" />
                  </a>
                  {work.email && (
                    <a
                      href={`mailto:${work.email}`}
                      className="text-text-secondary hover:text-text text-sm break-all underline-offset-2 transition-colors hover:underline"
                    >
                      {work.email}
                    </a>
                  )}
                </div>

                {usageUrl && (
                  <p className="text-text-tertiary mt-5 text-xs">
                    Looking to use an existing photo?{' '}
                    <a
                      href={usageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-text-secondary underline underline-offset-2"
                    >
                      Usage &amp; copyright info
                    </a>
                  </p>
                )}
              </div>
            </div>

            {/* Right: what I enjoy shooting + recent work */}
            <div>
              <h2 className="mb-4 text-xl font-semibold">Kinds of work I enjoy</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {work.services.map((service) => (
                  <li key={service.name} className="bg-material-medium/40 border-fill-tertiary rounded-2xl border p-5">
                    <h3 className="font-semibold">{service.name}</h3>
                    <p className="text-text-secondary mt-1 text-sm leading-relaxed">{service.description}</p>
                  </li>
                ))}
              </ul>

              {recent.length > 0 && (
                <>
                  <h2 className="mt-12 mb-4 text-xl font-semibold">Recent work</h2>
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {recent.map((photo) => (
                      <li key={photo.id}>
                        <Link to={`/photos/${photo.id}`} className="block overflow-hidden rounded-xl">
                          <img
                            src={photo.thumbnailUrl}
                            alt={photo.title || 'Photograph'}
                            loading="lazy"
                            width={photo.width}
                            height={photo.height}
                            className="aspect-square w-full object-cover transition-transform duration-300 hover:scale-105"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      </m.div>
    </>
  )
}
