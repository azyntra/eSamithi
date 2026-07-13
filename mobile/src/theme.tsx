import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useColorScheme } from 'react-native'
import * as SecureStore from 'expo-secure-store'

// Palette mirroring the desktop app's token theme (blue primary, slate darks)
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
    onPrimary: '#ffffff',
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
    onPrimary: '#ffffff',
    success: '#4ade80',
    warning: '#fbbf24',
    danger: '#f87171',
    dangerBg: '#450a0a',
    warningBg: '#451a03',
    successBg: '#052e16'
  }
}

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
