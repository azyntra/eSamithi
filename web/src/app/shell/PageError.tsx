import { Link, type ErrorComponentProps } from '@tanstack/react-router'
import { LayoutDashboard, RefreshCw } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'

// Shown inside the shell when one page throws. The sidebar, the top bar and
// every other route keep working; before this, a crash in a form sheet took
// the whole application down to a bare card with no way out but a reload.
export function PageError({ error, reset }: ErrorComponentProps) {
  const { t } = useT()
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <EmptyState
        icon={<RefreshCw />}
        title={t('error.title')}
        description={
          <>
            {t('error.pageBody')}
            {error instanceof Error && error.message ? <code className="mt-2 block text-xs text-muted-foreground">{error.message}</code> : null}
          </>
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>
              <RefreshCw /> {t('error.retry')}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <LayoutDashboard /> {t('notFound.home')}
              </Link>
            </Button>
          </div>
        }
        className="w-full max-w-md"
      />
    </div>
  )
}
