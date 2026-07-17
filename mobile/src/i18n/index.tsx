import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { en, type TranslationKey } from './en'
import { si } from './si'
import { MONTHS_LONG, MONTHS_SHORT } from './months'
import { setDateLang } from '../lib/date'

// RN port of the desktop i18n (src/renderer/src/i18n): same dictionaries,
// same si→en fallback and {var} interpolation; localStorage swapped for
// SecureStore with async hydration (default 'si' — the app is member-facing).
export type Lang = 'en' | 'si'

const STORAGE_KEY = 'esamithi.lang'

export { MONTHS_LONG, MONTHS_SHORT } from './months'

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  monthsLong: string[]
  monthsShort: string[]
}

function translate(lang: Lang, key: TranslationKey, vars?: Record<string, string | number>): string {
  let s: string = (lang === 'si' ? si[key] : undefined) ?? en[key]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  }
  return s
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'si',
  setLang: () => {},
  t: (key, vars) => translate('si', key, vars),
  monthsLong: MONTHS_LONG.si,
  monthsShort: MONTHS_SHORT.si
})

export function I18nProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [lang, setLangState] = useState<Lang>('si')

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => { if (stored === 'en' || stored === 'si') setLangState(stored) })
      .catch(() => {})
  }, [])

  // Keep the module-level date formatter in the UI language (lib/date.ts)
  useEffect(() => {
    setDateLang(lang)
  }, [lang])

  const setLang = useCallback((next: Lang): void => {
    setLangState(next)
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {})
  }, [])

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  )

  return (
    <I18nContext.Provider value={{ lang, setLang, t, monthsLong: MONTHS_LONG[lang], monthsShort: MONTHS_SHORT[lang] }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useT(): I18nContextValue {
  return useContext(I18nContext)
}

export type { TranslationKey }
