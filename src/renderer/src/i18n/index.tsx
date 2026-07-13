import React, { createContext, useCallback, useContext, useState } from 'react'
import { en, type TranslationKey } from './en'
import { si } from './si'

export type Lang = 'en' | 'si'

const STORAGE_KEY = 'esamithi-lang'

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
  lang: 'en',
  setLang: () => {},
  t: (key, vars) => translate('en', key, vars),
  monthsLong: MONTHS_LONG.en,
  monthsShort: MONTHS_SHORT.en
})

export function I18nProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem(STORAGE_KEY) === 'si' ? 'si' : 'en'))

  const setLang = useCallback((next: Lang): void => {
    localStorage.setItem(STORAGE_KEY, next)
    setLangState(next)
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

// Small "EN | සිං" pill switcher, used in the sidebar footer and login page
export function LangSwitcher({ style }: { style?: React.CSSProperties }): React.ReactElement {
  const { lang, setLang } = useT()
  const btn = (code: Lang, label: string): React.ReactElement => (
    <button
      onClick={() => setLang(code)}
      aria-pressed={lang === code}
      style={{
        border: 'none',
        borderRadius: '6px',
        padding: '3px 10px',
        fontSize: '0.72rem',
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        background: lang === code ? 'var(--primary)' : 'transparent',
        color: lang === code ? '#fff' : 'inherit',
        opacity: lang === code ? 1 : 0.65
      }}
    >
      {label}
    </button>
  )
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: '2px',
        padding: '2px',
        borderRadius: '8px',
        background: 'rgba(128, 128, 128, 0.18)',
        ...style
      }}
    >
      {btn('en', 'EN')}
      {btn('si', 'සිං')}
    </div>
  )
}
