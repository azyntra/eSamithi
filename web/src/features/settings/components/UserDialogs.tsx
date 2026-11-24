import { useEffect, useState, type FormEvent } from 'react'
import { History, KeyRound, Pencil, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/form/Field'
import { MemberPicker } from '@/components/MemberPicker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { errorMessage, isApiError } from '@/lib/api/errors'
import { formatDateTime } from '@/lib/format/dates'
import { useT, type TranslationKey } from '@/lib/i18n'
import type { OfficerEvent, SecretaryHolder, SocietyPosition, SystemUser } from '../api'
import { useCreateUser, useResetUserPassword, useUpdateUser, useUserEvents } from '../queries'

// Society officers (docs/MEETING-MINUTES-REQUIREMENTS.md §3). A system user may
// hold a Society Position and be linked to the member account they use in the
// member app; the Secretary publishes meeting minutes from that account.

export const POSITION_LABEL: Record<SocietyPosition, TranslationKey> = {
  secretary: 'settings.positionSecretary',
  president: 'settings.positionPresident',
  treasurer: 'settings.positionTreasurer'
}
export const ROLE_LABEL: Record<SystemUser['role'], TranslationKey> = {
  admin: 'settings.roleAdmin',
  user: 'settings.roleUser',
  viewer: 'role.viewer'
}

// The 409 a save gets when someone else already holds the Secretary post
function secretaryHolderOf(err: unknown): SecretaryHolder | null | undefined {
  if (!isApiError(err) || err.code !== 'SECRETARY_TAKEN') return undefined
  return (err.body as { current?: SecretaryHolder | null } | null)?.current ?? null
}

function ErrorBox({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
      {text}
    </p>
  )
}

interface OfficerValue {
  position: SocietyPosition | ''
  memberId: number | null
}

// Society Position + Linked Member, shared by the Add and Edit dialogs
function OfficerFields({ value, onChange, notReadyName }: { value: OfficerValue; onChange: (v: OfficerValue) => void; notReadyName?: string | null }) {
  const { t } = useT()
  const needsMember = value.position === 'secretary' && value.memberId === null
  return (
    <>
      <Field label={t('settings.societyPosition')}>
        {({ id }) => (
          <NativeSelect id={id} value={value.position} onChange={(e) => onChange({ ...value, position: e.target.value as OfficerValue['position'] })}>
            <option value="">{t('settings.positionNone')}</option>
            <option value="secretary">{t('settings.positionSecretary')}</option>
            <option value="president">{t('settings.positionPresident')}</option>
            <option value="treasurer">{t('settings.positionTreasurer')}</option>
          </NativeSelect>
        )}
      </Field>
      <Field
        label={t('settings.linkedMember')}
        required={value.position === 'secretary'}
        error={needsMember ? t('settings.secretaryNeedsMember') : null}
        description={notReadyName ? t('settings.memberNotReady', { name: notReadyName }) : t('settings.linkedMemberHint')}
      >
        {({ id, invalid }) => <MemberPicker id={id} value={value.memberId} invalid={invalid} onChange={(memberId) => onChange({ ...value, memberId })} placeholder={t('settings.linkedMemberPlaceholder')} />}
      </Field>
    </>
  )
}

// §3.3 — taking the Secretary post from someone needs a named confirmation
function HandoverDialog({ holder, newName, busy, onCancel, onConfirm }: { holder: SecretaryHolder | null | undefined; newName: string; busy: boolean; onCancel: () => void; onConfirm: () => Promise<void> }) {
  const { t } = useT()
  const current = holder?.full_name ?? t('settings.theCurrentSecretary')
  return (
    <ConfirmDialog
      open={holder !== undefined}
      onOpenChange={(o) => !o && onCancel()}
      title={t('settings.handoverTitle', { name: newName })}
      description={t('settings.handoverBody', { name: newName, current })}
      confirmLabel={t('settings.handoverConfirm', { name: newName })}
      busy={busy}
      onConfirm={onConfirm}
    />
  )
}

export function AddUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useT()
  const create = useCreateUser()
  const [form, setForm] = useState({ full_name: '', username: '', password: '', role: 'user' as SystemUser['role'] })
  const [officer, setOfficer] = useState<OfficerValue>({ position: '', memberId: null })
  const [error, setError] = useState<string | null>(null)
  const [holder, setHolder] = useState<SecretaryHolder | null | undefined>(undefined)
  useEffect(() => {
    if (open) {
      setForm({ full_name: '', username: '', password: '', role: 'user' })
      setOfficer({ position: '', memberId: null })
      setError(null)
      setHolder(undefined)
    }
  }, [open])

  const save = async (replaceSecretary: boolean) => {
    try {
      await create.mutateAsync({
        username: form.username.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        role: form.role,
        society_position: officer.position || null,
        member_id: officer.memberId,
        replace_secretary: replaceSecretary || undefined
      })
      toast.success(t('settings.userCreated', { name: form.username.trim() }))
      setHolder(undefined)
      onOpenChange(false)
    } catch (err) {
      const taken = secretaryHolderOf(err)
      if (taken !== undefined && !replaceSecretary) return setHolder(taken)
      setHolder(undefined)
      setError(errorMessage(err, t('settings.userCreateFailed')))
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) return setError(t('settings.fullNameRequired'))
    if (!form.username.trim()) return setError(t('settings.usernameRequired'))
    if (form.password.length < 4) return setError(t('settings.passwordMin'))
    // The Linked Member field already says why (inline, under the picker)
    if (officer.position === 'secretary' && officer.memberId === null) return
    await save(false)
  }

  return (
    <>
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
              <OfficerFields value={officer} onChange={(v) => { setOfficer(v); setError(null) }} />
            </div>
            <ErrorBox text={error} />
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
      <HandoverDialog holder={holder} newName={form.full_name.trim()} busy={create.isPending} onCancel={() => setHolder(undefined)} onConfirm={() => save(true)} />
    </>
  )
}

