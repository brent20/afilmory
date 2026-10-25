import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { PhotoManifestItem } from '@afilmory/typing'
import type { Plugin } from 'vite'

import type { SiteConfig } from '../../../../site.config'
import { MANIFEST_PATH } from './__internal__/constants'

/**
 * SEO build plugin.
 *
 * The gallery is a client-rendered SPA, so crawlers (and link previews) only ever
 * see one generic index.html. After the normal build finishes, this plugin:
 *
 *  1. Rewrites dist/index.html with a proper title, description, canonical URL,
 *     Open Graph / Twitter tags and JSON-LD (Person, ProfessionalService, WebSite).
 *  2. Emits dist/work/index.html (the "book a shoot" page) and
 *     dist/photography-rights/index.html (usage / copyright page).
 *  3. Emits dist/photos/<id>/index.html for every photo, each with its own title,
 *     description, canonical URL, JSON-LD ImageObject (with license info so Google
 *     Images can show the "Licensable" badge) and plain-HTML content + internal links.
 *  4. Writes sitemap.xml (with image entries) and robots.txt.
 *
 * Visitors still get the normal SPA: the static content lives inside #root and is
 * replaced as soon as React mounts.
 */

interface HireConfig {
  email?: string
  contactUrl?: string
  location?: { city?: string; region?: string; country?: string }
  headline: string
  intro: string
  services: { name: string; description: string }[]
    keywords?: string[]
}

interface PageMeta {
  title: string
  description: string
  url: string
  image?: string
  ogType: 'website' | 'article'
  jsonLd: unknown[]
}

