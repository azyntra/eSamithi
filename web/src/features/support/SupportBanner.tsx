import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { exitSupport, useSession } from '@/lib/api/session'
import { useT } from '@/lib/i18n'

/** Height of the fixed bar, in px — the shell offsets itself by this much. */
export const SUPPORT_BANNER_H = 36

// The platform signs the token with a synthetic username, 'eSamithi Support
// (someone@example.com)'. The address inside it is the half worth showing:
// the society's own staff should be able to see who is in their books.
export function operatorLabel(username: string | undefined, actor: string): string {
  const m = username ? /\(([^)]+@[^)]+)\)/.exec(username) : null
  return m?.[1] ?? username ?? actor
}

export function countdown(msLeft: number): string {
  const total = Math.max(0, Math.floor(msLeft / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Where to land after leaving support mode, honouring a /app/ base path. */
function ownLogin(): string {
  return `${import.meta.env.BASE_URL}login`
}

export function leaveSupport(): void {
  window.location.href = exitSupport() ?? ownLogin()
}

// Permanent, non-dismissable bar while an operator is inside a society
// (FR-15.2). The red is written out rather than themed on purpose: this must
// look identical and alarming in both themes, and the --danger token is tuned
// as *text* on a dark ground, which would invert the meaning here.
export function SupportBanner() {
  const { t } = useT()
  const { user, samithi, support } = useSession()
  const expiresAt = support?.expiresAt ?? 0
  const [left, setLeft] = useState(() => (expiresAt ? expiresAt - Date.now() : 0))

  useEffect(() => {
    if (!expiresAt) return
    const tick = (): void => setLeft(expiresAt - Date.now())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [expiresAt])

  // The token is dead the moment the hour is up; go before the next call 401s
  useEffect(() => {
    if (expiresAt && left <= 0) leaveSupport()
  }, [expiresAt, left])

  if (!support) return null

  return (
    <div
      role="region"
      aria-label={t('support.banner')}
      className="fixed inset-x-0 top-0 z-50 flex h-9 items-center gap-3 bg-[#B91C1C] px-4 text-[13px] font-medium text-white shadow-md md:px-6"
    >
      <ShieldAlert className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        {t('support.inside', { name: samithi?.name ?? support.sid, actor: operatorLabel(user?.username, support.actor) })}
      </span>
      {expiresAt > 0 && (
        <span className="hidden shrink-0 tabular-nums opacity-90 sm:inline">{t('support.endsIn', { time: countdown(left) })}</span>
      )}
      <button
        type="button"
        onClick={leaveSupport}
        className="shrink-0 rounded-md bg-white px-3 py-1 text-[12px] font-bold text-[#B91C1C] transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#B91C1C] focus-visible:outline-none"
      >
        {t('support.exit')}
      </button>
    </div>
  )
}
