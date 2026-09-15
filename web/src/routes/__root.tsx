import { useEffect } from 'react'
import { createRootRouteWithContext, Link, Outlet, type ErrorComponentProps } from '@tanstack/react-router'
import { FileQuestion, RefreshCw } from 'lucide-react'
import type { RouterContext } from '@/app/routerContext'
import { SessionDialog } from '@/app/shell/SessionDialog'
import { UpdatePrompt } from '@/app/shell/UpdatePrompt'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { reportCrash } from '@/lib/errors/report'
import { useT } from '@/lib/i18n'

// A tab left open across a release asks for chunks that no longer exist. The
// browser reports that as a failed dynamic import, which would otherwise land
// on a bare error screen. One reload fixes it, because index.html is never
// cached and names the new chunks. The flag stops a reload loop if the failure
// is something else that only looks the same.
const RELOAD_FLAG = 'esamithi.stale-reload'

function isStaleChunk(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|chunkloaderror/i.test(message)
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: RootError,
  notFoundComponent: NotFound
})

function RootComponent() {
  // Reaching a rendered route means the app is whole again
  useEffect(() => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG)
    } catch {
      /* storage blocked */
    }
  }, [])

  return (
    <>
      <Outlet />
      <SessionDialog />
      <UpdatePrompt />
      <Toaster />
    </>
  )
}

function RootError({ error, reset }: ErrorComponentProps) {
  const { t } = useT()
  const stale = isStaleChunk(error)

  useEffect(() => {
    if (!stale) {
      reportCrash(error, window.location.pathname)
      return
    }
    let alreadyTried = false
    try {
      alreadyTried = sessionStorage.getItem(RELOAD_FLAG) === '1'
      sessionStorage.setItem(RELOAD_FLAG, '1')
    } catch {
      /* storage blocked: fall through to the manual button */
    }
    if (!alreadyTried) window.location.reload()
  }, [stale, error])

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <EmptyState
        icon={<RefreshCw />}
        title={stale ? t('stale.title') : t('error.title')}
        description={stale ? t('stale.body') : error instanceof Error ? error.message : undefined}
        action={
          <Button onClick={() => (stale ? window.location.reload() : reset())}>
            <RefreshCw /> {stale ? t('stale.reload') : t('error.retry')}
          </Button>
        }
        className="w-full max-w-md"
      />
    </div>
  )
}

function NotFound() {
  const { t } = useT()
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <EmptyState
        icon={<FileQuestion />}
        title={t('notFound.title')}
        description={t('notFound.body')}
        action={
          <Button asChild>
            <Link to="/dashboard">{t('notFound.home')}</Link>
          </Button>
        }
        className="w-full max-w-md"
      />
    </div>
  )
}
