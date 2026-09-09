import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginPage } from '@/features/auth/LoginPage'
import { ensureSession, isAuthenticated } from '@/lib/api/session'

// The router parses search values as JSON, so a numeric-looking code arrives
// as a number — coerce before validating.
const str = z.preprocess((v) => (v === undefined || v === null ? undefined : String(v)), z.string().optional())
const searchSchema = z.object({ code: str, redirect: str })

export const Route = createFileRoute('/login')({
  validateSearch: (search) => searchSchema.parse(search),
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
