import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppShell } from '@/app/shell/AppShell'
import { ensureSession, getSessionState } from '@/lib/api/session'

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

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
