import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useT } from '@/lib/i18n'

// Prompt-mode service worker: never swaps code under a user mid-entry.
export function UpdatePrompt() {
  const { t } = useT()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) window.setInterval(() => void registration.update(), 60 * 60 * 1000)
    }
  })

  useEffect(() => {
    if (!needRefresh) return
    toast(t('update.available'), {
      id: 'sw-update',
      duration: Infinity,
      action: { label: t('update.reload'), onClick: () => void updateServiceWorker(true) },
      onDismiss: () => setNeedRefresh(false)
    })
  }, [needRefresh, setNeedRefresh, t, updateServiceWorker])

  return null
}
