import { useCallback, useSyncExternalStore } from 'react'

// Same attribute and storage key as the desktop app, so a machine that already
// chose dark mode keeps it in the browser.
export type Theme = 'light' | 'dark'
const KEY = 'esamithi-theme'
const listeners = new Set<() => void>()

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* storage blocked */
  }
  listeners.forEach((l) => l())
}

export function initTheme(): void {
  document.documentElement.dataset.theme = read()
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    () => 'light' as Theme
  )
  const set = useCallback((next: Theme) => applyTheme(next), [])
  return [theme, set]
}