function eventValue(t: ReturnType<typeof useT>['t'], e: OfficerEvent, which: 'before' | 'after'): string {
  const raw = which === 'before' ? e.before_value : e.after_value
  if (e.field === 'member_id') return (which === 'before' ? e.before_member : e.after_member) ?? (raw ? `#${raw}` : t('settings.noMember'))
  if (e.field === 'society_position' || e.field === 'deleted') return raw ? t(POSITION_LABEL[raw as SocietyPosition] ?? 'settings.positionNone') : t('settings.positionNone')
  if (e.field === 'is_active') return raw === '0' ? t('settings.inactive') : t('settings.active')
  if (e.field === 'role') return raw ? t(ROLE_LABEL[raw as SystemUser['role']] ?? 'settings.roleUser') : '—'
  return raw ?? '—'
}

const EVENT_FIELD: Record<OfficerEvent['field'], TranslationKey> = {
  role: 'settings.role',
  is_active: 'settings.active',
  society_position: 'settings.societyPosition',
  member_id: 'settings.linkedMember',
  deleted: 'settings.historyDeleted'
}

function OfficerHistory({ userId }: { userId: number }) {
  const { t, lang } = useT()
  const events = useUserEvents(userId)
  if (events.isPending) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  if (!events.data?.length) return <p className="text-sm text-muted-foreground">{t('settings.historyEmpty')}</p>
  return (
    <ul className="grid max-h-48 gap-2 overflow-y-auto text-sm">
      {events.data.map((e) => (
        <li key={e.id} className="rounded-md bg-muted/50 px-3 py-2">
          <div className="font-medium">
            {t(EVENT_FIELD[e.field])}: {eventValue(t, e, 'before')} → {eventValue(t, e, 'after')}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDateTime(e.created_at, lang)}
            {e.by_name ? ` · ${e.by_name}` : ''}
          </div>
        </li>
      ))}
    </ul>
  )
}

