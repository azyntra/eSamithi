import { useState, type FormEvent } from 'react'
import { KeyRound, LogOut, Monitor, Smartphone, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/form/Field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { useChangePassword, useRevokeSession, useSessions } from '@/features/auth/queries'
import { errorMessage } from '@/lib/api/errors'
import { signOut, useSession } from '@/lib/api/session'
import { formatDateTime } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'

export function SecurityTab() {
  const { t, lang } = useT()
  const { user, support } = useSession()
  const sessions = useSessions()
  const revoke = useRevokeSession()
  const change = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [signOutAll, setSignOutAll] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (next.length < 8) return setError(t('security.passwordMin8'))
    if (next !== confirm) return setError(t('security.passwordsDiffer'))
    if (next === current) return setError(t('security.passwordSame'))
    try {
      await change.mutateAsync({ current, next })
      toast.success(t('security.passwordChanged'))
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // An operator has no password here and no session of their own to end —
  // the identity is minted by the platform and lasts an hour. Offering the
  // form anyway would only produce a 403 for anyone who tried it.
  if (support) {
    return (
      <EmptyState
        icon={<ShieldAlert />}
        title={t('support.securityTitle')}
        description={t('support.securityBody')}
        className="max-w-lg"
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <KeyRound className="size-4 text-primary" /> {t('security.changePassword')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <input type="text" name="username" autoComplete="username" value={user?.username ?? ''} readOnly hidden />
            <Field label={t('security.currentPassword')} required>
              {({ id }) => <Input id={id} type="password" autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); setError(null) }} />}
            </Field>
            <Field label={t('security.newPassword')} required description={t('security.passwordMin8')}>
              {({ id, describedBy }) => <Input id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} value={next} onChange={(e) => { setNext(e.target.value); setError(null) }} />}
            </Field>
            <Field label={t('security.confirmPassword')} required>
              {({ id }) => <Input id={id} type="password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(null) }} />}
            </Field>
            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <p className="text-xs text-subtle-foreground">{t('security.changeNote')}</p>
            <div>
              <Button type="submit" loading={change.isPending} disabled={!current || !next || !confirm}>
                {t('security.changePassword')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Monitor className="size-4 text-primary" /> {t('security.sessions')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {sessions.isPending ? (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          ) : (sessions.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('security.noSessions')}</p>
          ) : (
            (sessions.data ?? []).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {s.client === 'shell' ? <Monitor className="size-4" /> : <Smartphone className="size-4" />}
                    {s.client === 'shell' ? t('security.clientShell') : t('security.clientWeb')}
                    {s.current && <Badge variant="success">{t('security.thisDevice')}</Badge>}
                  </div>
                  <div className="tnum mt-0.5 text-xs text-muted-foreground">
                    {s.ip || '—'} · {t('security.lastUsed', { when: formatDateTime(s.last_used_at, lang) })}
                  </div>
                </div>
                {!s.current && (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={revoke.isPending}
                    onClick={async () => {
                      try {
                        await revoke.mutateAsync(s.id)
                        toast.success(t('security.sessionRevoked'))
                      } catch (e) {
                        toast.error(errorMessage(e))
                      }
                    }}
                  >
                    {t('security.revoke')}
                  </Button>
                )}
              </div>
            ))
          )}
          <div className="pt-1">
            <Button variant="secondary" onClick={() => setSignOutAll(true)}>
              <LogOut /> {t('auth.signOutEverywhere')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={signOutAll}
        onOpenChange={setSignOutAll}
        danger
        title={t('auth.signOutEverywhere')}
        description={t('security.signOutAllBody')}
        confirmLabel={t('auth.signOutEverywhere')}
        onConfirm={async () => {
          await signOut(true)
          window.location.assign(`${import.meta.env.BASE_URL}login`)
        }}
      />
    </div>
  )
}
