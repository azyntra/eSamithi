import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { en, type TranslationKey } from './en'
import { si } from './si'

// RN port of the desktop i18n (src/renderer/src/i18n): same dictionaries,
// same si→en fallback and {var} interpolation; localStorage swapped for
// SecureStore with async hydration (default 'si' — the app is member-facing).
export type Lang = 'en' | 'si'

const STORAGE_KEY = 'esamithi.lang'

const MONTHS_LONG: Record<Lang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  si: ['ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්']
}

const MONTHS_SHORT: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  si: ['ජන', 'පෙබ', 'මාර්', 'අප්‍රේ', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝ', 'සැප්', 'ඔක්', 'නොවැ', 'දෙසැ']
}

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
