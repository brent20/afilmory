import { useTranslation } from 'react-i18next'

import { BarList, StackedColumns } from '../charts'
import type { MetricsData } from '../insights'
import { Card, Section } from '../ui'

export const SubjectsSection = ({ data }: { data: MetricsData }) => {
  const { t } = useTranslation()
  const { tags } = data.extras
  if (tags.top.length === 0) {
    return null
  }
  return (
    <Section id="subjects" eyebrow={t('metrics.nav.subjects')} title={t('metrics.subjects.title')} intro={t('metrics.subjects.intro')}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title={t('metrics.subjects.top')}>
          <BarList items={tags.top} label={t('metrics.subjects.top')} />
        </Card>
        {tags.byYear.series.length > 0 && (
          <Card title={t('metrics.subjects.over_time')} note={t('metrics.subjects.over_time_note')}>
            <StackedColumns data={tags.byYear} label={t('metrics.subjects.over_time')} />
          </Card>
        )}
      </div>
    </Section>
  )
}
