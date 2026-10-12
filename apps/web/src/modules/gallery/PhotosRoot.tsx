import { useScrollViewElement } from '@afilmory/ui'
import clsx from 'clsx'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { gallerySettingAtom } from '~/atoms/app'
import { useFilterAnalytics } from '~/hooks/useAnalyticsEvents'
import { useHasActiveFilters } from '~/hooks/useHasActiveFilters'
import { useContextPhotos } from '~/hooks/usePhotoViewer'
import { useVisiblePhotosDateRange } from '~/hooks/useVisiblePhotosDateRange'
import { trackEvent } from '~/lib/analytics'
import { COLLECTIONS_ENABLED } from '~/lib/collections'
import {
  GALLERY_BATCH_SIZE,
  GALLERY_ROOMY_LAYOUT,
  GALLERY_SHOW_MORE,
  GALLERY_TIMELINE,
} from '~/lib/gallery-layout'

import type { PanelType } from './ActionPanel'
import { ActionPanel } from './ActionPanel'
import { ActiveFiltersHero } from './ActiveFiltersHero'
import { CollectionsNav } from './CollectionsNav'
import { CollectionTiles } from './CollectionTiles'
import { ListView } from './ListView'
import { MasonryView } from './MasonryView'
import { PageFooter } from './PageFooter'
import { PageHeader } from './PageHeader'
import { TimelineRail } from './TimelineRail'

export const PhotosRoot = () => {
  const { viewMode } = useAtomValue(gallerySettingAtom)
  const [showFloatingActions, setShowFloatingActions] = useState(false)

  const allPhotos = useContextPhotos()

  // Google Analytics: what visitors filter for, and how they browse
  useFilterAnalytics()
  const lastViewMode = useRef(viewMode)
  useEffect(() => {
    if (lastViewMode.current === viewMode) return
    lastViewMode.current = viewMode
    trackEvent('view_mode_change', { view_mode: viewMode })
  }, [viewMode])

  // "Show more": only the first batch is shown until the visitor asks for more.
  const [visibleCount, setVisibleCount] = useState(GALLERY_BATCH_SIZE)
  const [firstVisibleIndex, setFirstVisibleIndex] = useState(0)
  const [jumpTarget, setJumpTarget] = useState<number | undefined>()

  // Start again from the first batch whenever the set of photos changes (filters, sorting).
  const photosKey = `${allPhotos.length}:${allPhotos[0]?.id ?? ''}:${allPhotos.at(-1)?.id ?? ''}`
  useEffect(() => {
    setVisibleCount(GALLERY_BATCH_SIZE)
    setFirstVisibleIndex(0)
  }, [photosKey])

  const photos = useMemo(
    () => (GALLERY_SHOW_MORE ? allPhotos.slice(0, visibleCount) : allPhotos),
    [allPhotos, visibleCount],
  )
  const remaining = allPhotos.length - photos.length

  const { dateRange, handleRender: handleDateRender } = useVisiblePhotosDateRange(photos)
  const handleRender = useCallback(
    (startIndex: number, stopIndex: number, items: any[]) => {
      handleDateRender(startIndex, stopIndex, items)
      setFirstVisibleIndex(startIndex)
    },
    [handleDateRender],
  )

  const jumpLogTimer = useRef<number>(undefined)
  const handleJump = useCallback(
    (photoIndex: number) => {
      // Make sure the target month is loaded, then scroll to it.
      setVisibleCount((count) => Math.max(count, photoIndex + GALLERY_BATCH_SIZE))
      setJumpTarget(photoIndex)

      // Google Analytics: log where the visitor ended up, once they stop dragging along the timeline.
      window.clearTimeout(jumpLogTimer.current)
      jumpLogTimer.current = window.setTimeout(() => {
        const taken = allPhotos[photoIndex]?.dateTaken
        trackEvent('timeline_jump', { target_month: typeof taken === 'string' && /^\d{4}-\d{2}/.test(taken) ? taken.slice(0, 7) : undefined })
      }, 800)
    },
    [allPhotos],
  )

  // Clear the jump target afterwards so the same month can be jumped to again.
  useEffect(() => {
    if (jumpTarget === undefined) return
    const timer = window.setTimeout(() => setJumpTarget(undefined), 400)
    return () => window.clearTimeout(timer)
  }, [jumpTarget])
  const scrollElement = useScrollViewElement()

  const [activePanel, setActivePanel] = useState<PanelType | null>(null)

  // 监听滚动，控制浮动组件的显示
  useEffect(() => {
    if (!scrollElement) return

    const handleScroll = () => {
      const { scrollTop } = scrollElement
      setShowFloatingActions(scrollTop > 500)
    }

    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
    }
  }, [scrollElement])

  const hasActiveFilters = useHasActiveFilters()

  return (
    <>
      <PageHeader
        dateRange={dateRange.formattedRange}
        location={dateRange.location}
        showDateRange={showFloatingActions && !!dateRange.formattedRange}
      />

      {hasActiveFilters && <ActiveFiltersHero />}

      <div
        className={clsx(
          '**:select-none!',
          GALLERY_ROOMY_LAYOUT ? 'px-6 lg:px-24' : 'p-1 lg:px-0',
          GALLERY_ROOMY_LAYOUT ? 'pb-28 lg:pb-36' : 'pb-20 lg:pb-24',
          !hasActiveFilters && (GALLERY_ROOMY_LAYOUT ? 'mt-20' : 'mt-12'),
        )}
      >
        {COLLECTIONS_ENABLED && <CollectionsNav />}

        {viewMode === 'list' ? (
          <ListView photos={photos} />
        ) : (
          <MasonryView photos={photos} onRender={handleRender} scrollToIndex={jumpTarget} />
        )}

        {GALLERY_SHOW_MORE && remaining > 0 && (
          <div className="mt-12 flex justify-center">
            <button
              type="button"
              onClick={() => {
                trackEvent('show_more', { photos_shown: Math.min(visibleCount + GALLERY_BATCH_SIZE, allPhotos.length) })
                setVisibleCount((count) => count + GALLERY_BATCH_SIZE)
              }}
              className="text-text-secondary border-white/20 hover:border-white/60 rounded-full border px-6 py-2 text-sm transition-colors duration-200 hover:text-white"
            >
              Show more
              <span className="ml-2 font-mono text-xs tabular-nums opacity-60">
                {remaining} left
              </span>
            </button>
          </div>
        )}

        {COLLECTIONS_ENABLED && <CollectionTiles />}
      </div>

      {GALLERY_TIMELINE && viewMode !== 'list' && (
        <TimelineRail photos={allPhotos} currentIndex={firstVisibleIndex} onJump={handleJump} />
      )}

      <PageFooter />

      <ActionPanel
        open={!!activePanel}
        onOpenChange={(open) => {
          if (!open) {
            setActivePanel(null)
          }
        }}
        type={activePanel}
      />
    </>
  )
}
