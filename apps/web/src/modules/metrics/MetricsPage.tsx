import { GlassButton, LinearBlur } from '@afilmory/ui'
import { clsxm, focusRing } from '@afilmory/utils'
import { useReducedMotion } from 'motion/react'
import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { siteConfig } from '~/config'

import type { MetricsData } from './insights'
import { ColorSection } from './sections/Color'
import { GearSection } from './sections/Gear'
import { HighlightsSection } from './sections/Highlights'
import { HowSection } from './sections/How'
import { PlacesSection } from './sections/Places'
import { PlaySection } from './sections/Play'
import { SubjectsSection } from './sections/Subjects'
import { WhenSection } from './sections/When'
import { YearsSection } from './sections/Years'

const NAV = [
  { id: 'highlights', key: 'metrics.nav.highlights' },
  { id: 'years', key: 'metrics.nav.years' },
  { id: 'when', key: 'metrics.nav.when' },
  { id: 'how', key: 'metrics.nav.how' },
  { id: 'gear', key: 'metrics.nav.gear' },
  { id: 'places', key: 'metrics.nav.places' },
  { id: 'color', key: 'metrics.nav.color' },
  { id: 'subjects', key: 'metrics.nav.subjects' },
  { id: 'play', key: 'metrics.nav.play' },
] as const

