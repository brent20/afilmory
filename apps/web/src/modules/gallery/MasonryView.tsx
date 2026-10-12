import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useMobile } from '~/hooks/useMobile'
import { GALLERY_GUTTER, GALLERY_SIDE_PADDING } from '~/lib/gallery-layout'
import type { PhotoManifest } from '~/types/photo'

import type { MasonryRef } from './Masonic'
import { Masonry } from './Masonic'
import { MasonryPhotoItem } from './MasonryPhotoItem'

const AUTO_COLUMN_CONFIG = {
  mobile: 150,
  desktop: 250,
  maxColumns: 8,
}

interface MasonryViewProps {
  photos: PhotoManifest[]
  onRender?: (startIndex: number, stopIndex: number, items: any[]) => void
  scrollToIndex?: number
}

export const MasonryView = ({ photos, onRender, scrollToIndex }: MasonryViewProps) => {
  const [containerWidth, setContainerWidth] = useState(0)
  const masonryRef = useRef<MasonryRef>(null)
  const isMobile = useMobile()

  // Track the window width
  useEffect(() => {
    const updateContainerWidth = () => {
      setContainerWidth(window.innerWidth)
    }

    updateContainerWidth()
    window.addEventListener('resize', updateContainerWidth)

    return () => {
      window.removeEventListener('resize', updateContainerWidth)
    }
  }, [])

  // Column width is always automatic
  const columnWidth = useMemo(() => {
    const gutter = isMobile ? GALLERY_GUTTER.mobile : GALLERY_GUTTER.desktop
    const sidePadding = isMobile ? GALLERY_SIDE_PADDING.mobile : GALLERY_SIDE_PADDING.desktop
    const availableWidth = containerWidth - sidePadding

    const autoWidth = isMobile ? AUTO_COLUMN_CONFIG.mobile : AUTO_COLUMN_CONFIG.desktop
    if (!isMobile) {
      const { maxColumns } = AUTO_COLUMN_CONFIG
      // On very wide screens, widen the columns so there are never more than maxColumns
      const colCount = Math.floor((availableWidth + gutter) / (autoWidth + gutter))

      if (colCount > maxColumns) {
        return (availableWidth - (maxColumns - 1) * gutter) / maxColumns
      }
    }

    return autoWidth
  }, [isMobile, containerWidth])

  const gutter = isMobile ? GALLERY_GUTTER.mobile : GALLERY_GUTTER.desktop

  return (
    <Masonry<PhotoManifest>
      ref={masonryRef}
      items={photos}
      render={useCallback(
        (props) => (
          <MasonryItem {...props} />
        ),
        [],
      )}
      onRender={onRender}
      columnWidth={columnWidth}
      columnGutter={gutter}
      rowGutter={gutter}
      scrollToIndex={scrollToIndex}
      itemHeightEstimate={400}
      itemKey={useCallback((data, _index) => {
        return data.id
      }, [])}
    />
  )
}

const MasonryItem = memo(MasonryPhotoItem)
