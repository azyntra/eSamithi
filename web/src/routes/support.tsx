import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { ensureSession, getSessionState } from '@/lib/api/session'
import { useT } from '@/lib/i18n'

// Entry point for an operator support session (FR-15.1). The token arrives in
// a URL fragment that main.tsx has already consumed and wiped from the address
// bar, so all this route does is ask whether the app ended up in support mode
// and then get out of the way. Anyone else who lands here is told plainly that
// there is nothing to see — including an operator whose link has gone stale.
export const Route = createFileRoute('/support')({
  beforeLoad: async () => {
    await ensureSession()
    if (getSessionState().support) throw redirect({ to: '/dashboard' })
  },
  component: NoSupportSession
})

function NoSupportSession() {
  const { t } = useT()
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <EmptyState
        icon={<ShieldAlert />}
        title={t('support.none')}
        description={t('support.noneBody')}
        action={
          <Button asChild>
            <Link to="/login" search={{ redirect: undefined, code: undefined }}>
              {t('support.toLogin')}
            </Link>
          </Button>
        }
        className="w-full max-w-md"
      />
    </div>
  )
}
