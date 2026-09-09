import { DirectoryError } from '@/lib/api/samithi'
import { isApiError } from '@/lib/api/errors'
import type { TranslationKey, TVars } from '@/lib/i18n'

// Maps API / directory failures to translated messages (the server's texts
// are English; the desktop showed them raw).
export function loginErrorKey(err: unknown): { key: TranslationKey; vars?: TVars } {
  if (err instanceof DirectoryError) {
    return err.status === 0 ? { key: 'login.network' } : { key: 'setup.errResolve' }
  }
  if (isApiError(err)) {
    if (err.status === 401) return { key: 'login.invalid' }
    if (err.status === 423) {
      const secs = Number((err.body as { retry_after_seconds?: number } | null)?.retry_after_seconds ?? 900)
      return { key: 'login.locked', vars: { minutes: Math.max(1, Math.ceil(secs / 60)) } }
    }
    if (err.status === 403) return /suspended/i.test(err.message) ? { key: 'login.suspended' } : { key: 'login.disabled' }
    if (err.status === 0) return { key: 'login.network' }
  }
  if (err instanceof TypeError) return { key: 'login.network' }
  return { key: 'common.somethingWrong' }
}
