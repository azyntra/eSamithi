export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'esamithi-theme'

export function getTheme(): Theme {
  return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(STORAGE_KEY, theme)
}

// Called once before first render so there is no light-mode flash
export function initTheme(): void {
  document.documentElement.dataset.theme = getTheme()
}
