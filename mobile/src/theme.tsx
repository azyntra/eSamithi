import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useColorScheme } from 'react-native'
import * as SecureStore from 'expo-secure-store'

// Palette mirroring the web and desktop apps' token theme, so a member's app
// and the officer's screen read as one product.
//
// Every foreground/background pair here is checked by scripts/check-contrast.mjs
// against WCAG AA. Six pairs used to fail, including the primary blue both as
// a text colour (3.68:1) and under a white button label (3.68:1).
export const palettes = {
  // "eSamithi Calm" (docs/MOBILE-APP-REDESIGN-REQUIREMENTS.md §3.2), grown from
  // the membership card: navy ink, one blue accent, a deep-blue gradient that
  // is reserved for the Home hero, the card, Welcome and the primary button.
  light: {
    bg: '#F3F6FB',
    surface: '#FFFFFF',
    surfaceAlt: '#F6F8FC',
    text: '#0F2547',
    textMuted: '#52627A',
    // Placeholders and non-essential hints only (3.60:1) — never content
    textSubtle: '#7A889C',
    border: '#E2E8F1',
    // Input and control boundaries: 3:1 against the surface (WCAG 1.4.11)
    borderStrong: '#7E8CA2',
    primary: '#1E64D4',
    primaryDark: '#1752B4',
    primaryPressed: '#1752B4',
    primarySoft: '#EAF1FD',
    primaryOnSoft: '#1752B4',
    onPrimary: '#FFFFFF',
    gradStart: '#1E64D4',
    gradEnd: '#0D3B8C',
    heroStart: '#1E64D4',
    heroMid: '#1752B4',
    heroEnd: '#0D3B8C',
    onHero: '#FFFFFF',
    onHeroMuted: '#E4EDFD',
    // Translucent controls and cards sitting on the hero
    heroGlass: 'rgba(255, 255, 255, 0.14)',
    navy: '#0B1F3B',
    surfaceElevated: '#FFFFFF',
    overlay: 'rgba(15, 37, 71, 0.45)',
    shadow: '#0F2547',
    success: '#166534',
    warning: '#9A4A06',
    danger: '#B91C1C',
    // Death notices only: calm slate, never the alarm red of an overdue loan
    memorial: '#334155',
    memorialBg: '#EEF1F5',
    dangerBg: '#FDECEC',
    warningBg: '#FDF1E3',
    successBg: '#E6F4EA'
  },
  dark: {
    bg: '#0A1324',
    surface: '#111C30',
    surfaceAlt: '#17243C',
    text: '#E6ECF5',
    textMuted: '#9EADC2',
    textSubtle: '#7486A0',
    border: '#22314B',
    borderStrong: '#5C7194',
    primary: '#5B9BF8',
    primaryDark: '#7DAFF9',
    primaryPressed: '#7DAFF9',
    primarySoft: '#18294A',
    primaryOnSoft: '#A9C8FB',
    onPrimary: '#0A1324',
    // The brand gradient keeps deep blues in dark mode (white text on it),
    // dimmed a step so it is not the brightest thing on a dark screen
    gradStart: '#1B55B8',
    gradEnd: '#0D2F6B',
    heroStart: '#1B55B8',
    heroMid: '#174A9F',
    heroEnd: '#0D2F6B',
    onHero: '#FFFFFF',
    onHeroMuted: '#C9DAF8',
    heroGlass: 'rgba(255, 255, 255, 0.13)',
    navy: '#0B1F3B',
    surfaceElevated: '#17223A',
    overlay: 'rgba(2, 6, 23, 0.6)',
    shadow: '#000000',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    memorial: '#CBD5E1',
    memorialBg: '#1E293B',
    dangerBg: '#361518',
    warningBg: '#2D2110',
    successBg: '#0E2A1B'
  }
}

// ---- Layout tokens (4-pt grid) ----------------------------------------
// Shared scales so screens stop hand-picking numbers. Adopted incrementally:
// components take these; legacy inline literals keep working meanwhile.

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const

// iOS shadow + Android elevation pairs. Spread where needed and set
// `shadowColor: palette.shadow` alongside (color lives in the palette so
// dark mode can go pure black).
export const elevation = {
  sm: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  md: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.11, shadowRadius: 14, elevation: 5 },
  lg: { shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 10 }
} as const

// Font-size scale — six steps, no fractionals. Nineteen distinct sizes were in
// use before this, six of them fractional (9.5, 10.5, 12.5, 13.5, 15.5, 16.5),
// while this scale was imported by exactly one file. The body sits at 16 rather
// than 15: most members are elderly and read Sinhala in sunlight.
// Line heights come from useType() (src/typography.tsx) because Sinhala needs
// taller lines than Latin at the same size, and because lineHeight has to
// track the phone's own text-size setting.
// `hero` (34) is for the one amount a money screen exists to show — Inter,
// tabular digits, never Sinhala text.
export const type = { hero: 34, display: 28, title: 22, heading: 18, body: 16, caption: 14, micro: 12 } as const

export type Palette = typeof palettes.light
export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'esamithi.theme'

interface ThemeContextValue {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  scheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  setMode: () => {},
  scheme: 'light'
})

// System / Light / Dark with the choice persisted — mirrors the desktop's
// manual theme toggle while defaulting to the phone's setting.
export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [mode, setModeState] = useState<ThemeMode>('system')
  const systemScheme = useColorScheme()

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') setModeState(stored)
      })
      .catch(() => {})
  }, [])

  const setMode = useCallback((next: ThemeMode): void => {
    setModeState(next)
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {})
  }, [])

  const scheme: 'light' | 'dark' = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode

  const value = useMemo(() => ({ mode, setMode, scheme }), [mode, setMode, scheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeMode(): ThemeContextValue {
  return useContext(ThemeContext)
}

// Same signature as before the provider existed — every screen keeps working
export function usePalette(): Palette {
  return palettes[useContext(ThemeContext).scheme]
}
