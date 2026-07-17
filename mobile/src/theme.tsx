import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useColorScheme } from 'react-native'
import * as SecureStore from 'expo-secure-store'

// Palette mirroring the desktop app's token theme (blue primary, slate darks).
// The gradient pair + navy match the eS launcher icon so in-app branding and
// the store identity read as one family.
export const palettes = {
  light: {
    bg: '#f1f5f9',
    surface: '#ffffff',
    surfaceAlt: '#f8fafc',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
    primary: '#3b82f6',
    primaryDark: '#2563eb',
    primarySoft: '#e8f0fe',
    onPrimary: '#ffffff',
    gradStart: '#3b82f6',
    gradEnd: '#1E64D4',
    navy: '#0B1F3B',
    surfaceElevated: '#ffffff',
    overlay: 'rgba(15, 23, 42, 0.45)',
    shadow: '#0f172a',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
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
    primary: '#3b82f6',
    primaryDark: '#2563eb',
    primarySoft: '#1e2f55',
    onPrimary: '#ffffff',
    gradStart: '#3b82f6',
    gradEnd: '#1E64D4',
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

// Font-size scale. Line heights come from useType() (src/typography.tsx)
// because Sinhala needs taller lines than Latin at the same size.
export const type = { display: 28, title: 22, heading: 17, body: 15, caption: 13, micro: 12 } as const

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
