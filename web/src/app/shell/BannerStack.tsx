import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Info, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { apiBase } from '@/lib/api/samithi'
import { useSession } from '@/lib/api/session'
import { useT } from '@/lib/i18n'

function useOnline(): [boolean, () => Promise<void>] {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  const retry = async () => {
    try {
      const res = await fetch(`${apiBase()}/health`, { cache: 'no-store' })
      setOnline(res.ok)
    } catch {
      setOnline(false)
    }
  }
  return [online, retry]
}

export function BannerStack() {
  const { t } = useT()
  const { samithi } = useSession()
  const [online, retry] = useOnline()
  const wasOffline = useRef(false)

  useEffect(() => {
    if (!online) wasOffline.current = true
    else if (wasOffline.current) {
      wasOffline.current = false
      toast.success(t('banner.backOnline'))
    }
  }, [online, t])

  const maintenance = samithi?.maintenance?.message

  return (
    <div className="relative z-20">
      <AnimatePresence initial={false}>
        {!online && (
          <motion.div
            key="offline"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div role="status" className="flex items-center gap-3 bg-warning-soft px-4 py-2 text-sm text-warning md:px-6">
              <WifiOff className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{t('banner.offline')}</span>
              <Button size="sm" variant="outline" onClick={() => void retry()}>
                {t('banner.retry')}
              </Button>
            </div>
          </motion.div>
        )}
        {maintenance && (
          <motion.div key="maintenance" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex items-center gap-3 bg-info-soft px-4 py-2 text-sm text-info md:px-6">
              <Info className="size-4 shrink-0" aria-hidden />
              <span>
                <strong className="font-semibold">{t('banner.maintenance')}</strong> {maintenance}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
