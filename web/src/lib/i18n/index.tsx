import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import en from './generated/en.json'
import extraEn from './extra/en.json'
import type siJson from './generated/si.json'
import type extraSiJson from './extra/si.json'

// Dictionaries are generated from the desktop's i18n source (scripts/sync-i18n)
// plus web-only keys in extra/. Sinhala falls back to English per key.
export type Lang = 'en' | 'si'
export type TranslationKey = keyof typeof en | keyof typeof extraEn

const EN: Record<string, string> = { ...en, ...extraEn }
const STORAGE_KEY = 'esamithi-lang'

// Sinhala is a third of the first load and most sessions never switch to it,
// so it arrives on demand. Until it lands, every key falls back to English —
// which is exactly what a missing Sinhala string already does.
let SI: Record<string, string> = {}
let siPromise: Promise<void> | null = null

export function ensureSinhala(): Promise<void> {
  siPromise ??= Promise.all([import('./generated/si.json'), import('./extra/si.json')]).then(([main, extra]) => {
    SI = { ...(main.default as typeof siJson), ...(extra.default as typeof extraSiJson) }
  })
  return siPromise
}

export function sinhalaReady(): boolean {
  return Object.keys(SI).length > 0
}

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
  const [dict, setDict] = useState(0)

  // Re-render once the Sinhala dictionary has landed. Awaiting the shared
  // promise (rather than a listener) means it cannot resolve before we are
  // watching, which would leave the screen in English.
  useEffect(() => {
    if (lang !== 'si' || sinhalaReady()) return
    let alive = true
    void ensureSinhala().then(() => {
      if (alive) setDict((n) => n + 1)
    })
    return () => {
      alive = false
    }
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    if (next === 'si') void ensureSinhala()
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

  const value = useMemo<I18n>(() => {
    // Referencing the version here is the point: translate() reads a module
    // level dictionary, so nothing in this object changes shape when Sinhala
    // lands — but consumers must still be handed a new value.
    void dict
    return {
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      monthsLong: MONTHS_LONG[lang],
      monthsShort: MONTHS_SHORT[lang]
    }
  }, [lang, setLang, dict])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT(): I18n {
  return useContext(I18nContext)
}
