import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import type { PhotoRecord } from '~/lib/metrics'
import type { RollPreset } from '~/lib/metrics-extras'
import { photosOnThisDay, pickRandom, presetCounts, ROLL_PRESETS, settingsLine } from '~/lib/metrics-extras'

import { photoHref } from '../format'
import type { MetricsData } from '../insights'
import { findPhoto } from '../photos'
import { Card, EmptyNote, PhotoThumb, Section } from '../ui'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Day-of-month counts, using a leap year so February 29 is reachable */
const shiftDay = (month: number, day: number, delta: number) => {
  const d = new Date(Date.UTC(2024, month - 1, day + delta))
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

const OnThisDay = ({ records }: { records: PhotoRecord[] }) => {
  const { t } = useTranslation()
  const [today] = useState(() => new Date())
  const [date, setDate] = useState({ month: today.getMonth() + 1, day: today.getDate() })
  const found = useMemo(
    () => photosOnThisDay(records, date.month, date.day, today.getFullYear(), 6),
    [records, date, today],
  )
  const buttonClass
    = 'bg-fill-quaternary text-text-secondary hover:text-text hover:bg-fill-tertiary rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-200'

  return (
    <Card
      title={t('metrics.play.on_this_day')}
      howTo={t('metrics.play.on_this_day_how')}
      action={(
        <div className="flex gap-2">
          <button type="button" className={buttonClass} onClick={() => setDate(d => shiftDay(d.month, d.day, -1))}>
            {t('metrics.play.previous_day')}
          </button>
          <button type="button" className={buttonClass} onClick={() => setDate(d => shiftDay(d.month, d.day, 1))}>
            {t('metrics.play.next_day')}
          </button>
        </div>
      )}
    >
      <p className="text-text mb-3 text-xl font-semibold tracking-tight">{`${MONTH_NAMES[date.month - 1]} ${date.day}`}</p>
      {found.length === 0 ? (
        <EmptyNote>{t('metrics.play.on_this_day_empty')}</EmptyNote>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {found.map(item => (
            <li key={item.photoId} className="space-y-1">
              <PhotoThumb id={item.photoId} className="aspect-[4/5] w-full" />
              <p className="text-text-secondary text-center font-mono text-xs">{item.year}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const Roller = ({ records }: { records: PhotoRecord[] }) => {
  const { t } = useTranslation()
  const counts = useMemo(() => presetCounts(records), [records])
  const [preset, setPreset] = useState<RollPreset>('any')
  const [picked, setPicked] = useState<PhotoRecord | null>(null)
  const photo = findPhoto(picked?.id)

  const roll = (next: RollPreset) => setPicked(pickRandom(records, next, Math.random, picked?.id))
  const presetLabel = (p: RollPreset) => t(PRESET_KEYS[p])

  return (
    <Card title={t('metrics.play.roll')} howTo={t('metrics.play.roll_how')}>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('metrics.play.roll')}>
        {ROLL_PRESETS.map(p => (
          <button
            key={p}
            type="button"
            disabled={counts[p] === 0}
            aria-pressed={p === preset}
            onClick={() => {
              setPreset(p)
              roll(p)
            }}
            className={
              p === preset
                ? 'bg-accent rounded-full px-3 py-1.5 text-xs font-medium text-white'
                : 'bg-fill-quaternary text-text-secondary hover:text-text rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 disabled:opacity-40'
            }
          >
            {presetLabel(p)}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => roll(preset)}
        className="bg-accent mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white"
      >
        <i className="i-mingcute-shuffle-line" aria-hidden="true" />
        {t('metrics.play.roll_button')}
      </button>
      {picked && photo && (
        <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row">
          <Link to={photoHref(picked.id)} className="block w-full max-w-xs overflow-hidden rounded-xl border border-white/10">
            <img src={photo.thumbnailUrl} alt={photo.title} className="w-full object-cover" />
          </Link>
          <div className="space-y-1">
            <p className="text-text text-base font-semibold">{photo.title}</p>
            <p className="text-text-secondary font-mono text-xs">{settingsLine(picked) || t('metrics.play.no_settings')}</p>
            {picked.camera && <p className="text-text-tertiary text-xs">{picked.camera}</p>}
          </div>
        </div>
      )}
    </Card>
  )
}

const PRESET_KEYS = {
  any: 'metrics.play.preset.any',
  wideOpen: 'metrics.play.preset.wide_open',
  highIso: 'metrics.play.preset.high_iso',
  longExposure: 'metrics.play.preset.long_exposure',
  tele: 'metrics.play.preset.tele',
  golden: 'metrics.play.preset.golden',
  night: 'metrics.play.preset.night',
} as const

export const PlaySection = ({ data }: { data: MetricsData }) => {
  const { t } = useTranslation()
  return (
    <Section id="play" eyebrow={t('metrics.nav.play')} title={t('metrics.play.title')} intro={t('metrics.play.intro')}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <OnThisDay records={data.metrics.records} />
        <Roller records={data.metrics.records} />
      </div>
    </Section>
  )
}
