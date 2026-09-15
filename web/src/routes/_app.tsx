import { CatchBoundary, createFileRoute, Outlet, redirect, useLocation } from '@tanstack/react-router'
import { AppShell } from '@/app/shell/AppShell'
import { PageError } from '@/app/shell/PageError'
import { ensureSession, getSessionState } from '@/lib/api/session'
import { reportCrash } from '@/lib/errors/report'

// Pathless layout: everything under it needs a signed-in staff user. An
// EXPIRED session is let through — the SessionDialog re-authenticates in place
// so a half-filled form is never lost.
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    await ensureSession()
    if (getSessionState().status === 'anonymous') {
      throw redirect({ to: '/login', search: { redirect: location.href, code: undefined } })
    }
  },
  component: AppLayout
})

// A page that throws is caught here, inside the shell, and reported. The
// reset key is the path: navigating anywhere else clears the error, and the
// sidebar is still there to navigate with.
function AppLayout() {
  const { pathname } = useLocation()
  return (
    <AppShell>
      <CatchBoundary getResetKey={() => pathname} errorComponent={PageError} onCatch={(error) => reportCrash(error, pathname)}>
        <Outlet />
      </CatchBoundary>
    </AppShell>
  )
}
