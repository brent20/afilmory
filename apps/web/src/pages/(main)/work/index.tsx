import { useMemo } from 'react'
import { Link } from 'react-router'

import work from '~/config/work.json'
import { siteConfig } from '~/config'
import { usePhotos } from '~/hooks/usePhotoViewer'
import { useTitle } from '~/hooks/useTitle'

export const Component = () => {
  useTitle('Working together')
  const photos = usePhotos()

  // Highest rated first, then newest.
  const showcase = useMemo(
    () =>
      [...photos]
        .sort(
          (a, b) =>
            (b.exif?.Rating ?? 0) - (a.exif?.Rating ?? 0) ||
            new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime(),
        )
        .slice(0, 12),
    [photos],
  )

  const contactUrl = work.email ? `mailto:${work.email}` : work.contactUrl || siteConfig.author.url

  return (
    <div className="bg-background text-text fixed inset-0 z-10 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
        <Link to="/" className="text-text-secondary hover:text-text mb-8 inline-flex items-center gap-1 text-sm">
          <i className="i-mingcute-left-line" />
          Gallery
        </Link>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{work.headline}</h1>
        <p className="text-text-secondary mt-4 max-w-2xl text-base leading-relaxed">{work.intro}</p>

        <a
          href={contactUrl}
          className="bg-accent mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white"
        >
          <i className="i-mingcute-mail-fill" />
          Get in touch
        </a>

        <h2 className="mt-14 mb-4 text-xl font-semibold">Kinds of work I enjoy</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {work.services.map((service) => (
            <li key={service.name} className="bg-material-medium/40 border-fill-tertiary rounded-2xl border p-5">
              <h3 className="font-semibold">{service.name}</h3>
              <p className="text-text-secondary mt-1 text-sm leading-relaxed">{service.description}</p>
            </li>
          ))}
        </ul>

        {showcase.length > 0 && (
          <>
            <h2 className="mt-14 mb-4 text-xl font-semibold">Selected work</h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {showcase.map((photo) => (
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

        <h2 className="mt-14 mb-3 text-xl font-semibold">Have a project in mind?</h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          Tell me a bit about it: what it is, where, and when. We can take it from there.
        </p>
        <a href={contactUrl} className="text-accent mt-3 inline-block text-sm font-medium">
          {work.email || 'Get in touch'}
        </a>
      </div>
    </div>
  )
}
