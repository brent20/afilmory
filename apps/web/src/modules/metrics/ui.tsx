import { clsxm, focusRing, Spring } from '@afilmory/utils'
import { m, useInView as useMotionInView, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useInView } from 'react-intersection-observer'
import { Link } from 'react-router'

import { formatInt, photoHref } from './format'
import { findPhoto } from './photos'

/* -------------------------------------------------------------------------- */
/*  Section / Card                                                            */
/* -------------------------------------------------------------------------- */

export const Section = ({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  intro?: string
  children: ReactNode
}) => {
  const reduce = useReducedMotion()
  return (
    <m.section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 space-y-5"
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={Spring.presets.smooth}
    >
      <header>
        {eyebrow !== title && (
          <p className="text-text-tertiary text-xs font-medium tracking-wider uppercase">{eyebrow}</p>
        )}
        <h2
          id={`${id}-title`}
          className={clsxm('text-text text-xl font-semibold tracking-tight md:text-2xl', eyebrow !== title && 'mt-1')}
        >
          {title}
        </h2>
        {intro && <p className="text-text-secondary mt-2 max-w-2xl text-sm leading-relaxed">{intro}</p>}
      </header>
      <div className="space-y-5">{children}</div>
    </m.section>
  )
}

export const Card = ({
  title,
  note,
  howTo,
  action,
  children,
  className,
}: {
  title: string
  note?: string
  /** Plain-language explanation of how to read the chart */
  howTo?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) => {
  const { t } = useTranslation()
  return (
    <div className={clsxm('bg-material-medium/40 border-fill-tertiary flex flex-col gap-4 rounded-2xl border p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-text text-sm font-semibold">{title}</h3>
          {note && <p className="text-text-tertiary mt-1 text-xs">{note}</p>}
        </div>
        {action}
      </div>
      {howTo && (
        <p className="text-text-secondary text-xs leading-relaxed">
          <i className="i-mingcute-information-line mr-1 align-[-2px]" aria-hidden="true" />
          <span className="text-text font-medium">
            {t('metrics.howto.label')}
            {' '}
          </span>
          {howTo}
        </p>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export const Segmented = <T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T, label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
}) => (
  <div role="group" aria-label={label} className="bg-fill-quaternary flex shrink-0 rounded-lg p-0.5">
    {options.map(option => (
      <button
        key={option.value}
        type="button"
        aria-pressed={option.value === value}
        onClick={() => onChange(option.value)}
        className={clsxm(
          focusRing,
          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200',
          option.value === value ? 'bg-accent text-white' : 'text-text-secondary hover:text-text',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
)

export const EmptyNote = ({ children }: { children?: ReactNode }) => {
  const { t } = useTranslation()
  return <p className="text-text-tertiary py-6 text-center text-sm">{children ?? t('metrics.empty')}</p>
}

/* -------------------------------------------------------------------------- */
/*  Readout: what a tapped / hovered mark says (touch has no hover)           */
/* -------------------------------------------------------------------------- */

export const ReadoutLine = ({ text, idle }: { text: string, idle?: string }) => (
  <p aria-live="polite" className="text-text-secondary min-h-5 pt-1 text-center text-xs tabular-nums">
    {text || <span className="text-text-quaternary">{idle}</span>}
  </p>
)

/* -------------------------------------------------------------------------- */
/*  Count-up                                                                  */
/* -------------------------------------------------------------------------- */

export const CountUp = ({ value, format = formatInt }: { value: number, format?: (n: number) => string }) => {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useMotionInView(ref, { once: true })
  const canAnimate = !reduce && typeof requestAnimationFrame === 'function'
  const [shown, setShown] = useState(canAnimate ? 0 : value)

  useEffect(() => {
    if (!canAnimate) {
      setShown(value)
      return
    }
    if (!inView) {
      return
    }
    const start = performance.now()
    const duration = 900
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      setShown(value * (1 - (1 - progress) ** 3))
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [canAnimate, inView, value])

  return (
    <span ref={ref}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Photos                                                                    */
/* -------------------------------------------------------------------------- */

export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden="true" className={clsxm('bg-fill-quaternary animate-pulse rounded-2xl', className)} />
)

/** A photo that links to its page in the gallery */
export const PhotoThumb = ({ id, className }: { id: string, className?: string }) => {
  const photo = findPhoto(id)
  if (!photo) {
    return null
  }
  return (
    <Link
      to={photoHref(id)}
      className={clsxm(
        focusRing,
        'focus-visible:outline-accent bg-fill-secondary block overflow-hidden rounded-xl border border-white/10',
        className,
      )}
    >
      <img src={photo.thumbnailUrl} alt={photo.title} loading="lazy" className="size-full object-cover" />
    </Link>
  )
}

/**
 * A big number with a label, and optionally the photo it came from.
 * `href` makes the value an ordinary link (used for camera and lens names that open the filtered gallery).
 */
export const StatTile = ({
  label,
  value,
  hint,
  photoId,
  href,
  count,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  photoId?: string | null
  href?: string | null
  /** When set, `value` is animated as a number */
  count?: number
}) => {
  const photo = findPhoto(photoId)
  const body = count === undefined ? value : <CountUp value={count} />
  return (
    <div className="bg-material-medium/40 border-fill-tertiary relative flex min-w-0 flex-col items-start gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center">
      <div className="flex w-full min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-text-tertiary text-[11px] font-semibold tracking-[0.14em] break-words uppercase">{label}</span>
        <span className="text-text text-xl leading-tight font-semibold tracking-tight break-words tabular-nums md:text-2xl">
          {href ? (
            <a href={href} className={clsxm(focusRing, 'hover:text-accent underline-offset-4 hover:underline')}>
              {body}
            </a>
          ) : (
            body
          )}
        </span>
        {hint && <span className="text-text-secondary text-xs break-words">{hint}</span>}
      </div>
      {photo && photoId && <PhotoThumb id={photoId} className="size-14 shrink-0" />}
    </div>
  )
}

/** A superlative: a photo with a caption on top ("Widest shot: 16mm") */
export const FeatureTile = ({
  photoId,
  label,
  value,
  detail,
}: {
  photoId: string
  label: string
  value: string
  detail?: string
}) => {
  const photo = findPhoto(photoId)
  if (!photo) {
    return null
  }
  return (
    <Link
      to={photoHref(photoId)}
      className={clsxm(
        focusRing,
        'focus-visible:outline-accent group bg-fill-secondary relative block aspect-[4/5] overflow-hidden rounded-2xl border border-white/10',
      )}
    >
      <img
        src={photo.thumbnailUrl}
        alt={photo.title}
        loading="lazy"
        className="size-full object-cover duration-200 group-hover:opacity-90"
      />
      <span className="bg-linear-to-t absolute inset-x-0 bottom-0 flex flex-col gap-0.5 from-black/80 to-transparent p-3 pt-10 text-white">
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase opacity-80">{label}</span>
        <span className="text-lg font-semibold tabular-nums">{value}</span>
        {detail && <span className="truncate text-[11px] opacity-80">{detail}</span>}
      </span>
    </Link>
  )
}

/* -------------------------------------------------------------------------- */
/*  Lazy blocks and drawers                                                   */
/* -------------------------------------------------------------------------- */

/** Renders its children only once it is near the viewport, so heavy charts do not slow the first paint */
export const LazyBlock = ({ children, minHeight = 240 }: { children: ReactNode, minHeight?: number }) => {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: '800px 0px', fallbackInView: true })
  return (
    <div ref={ref} style={inView ? undefined : { minHeight }}>
      {inView ? children : <Skeleton className="w-full" />}
    </div>
  )
}

/** A collapsed "for the gear nerds" panel. Children are not rendered until it has been opened once. */
export const Drawer = ({
  title,
  summary,
  children,
}: {
  title: string
  summary: string
  children: ReactNode
}) => {
  const [open, setOpen] = useState(false)
  const [everOpened, setEverOpened] = useState(false)
  return (
    <div className="bg-material-medium/40 border-fill-tertiary rounded-2xl border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(v => !v)
          setEverOpened(true)
        }}
        className={clsxm(focusRing, 'flex w-full items-center justify-between gap-4 rounded-2xl p-5 text-left')}
      >
        <span className="min-w-0">
          <span className="text-text block text-base font-semibold">{title}</span>
          <span className="text-text-secondary mt-0.5 block text-xs">{summary}</span>
        </span>
        <i
          className={clsxm(
            'i-mingcute-down-line text-text-secondary shrink-0 text-xl transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      <div hidden={!open} className="space-y-5 px-5 pb-5">
        {everOpened && children}
      </div>
    </div>
  )
}
