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
  light: {
    bg: '#f1f5f9',
    surface: '#ffffff',
    surfaceAlt: '#f8fafc',
    text: '#0f172a',
    textMuted: '#475569',
    border: '#e2e8f0',
    primary: '#1E64D4',
    primaryDark: '#1854B8',
    primarySoft: '#EEF4FE',
    // Text sitting ON primarySoft. Separate from `primary` because in dark
    // mode the tint is dark and the label has to lift off it.
    primaryOnSoft: '#1E64D4',
    onPrimary: '#ffffff',
    gradStart: '#1E64D4',
    gradEnd: '#1854B8',
    navy: '#0B1F3B',
    surfaceElevated: '#ffffff',
    overlay: 'rgba(15, 23, 42, 0.45)',
    shadow: '#0f172a',
    success: '#166534',
    warning: '#B45309',
    danger: '#B91C1C',
    dangerBg: '#fee2e2',
    warningBg: '#fef3c7',
    successBg: '#dcfce7'
  },
  dark: {
    bg: '#0b1220',
    surface: '#151e31',
    surfaceAlt: '#1c2740',
    text: '#e2e8f0',
    textMuted: '#94a3b8',
    border: '#27324a',
    // Dark mode inverts the brand surface: a light blue fill with a navy
    // label, rather than the same saturated blue the light theme uses. The old
    // palette shared `primary` byte-for-byte between the two themes, so the
    // gradient hero and every primary button were the brightest thing on a
    // dark screen — and white-on-#3b82f6 measured 3.68:1, below the minimum.
    primary: '#4C8DF6',
    primaryDark: '#6FA3F8',
    primarySoft: '#1B2B4D',
    primaryOnSoft: '#85B0F2',
    onPrimary: '#0F172A',
    gradStart: '#6FA3F8',
    gradEnd: '#4C8DF6',
    navy: '#0B1F3B',
    surfaceElevated: '#1a2540',
    overlay: 'rgba(2, 6, 23, 0.55)',
    shadow: '#000000',
    success: '#4ade80',
    warning: '#fbbf24',
    danger: '#f87171',
    dangerBg: '#450a0a',
    warningBg: '#451a03',
    successBg: '#052e16'
  }
}

// ---- Layout tokens (4-pt grid) ----------------------------------------
// Shared scales so screens stop hand-picking numbers. Adopted incrementally:
// components take these; legacy inline literals keep working meanwhile.

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const

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
export const type = { display: 28, title: 22, heading: 18, body: 16, caption: 14, micro: 12 } as const

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
