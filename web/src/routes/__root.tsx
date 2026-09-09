import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import { FileQuestion } from 'lucide-react'
import type { RouterContext } from '@/app/routerContext'
import { SessionDialog } from '@/app/shell/SessionDialog'
import { UpdatePrompt } from '@/app/shell/UpdatePrompt'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { useT } from '@/lib/i18n'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFound
})

function RootComponent() {
  return (
    <>
      <Outlet />
      <SessionDialog />
      <UpdatePrompt />
      <Toaster />
    </>
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
