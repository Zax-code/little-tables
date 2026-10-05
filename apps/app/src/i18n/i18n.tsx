/**
 * Typed catalogues in French (default), English and Simplified Chinese
 * (`docs/rewrite/TECHNICAL_SPEC.md` §6.6). Each group of messages is written in English first;
 * the other languages must have exactly the same keys.
 */
import { createContext, use, useMemo, type ReactNode } from 'react'

import type { Language } from '../data/schema.js'
import { createTranslator, type Translator } from './translator.js'

const I18nContext = createContext<Translator>(createTranslator('fr'))

export function I18nProvider({
  children,
  language,
}: Readonly<{ children: ReactNode; language: Language }>) {
  const translator = useMemo(() => createTranslator(language), [language])
  return <I18nContext value={translator}>{children}</I18nContext>
}

export const useI18n = () => use(I18nContext)