export function createSeoPlugin(siteConfig: SiteConfig): Plugin {
  const baseUrl = siteConfig.url.replace(/\/+$/, '')
  let root = process.cwd()
  let outDir = path.resolve(root, 'dist')

  return {
    name: 'seo-prerender',
    apply: 'build',
    configResolved(resolved) {
      root = resolved.root
      outDir = path.resolve(resolved.root, resolved.build.outDir)
    },
    closeBundle: {
      order: 'post',
      handler() {
        try {
          run()
        } catch (error) {
          // Never fail the whole deploy because of SEO extras.
          console.error('[seo-prerender] failed, continuing without it:', error)
        }
      },
    },
  }

  function run() {
    const indexPath = path.join(outDir, 'index.html')
    if (!existsSync(indexPath)) {
      console.warn('[seo-prerender] dist/index.html not found, skipping')
      return
    }

    const template = readFileSync(indexPath, 'utf-8')
    if (template.includes('id="seo-content"')) return // already processed
    const hire = JSON.parse(readFileSync(path.resolve(root, 'src/config/work.json'), 'utf-8')) as HireConfig
    const photos = loadPhotos()
    const defaultImage = /property=["']?og:image["']?\s+content=["']?([^"'\s>]+)/i.exec(template)?.[1]
    const person = personSchema(hire)
    const service = serviceSchema(hire)
    const place = placeLabel(hire)
    const inPlace = place ? ` in ${place}` : ''

    // 1. Home
    const homeMeta: PageMeta = {
      title: `${siteConfig.name} | Omaha Candid & Architecture Photographer`,
      description: clip(siteConfig.description, 160),
      url: `${baseUrl}/`,
      image: defaultImage,
      ogType: 'website',
      jsonLd: [
        person,
        service,
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          '@id': `${baseUrl}/#website`,
          name: siteConfig.name,
          url: `${baseUrl}/`,
          publisher: { '@id': `${baseUrl}/#person` },
        },
      ],
    }
    writeHtml(indexPath, renderPage(template, homeMeta, homeBody(hire, photos)))

    // 2. Hire page
    const workMeta: PageMeta = {
      title: `Work with ${siteConfig.name} | Omaha Architecture Photographer`,
      description: clip(
        `Work with ${siteConfig.name} on architecture, interior, landscape and candid photography${inPlace}. Have a project in mind? Get in touch.`,
        160,
      ),
      url: `${baseUrl}/work`,
      image: defaultImage,
      ogType: 'website',
      jsonLd: [person, service, breadcrumb([['Home', `${baseUrl}/`], ['Work together', `${baseUrl}/work`]])],
    }
    writeHtml(path.join(outDir, 'work', 'index.html'), renderPage(template, workMeta, hireBody(hire, photos)))

    // 2b. Photo usage / copyright page (also the `license` URL in every photo's ImageObject)
    const rightsMeta: PageMeta = {
      title: `Using my photos | ${siteConfig.name}`,
      description: clip(
        `How to share, license or request permission to use photographs by ${siteConfig.name}. Copyright information and contact details.`,
        160,
      ),
      url: `${baseUrl}/photography-rights`,
      image: defaultImage,
      ogType: 'website',
      jsonLd: [
        person,
        breadcrumb([['Home', `${baseUrl}/`], ['Using my photos', `${baseUrl}/photography-rights`]]),
      ],
    }
    writeHtml(
      path.join(outDir, 'photography-rights', 'index.html'),
      renderPage(template, rightsMeta, rightsBody(hire)),
    )

    // 3. Photo pages
    const sorted = [...photos].sort((a, b) => dateMs(b) - dateMs(a))
    let written = 0
    sorted.forEach((photo, i) => {
      if (!isSafeId(photo.id)) return
      const url = `${baseUrl}/photos/${encodeURIComponent(photo.id)}`
      const name = photoName(photo)
      const meta: PageMeta = {
        title: `${name} | ${siteConfig.name}`,
        description: clip(photoDescription(photo, name), 160),
        url,
        image: abs(photo.ogImageUrl || photo.thumbnailUrl),
        ogType: 'article',
        jsonLd: [
          imageSchema(photo, name, url),
          breadcrumb([['Home', `${baseUrl}/`], [name, url]]),
        ],
      }
      writeHtml(
        path.join(outDir, 'photos', photo.id, 'index.html'),
        renderPage(template, meta, photoBody(photo, name, sorted[i - 1], sorted[i + 1])),
      )
      written++
    })

    // 4. Sitemap + robots
    writeFileSync(path.join(outDir, 'sitemap.xml'), sitemapXml(sorted))
    if (!existsSync(path.join(outDir, 'robots.txt'))) {
      writeFileSync(
        path.join(outDir, 'robots.txt'),
        `User-agent: *\nAllow: /\nDisallow: /_s/\n\nSitemap: ${baseUrl}/sitemap.xml\n`,
      )
    }

    console.info(`[seo-prerender] home, hire, rights, ${written} photo pages, sitemap.xml, robots.txt`)
  }

  function loadPhotos(): PhotoManifestItem[] {
    try {
      const parsed = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
      return Array.isArray(parsed?.data) ? parsed.data : []
    } catch {
      return []
    }
  }

  // ---------------------------------------------------------------- helpers

  function abs(url?: string | null): string | undefined {
    if (!url) return undefined
    if (/^https?:\/\//i.test(url)) return url
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`
  }

  function placeLabel(hire: HireConfig): string {
    return [hire.location?.city, hire.location?.region].filter(Boolean).join(', ')
  }

  function photoPlace(photo: PhotoManifestItem): string {
    const loc = photo.location
    return loc?.cityName || loc?.city || loc?.locationName || ''
  }

  function dateMs(photo: PhotoManifestItem): number {
    const ms = new Date(photo.dateTaken).getTime()
    return Number.isNaN(ms) ? 0 : ms
  }

  function isoDate(value?: string): string | undefined {
    if (!value) return undefined
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
  }

  // Photo ids become folder names, so refuse anything that could escape dist/photos.
  function isSafeId(id: string): boolean {
    return !!id && !/[\\/]|\.\./.test(id) && !id.startsWith('.')
  }

  // Titles that are just camera filenames (DSC01234, IMG_0042.jpg) make poor page titles.
  function photoName(photo: PhotoManifestItem): string {
    const title = (photo.title || '').trim()
    const looksLikeFile
      = !title
        || /\.(?:jpe?g|png|heic|heif|webp|tiff?|dng|arw|raw)$/i.test(title)
        || /^[a-z]{0,6}[_-]?\d{3,}(?:[_-]\w+)*$/i.test(title)
    if (!looksLikeFile) return title
    const where = photoPlace(photo)
    return where ? `Photograph in ${where}` : `Photograph by ${siteConfig.name}`
  }

  function photoDescription(photo: PhotoManifestItem, name: string): string {
    const own = (photo.description || '').trim()
    if (own) return own
    const where = photoPlace(photo)
    const tags = (photo.tags || []).slice(0, 5).join(', ')
    return `${name}, a photograph by ${siteConfig.name}${where ? ` taken in ${where}` : ''}.${tags ? ` Subjects: ${tags}.` : ''}`
  }

  // Prefer the full-size original for image search, but not for formats browsers can't show.
  function pickImageUrl(photo: PhotoManifestItem): string | undefined {
    const original = photo.originalUrl
    if (original && !/\.(?:heic|heif|dng|arw|tiff?)(?:\?|$)/i.test(original)) return abs(original)
    return abs(photo.thumbnailUrl)
  }

  function sameAs(): string[] {
    const links = [siteConfig.author.url]
    const { github, twitter } = siteConfig.social ?? {}
    if (github) links.push(/^https?:/i.test(github) ? github : `https://github.com/${github}`)
    if (twitter) links.push(/^https?:/i.test(twitter) ? twitter : `https://twitter.com/${twitter.replace(/^@/, '')}`)
    return links.filter(Boolean)
  }

  function personSchema(hire: HireConfig) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': `${baseUrl}/#person`,
      name: siteConfig.name,
      url: `${baseUrl}/`,
      image: abs(siteConfig.author.avatar),
      jobTitle: 'Photographer',
      description: siteConfig.description,
      sameAs: sameAs(),
      knowsAbout: ['Architecture photography', 'Landscape photography', 'Candid photography', 'Documentary photography'],
      ...(hire.location?.city
        ? {
            homeLocation: {
              '@type': 'Place',
              address: {
                '@type': 'PostalAddress',
                addressLocality: hire.location.city,
                addressRegion: hire.location.region || undefined,
                addressCountry: hire.location.country || undefined,
              },
            },
          }
        : {}),
    }
  }

  function serviceSchema(hire: HireConfig) {
    const city = hire.location?.city
    return {
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      '@id': `${baseUrl}/#service`,
      name: `${siteConfig.name} Photography`,
      url: `${baseUrl}/work`,
      image: abs(siteConfig.author.avatar),
      description: clip(siteConfig.description, 300),
      serviceType: hire.services.map((s) => s.name),
      provider: { '@id': `${baseUrl}/#person` },
      email: hire.email || undefined,
      sameAs: sameAs(),
      ...(city
        ? {
            areaServed: { '@type': 'City', name: city },
            address: {
              '@type': 'PostalAddress',
              addressLocality: city,
              addressRegion: hire.location?.region || undefined,
              addressCountry: hire.location?.country || undefined,
            },
          }
        : {}),
    }
  }

  function imageSchema(photo: PhotoManifestItem, name: string, pageUrl: string) {
    const where = photoPlace(photo)
    const year = new Date(photo.dateTaken).getFullYear()
    const usage = siteConfig.social?.usage?.trim()
    return {
      '@context': 'https://schema.org',
      '@type': 'ImageObject',
      name,
      description: photoDescription(photo, name),
      url: pageUrl,
      contentUrl: pickImageUrl(photo),
      thumbnailUrl: abs(photo.thumbnailUrl),
      width: photo.width || undefined,
      height: photo.height || undefined,
      dateCreated: isoDate(photo.dateTaken),
      keywords: (photo.tags || []).join(', ') || undefined,
      creator: { '@type': 'Person', '@id': `${baseUrl}/#person`, name: siteConfig.name, url: `${baseUrl}/` },
      creditText: siteConfig.name,
      copyrightNotice: Number.isNaN(year) ? `© ${siteConfig.name}` : `© ${year} ${siteConfig.name}`,
      license: usage || undefined,
      acquireLicensePage: `${baseUrl}/work`,
      ...(where ? { contentLocation: { '@type': 'Place', name: where } } : {}),
    }
  }

  function breadcrumb(items: [string, string][]) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
    }
  }

  // ------------------------------------------------------------ HTML output

  function renderPage(template: string, meta: PageMeta, body: string): string {
    const strip
      = /<title>[\s\S]*?<\/title>|<link\b[^>]*\brel=["']?canonical["']?[^>]*>|<meta\b[^>]*?\b(?:name|property)=["']?(?:og:[\w:.-]+|twitter:[\w:.-]+|description|robots)["']?[\s/>][^>]*>/gi

    const head = [
      `<title>${esc(meta.title)}</title>`,
      `<meta name="description" content="${esc(meta.description)}">`,
      `<link rel="canonical" href="${esc(meta.url)}">`,
      `<meta name="robots" content="index, follow, max-image-preview:large">`,
      `<meta property="og:type" content="${meta.ogType}">`,
      `<meta property="og:site_name" content="${esc(siteConfig.name)}">`,
      `<meta property="og:title" content="${esc(meta.title)}">`,
      `<meta property="og:description" content="${esc(meta.description)}">`,
      `<meta property="og:url" content="${esc(meta.url)}">`,
      meta.image ? `<meta property="og:image" content="${esc(meta.image)}">` : '',
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${esc(meta.title)}">`,
      `<meta name="twitter:description" content="${esc(meta.description)}">`,
      meta.image ? `<meta name="twitter:image" content="${esc(meta.image)}">` : '',
      ...meta.jsonLd.map(
        (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`,
      ),
    ].join('\n')

    // Visually hidden, replaced the moment React mounts into #root.
    const seoBlock = `<div id="seo-content" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">${body}</div>`

    return template
      .replace(strip, '')
      .replace(/<\/head>/i, `${head}\n</head>`)
      .replace(/<div id=["']?root["']?>/i, (m) => `${m}${seoBlock}`)
  }

  function writeHtml(file: string, html: string) {
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, html)
  }

  function nav(): string {
    return `<nav><a href="/">Gallery</a> <a href="/work">Work together</a></nav>`
  }

  function homeBody(hire: HireConfig, photos: PhotoManifestItem[]): string {
    const latest = [...photos].sort((a, b) => dateMs(b) - dateMs(a)).slice(0, 60)
    const links = latest
      .filter((p) => isSafeId(p.id))
      .map((p) => `<li><a href="/photos/${encodeURIComponent(p.id)}">${esc(photoName(p))}</a></li>`)
      .join('')
    return `<main>${nav()}<h1>${esc(siteConfig.name)}: candid, landscape &amp; architecture photography</h1>`
      + `<p>${esc(siteConfig.description)}</p>`
      + `<p><a href="/work">${esc(hire.headline)}</a></p>`
      + (links ? `<h2>Recent photographs</h2><ul>${links}</ul>` : '')
      + `</main>`
  }

  function hireBody(hire: HireConfig, photos: PhotoManifestItem[]): string {
    const services = hire.services
      .map((s) => `<li><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p></li>`)
      .join('')
    const showcase = pickShowcase(photos)
      .map((p) => `<li><a href="/photos/${encodeURIComponent(p.id)}">${esc(photoName(p))}</a></li>`)
      .join('')
    return `<main>${nav()}<h1>${esc(hire.headline)}</h1><p>${esc(hire.intro)}</p>`
      + `<h2>Services</h2><ul>${services}</ul>`
      + (showcase ? `<h2>Selected work</h2><ul>${showcase}</ul>` : '')
      + `<p><a href="${esc(hire.contactUrl || '/')}">Get in touch</a>${hire.email ? ` or email <a href="mailto:${esc(hire.email)}">${esc(hire.email)}</a>` : ''}</p>`
      + `</main>`
  }

  function rightsBody(hire: HireConfig): string {
    return `<main>${nav()}<h1>Using my photos</h1>`
      + `<p>Unless otherwise stated, photographs by ${esc(siteConfig.name)} are protected by copyright.</p>`
      + `<h2>Use of photographs</h2><p>Photographs may not be copied, reproduced, modified, distributed, published, displayed, sold, or used for commercial purposes without prior written permission.</p>`
      + `<h2>Personal and non-commercial sharing</h2><p>You are welcome to share links to photographs or pages on this website. To repost an actual photograph, please ask for permission first.</p>`
      + `<h2>Licensing and permission</h2><p>For licensing, commercial use, publication or prints, contact ${esc(siteConfig.name)} with the photograph, intended use and distribution details.</p>`
      + (hire.email ? `<p>Email: <a href="mailto:${esc(hire.email)}">${esc(hire.email)}</a></p>` : '')
      + `<p><a href="/work">Working together</a></p></main>`
  }

  function photoBody(
    photo: PhotoManifestItem,
    name: string,
    newer?: PhotoManifestItem,
    older?: PhotoManifestItem,
  ): string {
    const where = photoPlace(photo)
    const date = isoDate(photo.dateTaken)?.slice(0, 10)
    const camera = [photo.exif?.Make, photo.exif?.Model].filter(Boolean).join(' ')
    const tags = (photo.tags || []).map((t) => `<li>${esc(t)}</li>`).join('')
    const link = (p: PhotoManifestItem | undefined, label: string) =>
      p && isSafeId(p.id) ? `<a href="/photos/${encodeURIComponent(p.id)}">${label}: ${esc(photoName(p))}</a> ` : ''
    return `<main>${nav()}<article><h1>${esc(name)}</h1>`
      + `<img src="${esc(photo.thumbnailUrl)}" alt="${esc(name)}"${photo.width ? ` width="${photo.width}" height="${photo.height}"` : ''}>`
      + `<p>${esc(photoDescription(photo, name))}</p>`
      + `<p>Photographed by ${esc(siteConfig.name)}${date ? ` on ${date}` : ''}${where ? ` in ${esc(where)}` : ''}${camera ? ` with a ${esc(camera)}` : ''}.</p>`
      + (tags ? `<ul>${tags}</ul>` : '')
      + `<p>${link(newer, 'Newer')}${link(older, 'Older')}</p>`
      + `<p><a href="/work">Work with ${esc(siteConfig.name)}</a></p></article></main>`
  }

  // Highest rated first, then newest. Used for the hire page's "Selected work".
  function pickShowcase(photos: PhotoManifestItem[], count = 12): PhotoManifestItem[] {
    return [...photos]
      .filter((p) => isSafeId(p.id))
      .sort((a, b) => (b.exif?.Rating ?? 0) - (a.exif?.Rating ?? 0) || dateMs(b) - dateMs(a))
      .slice(0, count)
  }

  function sitemapXml(photos: PhotoManifestItem[]): string {
    const now = new Date().toISOString()
    const urls = [
      `  <url>\n    <loc>${xml(`${baseUrl}/`)}</loc>\n    <lastmod>${now}</lastmod>\n    <priority>1.0</priority>\n  </url>`,
      `  <url>\n    <loc>${xml(`${baseUrl}/work`)}</loc>\n    <lastmod>${now}</lastmod>\n    <priority>0.9</priority>\n  </url>`,
      `  <url>\n    <loc>${xml(`${baseUrl}/photography-rights`)}</loc>\n    <lastmod>${now}</lastmod>\n    <priority>0.4</priority>\n  </url>`,
      ...photos
        .filter((p) => isSafeId(p.id))
        .map((p) => {
          const image = pickImageUrl(p)
          return `  <url>\n    <loc>${xml(`${baseUrl}/photos/${encodeURIComponent(p.id)}`)}</loc>\n`
            + `    <lastmod>${isoDate(p.lastModified) ?? isoDate(p.dateTaken) ?? now}</lastmod>\n`
            + `    <priority>0.7</priority>\n`
            + (image ? `    <image:image>\n      <image:loc>${xml(image)}</image:loc>\n    </image:image>\n` : '')
            + `  </url>`
        }),
    ]
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`
  }
}

function esc(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function xml(value: string): string {
  return esc(value).replace(/'/g, '&apos;')
}

function clip(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}
