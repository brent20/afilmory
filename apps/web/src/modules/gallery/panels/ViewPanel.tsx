import { useTranslation } from 'react-i18next'

import { SortPanel } from './SortPanel'

// View panel (sorting only; the column slider has been removed)
export const ViewPanel = () => {
  const { t } = useTranslation()

  return (
    <div className="pb-safe lg:pb-safe-2 w-full lg:py-1">
      <h3 className="mb-3 px-2 text-sm font-medium">{t('action.view.settings')}</h3>

      <div className="px-2">
        <h4 className="text-text-secondary mb-3 text-xs font-medium">{t('action.sort.mode')}</h4>
        <SortPanel />
      </div>
    </div>
  )
}
