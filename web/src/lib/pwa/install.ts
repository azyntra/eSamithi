import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Chrome fires this once, early, and only when the app is installable. Holding
// on to it lets the offer live in the user menu instead of a browser bar the
// office would learn to ignore.
let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function announce() {
  for (const l of listeners) l()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    announce()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    announce()
  })
}

// Inside the Electron shell, or once installed, there is nothing to offer.
function hidden(): boolean {
  if (typeof window === 'undefined') return true
  if (/eSamithiShell/i.test(navigator.userAgent)) return true
  return window.matchMedia?.('(display-mode: standalone)').matches === true
}

export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<'accepted' | 'dismissed' | 'unavailable'> } {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  return {
    canInstall: deferred !== null && !hidden(),
    install: async () => {
      const evt = deferred
      if (!evt) return 'unavailable'
      await evt.prompt()
      const { outcome } = await evt.userChoice
      deferred = null
      announce()
      return outcome
    }
  }
}
