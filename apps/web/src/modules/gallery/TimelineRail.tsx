import clsx from 'clsx'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GALLERY_TIMELINE_STYLE } from '~/lib/gallery-layout'
import type { PhotoManifest } from '~/types/photo'

interface TimelineGroup {
  /** Index of the first photo of this month in the photos array. */
  firstIndex: number
  year: number
  month: number
}

function getPhotoDate(photo: PhotoManifest): Date {
  const raw = photo.exif?.DateTimeOriginal as unknown as string | undefined
  if (raw) {
    // EXIF dates look like "YYYY:MM:DD HH:mm:ss"
    const date = new Date(raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'))
    if (!Number.isNaN(date.getTime())) return date
  }
  return new Date(photo.lastModified)
}

/** Groups photos (in their displayed order) into runs of the same year and month. */
export function buildTimelineGroups(photos: PhotoManifest[]): TimelineGroup[] {
  const groups: TimelineGroup[] = []
  for (const [index, photo] of photos.entries()) {
    const date = getPhotoDate(photo)
    const year = date.getFullYear()
    const month = date.getMonth()
    const last = groups.at(-1)
    if (!last || last.year !== year || last.month !== month) {
      groups.push({ firstIndex: index, year, month })
    }
  }
  return groups
}

interface TimelineRailProps {
  photos: PhotoManifest[]
  /** Index (in `photos`) of the first photo currently on screen. */
  currentIndex: number
  onJump: (photoIndex: number) => void
}

/**
 * Minimal timeline with one tick per month. Click or drag along it to jump to that month.
 * The look is chosen with GALLERY_TIMELINE_STYLE in lib/gallery-layout.ts.
 */
export const TimelineRail = ({ photos, currentIndex, onJump }: TimelineRailProps) => {
  const { i18n } = useTranslation()
  const groups = useMemo(() => buildTimelineGroups(photos), [photos])
  const railRef = useRef<HTMLDivElement>(null)
  const lastJumped = useRef(-1)
  const [hoverGroup, setHoverGroup] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const isMeter = GALLERY_TIMELINE_STYLE === 'meter'

  const activeGroup = useMemo(() => {
    let found = 0
    for (const [i, group] of groups.entries()) {
      if (group.firstIndex <= currentIndex) found = i
      else break
    }
    return found
  }, [groups, currentIndex])

  // Meter style: which years get a number. Skip some on very long timelines so the numbers never touch.
  const yearLabelEvery = useMemo(() => {
    const yearStarts = groups.filter((group, i) => i === 0 || groups[i - 1].year !== group.year).length
    const railPx = typeof window === 'undefined' ? 520 : Math.min(window.innerHeight * 0.6, 520)
    const maxLabels = Math.max(1, Math.floor(railPx / 18))
    return Math.max(1, Math.ceil(yearStarts / maxLabels))
  }, [groups])

  if (groups.length < 2) return null

  const groupFromPointer = (clientY: number): number => {
    const rect = railRef.current?.getBoundingClientRect()
    if (!rect || rect.height === 0) return 0
    const ratio = Math.min(0.999, Math.max(0, (clientY - rect.top) / rect.height))
    return Math.floor(ratio * groups.length)
  }

  const jumpTo = (groupIndex: number) => {
    if (groupIndex === lastJumped.current) return
    lastJumped.current = groupIndex
    onJump(groups[groupIndex].firstIndex)
  }

  const labelFor = (group: TimelineGroup) =>
    new Date(group.year, group.month, 1).toLocaleDateString(i18n.language, { month: 'short', year: 'numeric' })

  const shownGroup = hoverGroup ?? activeGroup

  let yearIndex = -1
  const rows = groups.map((group, i) => {
    const isYearStart = i === 0 || groups[i - 1].year !== group.year
    if (isYearStart) yearIndex += 1
    const showYearNumber = isYearStart && yearIndex % yearLabelEvery === 0
    const isActive = i === activeGroup
    const isHover = i === hoverGroup
    const highlighted = isActive || isHover

    if (isMeter) {
      return (
        <div key={`${group.year}-${group.month}`} className="relative flex min-h-0 flex-1 items-center justify-end pr-2">
          {showYearNumber && (
            <span
              className={clsx(
                'mr-1.5 font-mono text-[9px] leading-none tabular-nums transition-colors duration-150',
                groups[activeGroup].year === group.year ? 'text-white' : 'text-white/50',
              )}
            >
              {group.year}
            </span>
          )}
          <span
            className={clsx(
              'block h-px transition-colors duration-150',
              highlighted ? 'bg-white' : isYearStart ? 'bg-white/70' : 'bg-white/35',
              isYearStart ? 'w-3.5' : 'w-1.5',
            )}
          />
          {/* Needle: points at the current position, like the marker on a camera's exposure scale */}
          {isActive && (
            <span className="absolute top-1/2 right-0 h-[7px] w-2 -translate-y-1/2 [clip-path:polygon(100%_0,0_50%,100%_100%)] bg-white" />
          )}
          {/* Month and year of the tick being pointed at */}
          {(isHover || (dragging && isActive)) && (
            <span className="pointer-events-none absolute top-1/2 right-[22px] -translate-y-1/2 rounded-sm bg-black/70 px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-white tabular-nums backdrop-blur-sm">
              {labelFor(group)}
            </span>
          )}
        </div>
      )
    }

    return (
      <div key={`${group.year}-${group.month}`} className="relative flex min-h-0 flex-1 items-center justify-end">
        <span
          className={clsx(
            'block h-px transition-all duration-150',
            highlighted ? 'bg-white' : isYearStart ? 'bg-white/60' : 'bg-white/30',
            highlighted ? 'w-6' : isYearStart ? 'w-4' : 'w-2',
          )}
        />
      </div>
    )
  })

  return (
    <div className="pointer-events-none fixed top-1/2 right-2 z-30 hidden -translate-y-1/2 lg:block" aria-hidden="true">
      <div className="pointer-events-auto flex items-stretch gap-1.5">
        {/* Ruler style: month and year of the tick being pointed at, or of the current position */}
        {!isMeter && (
          <div className="text-text-secondary flex w-[3.25rem] items-center justify-end font-mono text-[10px] tracking-wide whitespace-nowrap tabular-nums">
            <span className={clsx('transition-opacity', dragging || hoverGroup !== null ? 'opacity-100' : 'opacity-70')}>
              {labelFor(groups[shownGroup])}
            </span>
          </div>
        )}

        <div
          ref={railRef}
          className={clsx(
            'relative flex h-[min(60vh,520px)] cursor-pointer touch-none flex-col select-none',
            isMeter ? 'w-14' : 'w-6',
          )}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            setDragging(true)
            lastJumped.current = -1
            jumpTo(groupFromPointer(event.clientY))
          }}
          onPointerMove={(event) => {
            const group = groupFromPointer(event.clientY)
            setHoverGroup(group)
            if (dragging) jumpTo(group)
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onPointerLeave={() => {
            if (!dragging) setHoverGroup(null)
          }}
        >
          {/* Meter style: the baseline the ticks hang from */}
          {isMeter && <span className="pointer-events-none absolute inset-y-0 right-2 w-px bg-white/25" />}
          {rows}
        </div>
      </div>
    </div>
  )
}
