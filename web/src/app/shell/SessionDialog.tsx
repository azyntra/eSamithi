import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isApiError } from '@/lib/api/errors'
import { signIn, signOut, useSession } from '@/lib/api/session'
import { leaveSupport } from '@/features/support/SupportBanner'
import { useT } from '@/lib/i18n'
import { loginErrorKey } from '@/features/auth/loginErrors'

// Re-authenticate in place when the refresh cookie has lapsed: samithi and
// username are kept, and whatever query failed re-runs afterwards.
export function SessionDialog() {
  const { t } = useT()
  const { status, user, support } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const open = status === 'expired' && Boolean(user)

  useEffect(() => {
    if (!open) {
      setPassword('')
      setError(null)
    }
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !password) return
    setBusy(true)
    setError(null)
    try {
      await signIn(user.username, password)
      await queryClient.invalidateQueries()
    } catch (err) {
      const key = loginErrorKey(err)
      setError(t(key.key, key.vars))
      if (isApiError(err) && err.status === 429) setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const switchUser = async () => {
    await signOut()
    void router.navigate({ to: '/login' })
  }

  // A support session cannot be renewed in place — the hour is fixed and the
  // console may have revoked it — so there is one honest thing to offer.
  if (support) {
    return (
      <Dialog open={open}>
        <DialogContent showCloseButton={false} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('support.ended')}</DialogTitle>
            <DialogDescription>{t('support.endedBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={leaveSupport}>{t('support.leave')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} className="sm:max-w-md">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{t('session.expiredTitle')}</DialogTitle>
            <DialogDescription>{t('session.expiredBody')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="reauth-username">{t('login.username')}</Label>
              <Input id="reauth-username" value={user?.username ?? ''} readOnly className="bg-muted" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reauth-password">{t('login.password')}</Label>
              <Input id="reauth-password" type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={error ? true : undefined} />
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => void switchUser()}>
              {t('session.switchUser')}
            </Button>
            <Button type="submit" loading={busy} disabled={!password}>
              {t('session.continue')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
