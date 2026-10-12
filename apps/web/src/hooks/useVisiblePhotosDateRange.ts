import { useCallback, useRef, useState } from 'react'

import type { PhotoManifest } from '~/types/photo'

interface DateRange {
  startDate: Date | null
  endDate: Date | null
  formattedRange: string
  location?: string
}

interface VisibleRange {
  start: number
  end: number
}

/**
 * Hook to calculate the date range of currently visible photos in the viewport
 * Works with masonry onRender callback
 */
export const useVisiblePhotosDateRange = (_photos: PhotoManifest[]) => {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
    formattedRange: '',
    location: undefined,
  })

  const currentRange = useRef<VisibleRange>({ start: 0, end: 0 })

  const getPhotoDate = useCallback((photo: PhotoManifest): Date => {
    // 优先使用 EXIF 中的拍摄时间
    if (photo.exif?.DateTimeOriginal) {
      const dateStr = photo.exif.DateTimeOriginal as unknown as string
      // EXIF 日期格式通常是 "YYYY:MM:DD HH:mm:ss"
      const formattedDateStr = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
      const date = new Date(formattedDateStr)
      if (!Number.isNaN(date.getTime())) {
        return date
      }
    }

    // 回退到 lastModified
    return new Date(photo.lastModified)
  }, [])
  // Dates in the header are always shown in English, whatever the browser language is.
  const formatDateRange = useCallback((startDate: Date, endDate: Date): string => {
    const month = (date: Date) => date.toLocaleDateString('en-US', { month: 'short' })

    // Same day: "March 4, 2024"
    if (startDate.toDateString() === endDate.toDateString()) {
      return startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    }

    const startYear = startDate.getFullYear()
    const endYear = endDate.getFullYear()

    if (startYear === endYear) {
      // Same month: "Mar 4 - 9, 2024"
      if (startDate.getMonth() === endDate.getMonth()) {
        return `${month(startDate)} ${startDate.getDate()} - ${endDate.getDate()}, ${startYear}`
      }
      // Same year: "Mar - Jun 2024"
      return `${month(startDate)} - ${month(endDate)} ${startYear}`
    }

    // Different years: "Mar 2023 - Jun 2024"
    return `${month(startDate)} ${startYear} - ${month(endDate)} ${endYear}`
  }, [])

  // Use the geocoded location (city, state) of the first visible photo that has one.
  const extractLocation = useCallback((photos: PhotoManifest[]): string | undefined => {
    for (const photo of photos) {
      const location = photo.location
      if (!location) continue
      const place = location.cityName || location.city
      const parts = [place, location.state].filter(Boolean)
      if (parts.length > 0) return parts.join(', ')
      if (location.country) return location.country
    }
    return undefined
  }, [])

  // 计算当前可视范围内照片的日期范围
  const calculateDateRange = useCallback(
    (startIndex: number, endIndex: number, items: any[]) => {
      if (!items || items.length === 0) {
        setDateRange({
          startDate: null,
          endDate: null,
          formattedRange: '',
          location: undefined,
        })
        return
      }

      // 过滤出照片类型的items (排除header等)
      const visiblePhotos = items
        .slice(startIndex, endIndex + 1)
        .filter((item): item is PhotoManifest => item && typeof item === 'object' && 'id' in item)

      if (visiblePhotos.length === 0) {
        setDateRange({
          startDate: null,
          endDate: null,
          formattedRange: '',
          location: undefined,
        })
        return
      }

      // 计算日期范围
      const dates = visiblePhotos.map((photo) => getPhotoDate(photo)).sort((a, b) => a.getTime() - b.getTime())

      const startDate = dates[0]
      const endDate = dates.at(-1)

      if (!startDate || !endDate) {
        setDateRange({
          startDate: null,
          endDate: null,
          formattedRange: '',
          location: undefined,
        })
        return
      }

      const formattedRange = formatDateRange(startDate, endDate)
      const location = extractLocation(visiblePhotos)

      setDateRange({
        startDate,
        endDate,
        formattedRange,
        location,
      })

      // 更新当前范围
      currentRange.current = { start: startIndex, end: endIndex }
    },
    [getPhotoDate, formatDateRange],
  )

  // 用于传递给 masonry 的 onRender 回调
  const handleRender = useCallback(
    (startIndex: number, stopIndex: number, items: any[]) => {
      calculateDateRange(startIndex, stopIndex, items)
    },
    [calculateDateRange],
  )

  return {
    dateRange,
    handleRender,
    currentRange: currentRange.current,
  }
}
