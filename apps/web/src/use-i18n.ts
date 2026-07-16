import { useContext } from 'react'

import { I18nContext, type I18nContextValue } from './i18n-context.js'

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
