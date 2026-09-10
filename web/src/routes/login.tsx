import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { ensureSession, isAuthenticated } from '@/lib/api/session'

// The router parses search values as JSON, so a numeric-looking code arrives
// as a number — stringify before using it.
const text = (v: unknown): string | undefined => (v === undefined || v === null || v === '' ? undefined : String(v))

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { code?: string; redirect?: string } => ({ code: text(search.code), redirect: text(search.redirect) }),
  beforeLoad: async () => {
    await ensureSession()
    if (isAuthenticated()) throw redirect({ to: '/dashboard' })
  },
  component: LoginRoute
})

function LoginRoute() {
  const { code, redirect: target } = Route.useSearch()
  return <LoginPage code={code} redirect={target} />
}
