import clsx from 'clsx'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
 * Minimal ruler-style timeline: one tick per month, a longer tick and a label at each year change.
 * Click or drag along it to jump to that month.
 */
export const TimelineRail = ({ photos, currentIndex, onJump }: TimelineRailProps) => {
  const { i18n } = useTranslation()
  const groups = useMemo(() => buildTimelineGroups(photos), [photos])
  const railRef = useRef<HTMLDivElement>(null)
  const lastJumped = useRef(-1)
  const [hoverGroup, setHoverGroup] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)

  const activeGroup = useMemo(() => {
    let found = 0
    for (const [i, group] of groups.entries()) {
      if (group.firstIndex <= currentIndex) found = i
      else break
    }
    return found
  }, [groups, currentIndex])

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

  return (
    <div className="pointer-events-none fixed top-1/2 right-3 z-30 hidden -translate-y-1/2 lg:block" aria-hidden="true">
      <div className="pointer-events-auto flex items-stretch gap-2">
        {/* Month and year of the tick being pointed at, or of the current position */}
        <div className="text-text-secondary flex w-16 items-center justify-end font-mono text-[10px] tracking-wide tabular-nums">
          <span className={clsx('transition-opacity', dragging || hoverGroup !== null ? 'opacity-100' : 'opacity-70')}>
            {labelFor(groups[shownGroup])}
          </span>
        </div>

        <div
          ref={railRef}
          className="flex h-[min(60vh,520px)] w-8 cursor-pointer touch-none flex-col select-none"
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
          {groups.map((group, i) => {
            const isYearStart = i === 0 || groups[i - 1].year !== group.year
            const isActive = i === activeGroup
            const isHover = i === hoverGroup
            return (
              <div key={`${group.year}-${group.month}`} className="relative flex min-h-0 flex-1 items-center justify-end">
                <span
                  className={clsx(
                    'block h-px transition-all duration-150',
                    isActive || isHover ? 'bg-white' : isYearStart ? 'bg-white/60' : 'bg-white/30',
                    isActive || isHover ? 'w-6' : isYearStart ? 'w-4' : 'w-2',
                  )}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