// Edit: name, access role, active, society position, linked member (§3.2)
export function EditUserDialog({ user, isSelf, onOpenChange }: { user: SystemUser | null; isSelf: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useT()
  const update = useUpdateUser()
  const [form, setForm] = useState({ full_name: '', role: 'user' as SystemUser['role'], active: true })
  const [officer, setOfficer] = useState<OfficerValue>({ position: '', memberId: null })
  const [error, setError] = useState<string | null>(null)
  const [holder, setHolder] = useState<SecretaryHolder | null | undefined>(undefined)
  const [showHistory, setShowHistory] = useState(false)
  useEffect(() => {
    if (user) {
      setForm({ full_name: user.full_name, role: user.role, active: user.is_active !== 0 })
      setOfficer({ position: user.society_position ?? '', memberId: user.member_id })
      setError(null)
      setHolder(undefined)
      setShowHistory(false)
    }
  }, [user])

  // Only what changed goes to the server, so the officer trail stays honest
  const changes = () => {
    if (!user) return {}
    const p: Parameters<typeof update.mutateAsync>[0]['payload'] = {}
    if (form.full_name.trim() !== user.full_name) p.full_name = form.full_name.trim()
    if (form.role !== user.role) p.role = form.role
    if (form.active !== (user.is_active !== 0)) p.is_active = form.active
    if ((officer.position || null) !== user.society_position) p.society_position = officer.position || null
    if (officer.memberId !== user.member_id) p.member_id = officer.memberId
    return p
  }

  const save = async (replaceSecretary: boolean) => {
    if (!user) return
    const payload = changes()
    if (!Object.keys(payload).length) return onOpenChange(false)
    try {
      await update.mutateAsync({ id: user.id, payload: { ...payload, replace_secretary: replaceSecretary || undefined } })
      toast.success(t('settings.userUpdated', { name: form.full_name.trim() }))
      setHolder(undefined)
      onOpenChange(false)
    } catch (err) {
      const taken = secretaryHolderOf(err)
      if (taken !== undefined && !replaceSecretary) return setHolder(taken)
      setHolder(undefined)
      setError(errorMessage(err, t('settings.userUpdateFailed')))
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) return setError(t('settings.fullNameRequired'))
    // The Linked Member field already says why (inline, under the picker)
    if (officer.position === 'secretary' && officer.memberId === null) return
    await save(false)
  }

  // The saved link's app status; a newly picked member is checked on the list after saving
  const notReadyName = user && user.member_id === officer.memberId && user.member_app_ready === 0 ? user.member_name : null

  return (
    <>
      <Dialog open={Boolean(user)} onOpenChange={(o) => !update.isPending && onOpenChange(o)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} className="contents" noValidate>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="size-5 text-primary" /> {t('settings.editUser')}
              </DialogTitle>
              <DialogDescription>{t('settings.editUserDesc')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <Field label={t('settings.fullName')} required>
                {({ id }) => <Input id={id} autoFocus value={form.full_name} onChange={(e) => { setForm({ ...form, full_name: e.target.value }); setError(null) }} />}
              </Field>
              <div className="grid gap-1 text-sm">
                <span className="font-medium">{t('login.username')}</span>
                <span className="text-muted-foreground">@{user?.username}</span>
              </div>
              <Field label={t('settings.role')} required>
                {({ id }) => (
                  <NativeSelect id={id} value={form.role} onChange={(e) => { setForm({ ...form, role: e.target.value as SystemUser['role'] }); setError(null) }}>
                    <option value="user">{t('settings.roleUser')}</option>
                    <option value="admin">{t('settings.roleAdmin')}</option>
                    <option value="viewer">{t('role.viewer')}</option>
                  </NativeSelect>
                )}
              </Field>
              <OfficerFields value={officer} notReadyName={notReadyName} onChange={(v) => { setOfficer(v); setError(null) }} />
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={form.active} disabled={isSelf} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                <span className="grid gap-0.5">
                  <span className="font-medium">{t('settings.active')}</span>
                  <span className="text-muted-foreground">{isSelf ? t('settings.cannotDisableSelf') : t('settings.activeHint')}</span>
                </span>
              </label>
              <div className="grid gap-2">
                <Button type="button" variant="ghost" size="sm" className="justify-self-start" aria-expanded={showHistory} onClick={() => setShowHistory((s) => !s)}>
                  <History /> {t('settings.history')}
                </Button>
                {showHistory && user && <OfficerHistory userId={user.id} />}
              </div>
            </div>
            <ErrorBox text={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={update.isPending}>
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <HandoverDialog holder={holder} newName={form.full_name.trim()} busy={update.isPending} onCancel={() => setHolder(undefined)} onConfirm={() => save(true)} />
    </>
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
