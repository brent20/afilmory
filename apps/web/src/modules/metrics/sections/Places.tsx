import { useTranslation } from 'react-i18next'

import { BarList, ColumnChart } from '../charts'
import { formatFeet, formatMiles } from '../format'
import type { MetricsData } from '../insights'
import { Card, Section, StatTile } from '../ui'

export const PlacesSection = ({ data }: { data: MetricsData }) => {
  const { t } = useTranslation()
  const { metrics, extras } = data
  const { travel } = extras
  if (travel.geoTagged === 0 && metrics.states.length === 0) {
    return null
  }
  const newPlaces = travel.newPlacesPerYear
  const latitudeLabel = (lat: number) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`

  return (
    <Section id="places" eyebrow={t('metrics.nav.places')} title={t('metrics.places.title')} intro={t('metrics.places.intro')}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {travel.home && <StatTile label={t('metrics.places.home')} value={travel.home.place} hint={t('metrics.places.home_hint')} />}
        {travel.farthest && (
          <StatTile
            label={t('metrics.places.farthest')}
            value={formatMiles(travel.farthest.miles)}
            hint={travel.farthest.place ?? undefined}
            photoId={travel.farthest.photoId}
          />
        )}
        {travel.highest && (
          <StatTile
            label={t('metrics.places.highest')}
            value={formatFeet(travel.highest.feet)}
            hint={travel.highest.place ?? undefined}
            photoId={travel.highest.photoId}
          />
        )}
        {travel.northernmost && (
          <StatTile
            label={t('metrics.places.north')}
            value={latitudeLabel(travel.northernmost.lat)}
            hint={travel.northernmost.place ?? undefined}
            photoId={travel.northernmost.photoId}
          />
        )}
        {travel.southernmost && (
          <StatTile
            label={t('metrics.places.south')}
            value={latitudeLabel(travel.southernmost.lat)}
            hint={travel.southernmost.place ?? undefined}
            photoId={travel.southernmost.photoId}
          />
        )}
        {travel.placeCount > 0 && <StatTile label={t('metrics.places.count')} value="" count={travel.placeCount} />}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {travel.topPlaces.length > 0 && (
          <Card title={t('metrics.places.top')} howTo={t('metrics.places.top_how')}>
            <BarList items={travel.topPlaces} label={t('metrics.places.top')} />
          </Card>
        )}
        {metrics.states.length > 1 && (
          <Card title={t('metrics.places.states')}>
            <BarList items={metrics.states} limit={10} label={t('metrics.places.states')} />
          </Card>
        )}
        {metrics.countries.length > 1 && (
          <Card title={t('metrics.places.countries')}>
            <BarList items={metrics.countries} limit={10} label={t('metrics.places.countries')} />
          </Card>
        )}
      </div>

      {newPlaces.years.length > 1 && (
        <Card title={t('metrics.places.new_per_year')} howTo={t('metrics.places.new_per_year_how')}>
          <ColumnChart
            values={newPlaces.counts}
            labels={newPlaces.years.map(y => (newPlaces.years.length > 12 ? String(y).slice(-2) : String(y)))}
            titles={newPlaces.years.map(String)}
            labelEvery={newPlaces.years.length > 16 ? 3 : newPlaces.years.length > 9 ? 2 : 1}
            label={t('metrics.places.new_per_year')}
            showValues
          />
        </Card>
      )}
    </Section>
  )
}
