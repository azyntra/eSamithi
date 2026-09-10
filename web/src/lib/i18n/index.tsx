import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import en from './generated/en.json'
import si from './generated/si.json'
import extraEn from './extra/en.json'
import extraSi from './extra/si.json'

// Dictionaries are generated from the desktop's i18n source (scripts/sync-i18n)
// plus web-only keys in extra/. Sinhala falls back to English per key.
export type Lang = 'en' | 'si'
export type TranslationKey = keyof typeof en | keyof typeof extraEn

const EN: Record<string, string> = { ...en, ...extraEn }
// Both dictionaries ship in the first load. Sinhala was split out for a while
// and it cost about 19 KB gzipped — but translate() is synchronous and the
// receipt builders call it, so a receipt printed in the moment before the
// chunk arrived came out in English. Paper is not worth that.
const SI: Record<string, string> = { ...si, ...extraSi }
const STORAGE_KEY = 'esamithi-lang'

export const MONTHS_LONG: Record<Lang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  si: ['ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්']
}

export const MONTHS_SHORT: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  si: ['ජන', 'පෙබ', 'මාර්', 'අප්‍රේ', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝ', 'සැප්', 'ඔක්', 'නොවැ', 'දෙසැ']
}

// Readable outside React (print templates, error helpers)
export function currentLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'si' ? 'si' : 'en'
  } catch {
    return 'en'
  }
}

export type TVars = Record<string, string | number>

export function translate(lang: Lang, key: TranslationKey, vars?: TVars): string {
  let s = (lang === 'si' ? SI[key] : undefined) ?? EN[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  }
  return s
}

export interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey, vars?: TVars) => string
  monthsLong: string[]
  monthsShort: string[]
}

const I18nContext = createContext<I18n>({
  lang: 'en',
  setLang: () => {},
  t: (key, vars) => translate('en', key, vars),
  monthsLong: MONTHS_LONG.en,
  monthsShort: MONTHS_SHORT.en
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(currentLang)

  const setLang = useCallback((next: Lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage blocked */
    }
    setLangState(next)
  }, [])

  // <html lang> drives the :lang(si) typography rules and screen readers
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      monthsLong: MONTHS_LONG[lang],
      monthsShort: MONTHS_SHORT[lang]
    }),
    [lang, setLang]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT(): I18n {
  return useContext(I18nContext)
}