// How many pixels of scrolling it takes for the header to go from fully open to fully collapsed.
const COLLAPSE_DISTANCE = 140
// Breathing room between the bottom of the sticky header and the top of a section after a nav tap.
const SECTION_GAP = 16

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export const MetricsPage = ({ data }: { data: MetricsData }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const scroller = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLDivElement>(null)
  const intro = useRef<HTMLDivElement>(null)
  const introInner = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const introHeight = useRef(0)
  const progress = useRef(0)
  const [active, setActive] = useState<string>('highlights')
  const owner = siteConfig.author.name
  const hasPlaces = data.extras.travel.geoTagged > 0 || data.metrics.states.length > 0
  const hasSubjects = data.extras.tags.top.length > 0
  const navItems = NAV.filter(item => (item.id === 'places' ? hasPlaces : item.id === 'subjects' ? hasSubjects : true))

  // Writes the collapse progress (0 = open, 1 = collapsed) straight to the DOM. The title size and the
  // spacing are driven by the --p custom property in CSS; the intro paragraph is clipped and faded here.
  // Doing this outside React state means scrolling never re-renders the page.
  const applyProgress = useCallback((value: number) => {
    const p = clamp01(value)
    progress.current = p
    header.current?.style.setProperty('--p', p.toFixed(3))
    const el = intro.current
    if (el) {
      el.style.maxHeight = p === 0 ? '' : `${Math.round(introHeight.current * (1 - p))}px`
      el.style.opacity = String(clamp01(1 - p * 1.6))
    }
  }, [])

  // Scroll-spy and header collapse share one scroll listener.
  // The current section is the last one whose top has passed a line below the sticky header (and at
  // least a quarter of the way down the screen). It is based on position rather than on sections
  // crossing a thin band, so it is right at the very top (Highlights), at the very bottom (the last
  // section) and after fast flicks.
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const root = scroller.current
      const scrolling = root && root.scrollHeight > root.clientHeight ? root : document.scrollingElement

      applyProgress((scrolling?.scrollTop ?? 0) / COLLAPSE_DISTANCE)

      const headerBottom = header.current?.getBoundingClientRect().bottom ?? 0
      const probe = Math.max(headerBottom + 40, window.innerHeight * 0.25)
      let current = navItems[0]?.id ?? 'highlights'
      for (const item of navItems) {
        const el = document.getElementById(item.id)
        if (el && el.getBoundingClientRect().top <= probe) {
          current = item.id
        }
      }
      if (scrolling && scrolling.scrollTop > 0 && scrolling.scrollHeight - scrolling.scrollTop - scrolling.clientHeight < 8) {
        current = navItems.at(-1)?.id ?? current
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) {
        frame = requestAnimationFrame(update)
      }
    }

    // The intro's full height is needed to collapse it smoothly. Measure the unclipped inner box.
    const inner = introInner.current
    const observer = inner
      ? new ResizeObserver(() => {
          introHeight.current = inner.offsetHeight
          onScroll()
        })
      : null
    if (inner) {
      introHeight.current = inner.offsetHeight
      observer?.observe(inner)
    }

    update()
    // Scroll events do not bubble, so listen in the capture phase to hear whichever element scrolls
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onScroll)
      observer?.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [navItems.length, applyProgress])

  // The nav is always on screen now and can scroll sideways on a phone, so keep the active pill centred.
  useEffect(() => {
    const nav = navRef.current
    const pill = nav?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!nav || !pill || nav.scrollWidth <= nav.clientWidth) return
    nav.scrollTo({
      left: pill.offsetLeft - (nav.clientWidth - pill.offsetWidth) / 2,
      behavior: reduce ? 'auto' : 'smooth',
    })
  }, [active, reduce])

  const goTo = (id: string) => {
    const root = scroller.current
    const target = document.getElementById(id)
    const bar = header.current
    if (!target) return
    if (!root || !bar) {
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      return
    }
    // The header shrinks as the page scrolls, which pulls everything below it upward. So work out where
    // the section will sit once the header is fully collapsed, and scroll to that. Measure with the
    // header collapsed, then put it back before the browser paints.
    const current = progress.current
    applyProgress(1)
    const collapsedHeight = bar.offsetHeight
    const rootTop = root.getBoundingClientRect().top
    const top = target.getBoundingClientRect().top - rootTop + root.scrollTop - collapsedHeight - SECTION_GAP
    applyProgress(current)
    root.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' })
  }

  const back = () => {
    startTransition(() => {
      navigate('/')
    })
  }
  const backLabel = t('metrics.back')

  return (
    // The page is its own full-screen scroller (like the Work and Photography Rights pages). The app shell
    // around it is overflow-hidden with no fixed height below the lg breakpoint, which stops a sticky
    // header from ever sticking; a fixed scroller works at every width.
    // overflow-anchor is off because the header changes height while scrolling; scroll anchoring would
    // fight that and make the collapse jitter.
    <div ref={scroller} className="bg-background text-text fixed inset-0 z-10 overflow-y-auto [overflow-anchor:none]">
      <div
        ref={header}
        className="sticky top-0 z-30 [--title-from:1.875rem] [--title-to:1rem] sm:[--title-from:2.25rem] sm:[--title-to:1.125rem]"
      >
        <LinearBlur
          className="pointer-events-none absolute inset-x-0 top-0 z-[-1] h-[calc(100%+1.5rem)]"
          tint="var(--color-background)"
          strength={128}
          side="top"
        />
        <div
          className="mx-auto max-w-7xl px-4 pb-3 md:px-8"
          // 6rem of top padding when open (clears the back button and matches the old layout), 1.5rem when collapsed
          style={{ paddingTop: 'calc(6rem - 4.5rem * var(--p, 0))' }}
        >
          <h1
            className="text-text mx-auto px-14 text-center leading-tight font-bold tracking-tight text-balance"
            style={{ fontSize: 'calc(var(--title-from) - (var(--title-from) - var(--title-to)) * var(--p, 0))' }}
          >
            {t('metrics.hero.title', { name: owner })}
          </h1>

          <div ref={intro} className="overflow-hidden">
            <div ref={introInner} className="pt-4">
              <p className="text-text-secondary mx-auto max-w-2xl text-center text-base leading-relaxed">
                {t('metrics.hero.intro', { name: owner })}
              </p>
            </div>
          </div>

          <nav
            ref={navRef}
            aria-label={t('metrics.nav.label')}
            className="bg-material-medium border-accent/20 mx-auto flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border p-1 backdrop-blur-2xl"
            style={{ marginTop: 'calc(2.5rem - 1.75rem * var(--p, 0))' }}
          >
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                aria-current={active === item.id ? 'true' : undefined}
                onClick={() => goTo(item.id)}
                className={clsxm(
                  focusRing,
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200',
                  active === item.id ? 'bg-accent text-white' : 'text-text-secondary hover:text-text',
                )}
              >
                {t(item.key)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* After the header in the DOM so that, at the same z-30, it paints above the header's full-width band */}
      <GlassButton className="fixed top-4 left-4 z-30" onClick={back} title={backLabel} aria-label={backLabel}>
        <i className="i-mingcute-arrow-left-line text-base text-white" aria-hidden="true" />
      </GlassButton>

      <div className="mx-auto max-w-7xl px-4 pt-8 pb-24 md:px-8">
        <div className="space-y-16">
          <HighlightsSection data={data} />
          <YearsSection data={data} />
          <WhenSection data={data} />
          <HowSection data={data} />
          <GearSection data={data} />
          <PlacesSection data={data} />
          <ColorSection data={data} />
          <SubjectsSection data={data} />
          <PlaySection data={data} />
        </div>
      </div>
    </div>
  )
}
