import i18next from 'i18next'
import { atom } from 'jotai'
import { initReactI18next } from 'react-i18next'

import { currentSupportedLanguages } from './@types/constants'
import { resources } from './@types/resources'
import { jotaiStore } from './lib/jotai'

const i18n = i18next.createInstance()
i18n
  .use(initReactI18next)
  .init({
    // English only: no language detection, so browser/localStorage language never overrides this.
    lng: 'en',
    fallbackLng: {
      default: ['en'],
    },
    supportedLngs: currentSupportedLanguages,
    defaultNS: 'app',
    resources,
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  })

export { i18n }

export const i18nAtom = atom(i18n)

export const getI18n = () => {
  return jotaiStore.get(i18nAtom)
}
