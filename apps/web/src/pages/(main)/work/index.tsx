import { useMemo } from 'react'
import { Link } from 'react-router'

import { siteConfig } from '~/config'
import work from '~/config/work.json'
import { usePhotos } from '~/hooks/usePhotoViewer'
import { useTitle } from '~/hooks/useTitle'

export const Component = () => {
  useTitle('Working together')
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
  const contactUrl = work.email ? `mailto:${work.email}` : work.contactUrl || siteConfig.author.url

  return (
    <div className="bg-background text-text fixed inset-0 z-10 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-14">
        <Link to="/" className="text-text-secondary hover:text-text mb-8 inline-flex items-center gap-1 text-sm">
          <i className="i-mingcute-left-line" />
          Gallery
        </Link>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-14">
          {/* Left: intro + contact. Stays in view on desktop while the right side scrolls. */}
          <div className="lg:sticky lg:top-14 lg:self-start">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{work.headline}</h1>
            <p className="text-text-secondary mt-4 text-base leading-relaxed">{work.intro}</p>

            <div className="bg-material-medium/40 border-fill-tertiary mt-8 rounded-2xl border p-5">
              <h2 className="text-lg font-semibold">{work.contactHeading}</h2>
              <p className="text-text-secondary mt-2 text-sm leading-relaxed">{work.contactText}</p>

              <div className="mt-4 flex items-center gap-3">
                <a
                  href={contactUrl}
                  aria-label="Contact me"
                  title="Contact me"
                  className="bg-accent inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-white transition-opacity hover:opacity-80"
                >
                  <i className="i-mingcute-mail-fill text-xl" />
                </a>
                {work.email && <span className="text-text-secondary text-sm break-all">{work.email}</span>}
              </div>

              {usageUrl && (
                <p className="text-text-tertiary mt-5 text-xs">
                  Looking to use an existing photo?{' '}
                  <a href={usageUrl} className="hover:text-text-secondary underline underline-offset-2">
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
    </div>
  )
}
