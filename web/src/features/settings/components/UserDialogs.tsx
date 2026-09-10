import { useEffect, useState, type FormEvent } from 'react'
import { KeyRound, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Field } from '@/components/form/Field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { errorMessage } from '@/lib/api/errors'
import { useT } from '@/lib/i18n'
import type { SystemUser } from '../api'
import { useCreateUser, useResetUserPassword } from '../queries'

export function AddUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useT()
  const create = useCreateUser()
  const [form, setForm] = useState({ full_name: '', username: '', password: '', role: 'user' as SystemUser['role'] })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setForm({ full_name: '', username: '', password: '', role: 'user' })
      setError(null)
    }
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) return setError(t('settings.fullNameRequired'))
    if (!form.username.trim()) return setError(t('settings.usernameRequired'))
    if (form.password.length < 4) return setError(t('settings.passwordMin'))
    try {
      await create.mutateAsync({ username: form.username.trim(), password: form.password, full_name: form.full_name.trim(), role: form.role })
      toast.success(t('settings.userCreated', { name: form.username.trim() }))
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err, t('settings.userCreateFailed')))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-primary" /> {t('settings.addUser')}
            </DialogTitle>
            <DialogDescription>{t('settings.systemUsersDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label={t('settings.fullName')} required>
              {({ id }) => <Input id={id} autoFocus value={form.full_name} onChange={(e) => { setForm({ ...form, full_name: e.target.value }); setError(null) }} />}
            </Field>
            <Field label={t('login.username')} required>
              {({ id }) => <Input id={id} autoCapitalize="none" spellCheck={false} value={form.username} onChange={(e) => { setForm({ ...form, username: e.target.value }); setError(null) }} />}
            </Field>
            <Field label={t('login.password')} required description={t('settings.passwordPlaceholder')}>
              {({ id, describedBy }) => <Input id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} value={form.password} onChange={(e) => { setForm({ ...form, password: e.target.value }); setError(null) }} />}
            </Field>
            <Field label={t('settings.role')} required>
              {({ id }) => (
                <NativeSelect id={id} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as SystemUser['role'] })}>
                  <option value="user">{t('settings.roleUser')}</option>
                  <option value="admin">{t('settings.roleAdmin')}</option>
                  <option value="viewer">{t('role.viewer')}</option>
                </NativeSelect>
              )}
            </Field>
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={create.isPending}>
              {t('settings.createUser')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Admin reset: the new password is temporary and every session of that user ends
export function ResetPasswordDialog({ user, onOpenChange }: { user: SystemUser | null; onOpenChange: (o: boolean) => void }) {
  const { t } = useT()
  const reset = useResetUserPassword()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (user) {
      setPassword('')
      setError(null)
    }
  }, [user])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (password.length < 8) return setError(t('security.passwordMin8'))
    try {
      await reset.mutateAsync({ id: user.id, password })
      toast.success(t('security.resetDone', { name: user.full_name }))
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={Boolean(user)} onOpenChange={(o) => !reset.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" /> {t('security.resetTitle')}
            </DialogTitle>
            <DialogDescription>{t('security.resetBody', { name: user?.full_name ?? '' })}</DialogDescription>
          </DialogHeader>
          <Field label={t('security.temporaryPassword')} required description={t('security.passwordMin8')}>
            {({ id, describedBy }) => <Input id={id} autoFocus type="text" autoComplete="off" className="font-mono" aria-describedby={describedBy} value={password} onChange={(e) => { setPassword(e.target.value); setError(null) }} />}
          </Field>
          {error && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={reset.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={reset.isPending}>
              {t('security.resetAction')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
