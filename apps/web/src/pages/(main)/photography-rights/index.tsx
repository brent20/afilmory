import { GlassButton, LinearBlur } from '@afilmory/ui'
import { useSetAtom } from 'jotai'
import { m } from 'motion/react'
import { startTransition, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import { isCommandPaletteOpenAtom } from '~/atoms/app'
import { siteConfig } from '~/config'
import work from '~/config/work.json'
import { useMobile } from '~/hooks/useMobile'
import { PageHeaderLeft } from '~/modules/gallery/PageHeader/PageHeaderLeft'
import { ActionIconButton } from '~/modules/gallery/PageHeader/utils'

const sections = [
  {
    title: 'Use of Photographs',
    paragraphs: [
      'Photographs may not be copied, reproduced, modified, distributed, published, displayed, sold, or used for commercial purposes without prior written permission.',
      'Downloading or viewing a photograph does not transfer ownership or grant a license to use, reproduce, or distribute the photograph.',
    ],
  },
  {
    title: 'Personal and Non-Commercial Sharing',
    paragraphs: [
      "You're welcome to share links to photographs or pages on this website.",
      'If you would like to share or repost an actual photograph, please contact me for permission. When permission is granted, attribution to Brent Saltzman and a link to this website are appreciated.',
    ],
  },
  {
    title: 'Licensing and Permission',
    paragraphs: [
      'For licensing, commercial use, publication, prints, or other permitted uses of a photograph, please contact me with the photograph, intended use, and distribution details.',
    ],
  },
  {
    title: 'Copyright Notice',
    paragraphs: [
      'Copyright in each photograph belongs to Brent Saltzman unless otherwise indicated.',
      `© ${new Date().getFullYear()} Brent Saltzman. All rights reserved.`,
    ],
  },
]

/**
 * Same navbar as the /work page (and the gallery), so moving between pages
 * feels like one continuous site.
 */
const RightsHeader = () => {
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
  useEffect(() => {
    const place = [work.location?.city, work.location?.region].filter(Boolean).join(', ')
    const homeTitle = `${siteConfig.name} | Candid, Landscape & Architecture Photographer${place ? ` in ${place}` : ''}`
    document.title = `Using my photos | ${siteConfig.name}`
    return () => {
      document.title = homeTitle
    }
  }, [])
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <>
      <RightsHeader />
      <m.div
        className="bg-background text-text fixed inset-0 z-10 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-8 sm:pt-24 sm:pb-20">
          {/* Same back button as the map and work pages */}
          <GlassButton
            className="mb-6 sm:mb-8"
            onClick={() => startTransition(() => navigate('/'))}
            title={t('explory.back.to.gallery')}
            aria-label={t('explory.back.to.gallery')}
          >
            <i className="i-mingcute-arrow-left-line text-base text-white" aria-hidden="true" />
          </GlassButton>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-14">
            {/* Left: welcome + contact. Stays in view on desktop while the right side scrolls. */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Using my photos</h1>
              <p className="text-text-secondary mt-4 text-base leading-relaxed">
                Welcome! You found this page through one of my photos. Thanks for stopping by. I&apos;m glad you liked
                it!
              </p>
              <p className="text-text-secondary mt-4 text-base leading-relaxed">
                Unless otherwise stated, photographs created by Brent Saltzman and displayed on this website, Flickr, or other online sources are protected by copyright and are owned by
                Brent Saltzman.
              </p>
              <p className="text-text-secondary mt-4 text-base leading-relaxed">
                For permission or licensing inquiries, please contact me via email at{' '}
                <a
                  href={`mailto:${work.email}`}
                  className="text-text break-all underline underline-offset-2 transition-opacity hover:opacity-80"
                >
                  {work.email}
                </a>
                .
              </p>
              <p className="text-text-tertiary mt-6 text-xs">
                Looking to hire me for a project?{' '}
                <Link to="/work" className="hover:text-text-secondary underline underline-offset-2">
                  Working together
                </Link>
              </p>
            </div>

            {/* Right: the usage terms */}
            <div>
              <ul className="grid gap-3">
                {sections.map((section) => (
                  <li key={section.title} className="bg-material-medium/40 border-fill-tertiary rounded-2xl border p-5">
                    <h2 className="text-lg font-semibold">{section.title}</h2>
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph} className="text-text-secondary mt-2 text-sm leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </m.div>
    </>
  )
}
