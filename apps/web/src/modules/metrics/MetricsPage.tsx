import { GlassButton } from '@afilmory/ui'
import { clsxm, focusRing } from '@afilmory/utils'
import { useReducedMotion } from 'motion/react'
import { startTransition, useEffect, useRef, useState } from 'react'
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

export const MetricsPage = ({ data }: { data: MetricsData }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<string>('highlights')
  const owner = siteConfig.author.name
  const hasPlaces = data.extras.travel.geoTagged > 0 || data.metrics.states.length > 0
  const hasSubjects = data.extras.tags.top.length > 0
  const navItems = NAV.filter(item => (item.id === 'places' ? hasPlaces : item.id === 'subjects' ? hasSubjects : true))

  // Scroll-spy: the current section is the last one whose top has passed a line a quarter of the way
  // down the screen. It is based on position rather than on sections crossing a thin band, so it is
  // right at the very top (Highlights), at the very bottom (the last section) and after fast flicks.
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      // Sections stop 96px from the top after a nav tap (scroll-mt-24), so the line must sit below that
      const probe = Math.max(window.innerHeight * 0.25, 120)
      let current = navItems[0]?.id ?? 'highlights'
      for (const item of navItems) {
        const el = document.getElementById(item.id)
        if (el && el.getBoundingClientRect().top <= probe) {
          current = item.id
        }
      }
      const root = scroller.current
      const scrolling = root && root.scrollHeight > root.clientHeight ? root : document.scrollingElement
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
    update()
    // Scroll events do not bubble, so listen in the capture phase to hear whichever element scrolls
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [navItems.length])

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  const back = () => {
    startTransition(() => {
      navigate('/')
    })
  }
  const backLabel = t('metrics.back')

  return (
    <div ref={scroller} className="relative h-full overflow-y-auto">
      <GlassButton className="fixed top-4 left-4 z-30" onClick={back} title={backLabel} aria-label={backLabel}>
        <i className="i-mingcute-arrow-left-line text-base text-white" aria-hidden="true" />
      </GlassButton>

      <div className="mx-auto max-w-7xl px-4 pt-24 pb-24 md:px-8">
        <header className="mb-10 text-center">
          <h1 className="text-text text-3xl font-bold tracking-tight sm:text-4xl">{t('metrics.hero.title', { name: owner })}</h1>
          <p className="text-text-secondary mx-auto mt-4 max-w-2xl text-base leading-relaxed">
            {t('metrics.hero.intro', { name: owner })}
          </p>
        </header>

        <nav
          aria-label={t('metrics.nav.label')}
          className="bg-material-medium border-accent/20 sticky top-3 z-30 mx-auto mb-12 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border p-1 backdrop-blur-2xl"
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
