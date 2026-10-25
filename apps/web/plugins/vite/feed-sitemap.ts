import { readFileSync } from 'node:fs'

import type { PhotoManifestItem } from '@afilmory/builder'
import { tsImport } from 'tsx/esm/api'
import type { Plugin } from 'vite'

import type { SiteConfig } from '../../../../site.config'
import { MANIFEST_PATH } from './__internal__/constants'

const { generateRSSFeed } = await tsImport('@afilmory/utils', import.meta.url)

/**
 * Emits feed.xml (RSS).
 *
 * sitemap.xml and robots.txt are written by the SEO plugin (./seo.ts), which knows about
 * every page (home, /work, /photography-rights and each photo). They used to be generated
 * here as well, but this plugin's copy was always overwritten, so it was removed.
 */
export function createFeedSitemapPlugin(siteConfig: SiteConfig): Plugin {
  return {
    name: 'feed-sitemap-generator',
    apply: 'build',
    generateBundle() {
      try {
        const photosData: PhotoManifestItem[] = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')).data

        // Sort photos by date taken (newest first)
        const sortedPhotos = photosData.sort(
          (a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime(),
        )

        // Generate RSS feed
        const rssXml = generateRSSFeed(sortedPhotos, siteConfig)

        // Emit RSS feed
        this.emitFile({
          type: 'asset',
          fileName: 'feed.xml',
          source: rssXml,
        })

        console.info(`Generated RSS feed with ${sortedPhotos.length} photos`)
      } catch (error) {
        console.error('Error generating RSS feed:', error)
      }
    },
  }
}
