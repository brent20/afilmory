import { LinearDivider } from '@afilmory/ui'
import { clsxm, focusRing } from '@afilmory/utils'
import { Link } from 'react-router'

import { siteConfig } from '~/config'
import { useScrollGalleryToTop } from '~/hooks/useScrollGalleryToTop'
import { GALLERY_ROOMY_LAYOUT } from '~/lib/gallery-layout'

const linkClassName = clsxm(focusRing, 'text-text-tertiary hover:text-text rounded-sm transition-colors duration-200')

export const GalleryFooter = () => {
  const contactUrl = siteConfig.social?.contact?.trim() || siteConfig.author.url
  const scrollToTop = useScrollGalleryToTop()

  return (
    <footer className={clsxm('pb-safe mt-24 lg:mt-32', !GALLERY_ROOMY_LAYOUT && 'px-3 lg:px-8')}>
      <LinearDivider />
      <div className="flex flex-col-reverse items-center gap-4 pt-8 text-xs sm:flex-row sm:justify-between">
        <p className="text-text-tertiary">© {new Date().getFullYear()} Brent Saltzman. All rights reserved.</p>
        <nav aria-label="Footer" className="flex items-center gap-6">
          {contactUrl && (
            <Link to="/work" className={linkClassName}>
              Work together
            </Link>
          )}
          <Link to="/photography-rights" className={linkClassName}>
            Photo usage info
          </Link>
          <button
            type="button"
            onClick={scrollToTop}
            className={clsxm(linkClassName, 'inline-flex items-center gap-1')}
          >
            Back to top
            <i className="i-mingcute-arrow-up-line text-sm" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </footer>
  )
}
