import { useAtomValue } from 'jotai'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { gallerySettingAtom } from '~/atoms/app'
import { useMobile } from '~/hooks/useMobile'
import { GALLERY_GUTTER, GALLERY_SIDE_PADDING } from '~/lib/gallery-layout'
import type { PhotoManifest } from '~/types/photo'

import type { MasonryRef } from './Masonic'
import { Masonry } from './Masonic'
import { MasonryPhotoItem } from './MasonryPhotoItem'

const COLUMN_WIDTH_CONFIG = {
  auto: {
    mobile: 150,
    desktop: 250,
    maxColumns: 8,
  },
  min: {
    mobile: 120,
    desktop: 200,
  },
  max: {
    mobile: 250,
    desktop: 500,
  },
}

interface MasonryViewProps {
  photos: PhotoManifest[]
  onRender?: (startIndex: number, stopIndex: number, items: any[]) => void
  scrollToIndex?: number
}

export const MasonryView = ({ photos, onRender, scrollToIndex }: MasonryViewProps) => {
  const { columns } = useAtomValue(gallerySettingAtom)
  const [containerWidth, setContainerWidth] = useState(0)
  const masonryRef = useRef<MasonryRef>(null)
  const isMobile = useMobile()

  // 监听容器宽度变化
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

  // 动态计算列宽
  const columnWidth = useMemo(() => {
    const { auto, min, max } = COLUMN_WIDTH_CONFIG
    const gutter = isMobile ? GALLERY_GUTTER.mobile : GALLERY_GUTTER.desktop // gap between columns
    const sidePadding = isMobile ? GALLERY_SIDE_PADDING.mobile : GALLERY_SIDE_PADDING.desktop
    const availableWidth = containerWidth - sidePadding

    if (columns === 'auto') {
      const autoWidth = isMobile ? auto.mobile : auto.desktop
      if (!isMobile) {
        const { maxColumns } = auto
        // 当屏幕宽度超过一定阈值时，通过计算动态列宽来限制最大列数
        const colCount = Math.floor((availableWidth + gutter) / (autoWidth + gutter))

        if (colCount > maxColumns) {
          return (availableWidth - (maxColumns - 1) * gutter) / maxColumns
        }
      }

      return autoWidth
    }

    // 自定义列数模式：根据容器宽度和列数计算列宽
    const calculatedWidth = (availableWidth - (columns - 1) * gutter) / columns

    // 根据设备类型设置最小和最大列宽
    const minWidth = isMobile ? min.mobile : min.desktop
    const maxWidth = isMobile ? max.mobile : max.desktop

    return Math.max(Math.min(calculatedWidth, maxWidth), minWidth)
  }, [isMobile, columns, containerWidth])

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
