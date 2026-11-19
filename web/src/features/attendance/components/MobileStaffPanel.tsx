import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Smartphone, X } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MemberPicker } from '@/components/MemberPicker'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStaff, useSetAppStaff } from '@/features/members/queries'
import type { AppStaffMember } from '@/features/members/types'
import { errorMessage } from '@/lib/api/errors'
import { useSession } from '@/lib/api/session'
import { useT } from '@/lib/i18n'
import { memberLabel } from '@/lib/members'
import { cn } from '@/lib/utils'

// Who may mark attendance from their phone. Sits beside the event list so the
// officer setting up tomorrow's funeral can nominate someone in one place
// (docs/MOBILE-STAFF-ATTENDANCE-REQUIREMENTS.md FR-1.5).
export function MobileStaffPanel({ className }: { className?: string }) {
  const { t } = useT()
  const { user } = useSession()
  const staff = useAppStaff()
  const setStaff = useSetAppStaff()
  const [removing, setRemoving] = useState<AppStaffMember | null>(null)
  const canChange = user?.role === 'admin' || user?.role === 'user'
  const rows = staff.data ?? []

  const add = async (id: number | null) => {
    if (id === null) return
    try {
      await setStaff.mutateAsync({ id, attendance: 1 })
      toast.success(t('vmember.staffGrantedToast', { name: t('common.member') }))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const remove = async () => {
    if (!removing) return
    try {
      await setStaff.mutateAsync({ id: removing.id, attendance: 0 })
      toast.success(t('vmember.staffRevokedToast'))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setRemoving(null)
    }
  }

  return (
    <section className={cn('rounded-xl border border-border bg-card', className)} aria-label={t('att.mobileStaff')}>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="size-4 text-primary" /> {t('att.mobileStaff')}
          {rows.length > 0 && <span className="tnum rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{rows.length}</span>}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('att.mobileStaffHint')}</p>
      </div>

      {staff.isPending ? (
        <div className="grid gap-2 p-3">
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">{t('att.mobileStaffNone')}</p>
      ) : (
        <ul>
          {rows.map((m) => {
            const name = memberLabel(m, t('members.unnamed'))
            return (
              <li key={m.id} className="group flex items-center gap-2 border-b border-border px-4 py-2.5 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <Link to="/members/$memberId" params={{ memberId: m.id }} search={{ tab: 'app' }} className="block truncate text-sm font-medium hover:text-primary hover:underline">
                    {name}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="tnum">{m.society_id}</span>
                    {!m.enrolled && <Badge variant="warning" className="text-[10px]">{t('att.appNotSetUp')}</Badge>}
                    {m.granted_by_name && <span className="truncate">{t('att.addedBy', { name: m.granted_by_name })}</span>}
                  </div>
                </div>
                {canChange && (
                  <button
                    type="button"
                    className="grid size-7 shrink-0 place-items-center rounded-md text-danger opacity-60 transition-opacity hover:bg-danger-soft hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`${t('att.mobileStaffRemove')}: ${name}`}
                    title={t('att.mobileStaffRemove')}
                    onClick={() => setRemoving(m)}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="border-t border-border p-3">
        {canChange ? (
          <MemberPicker value={null} onChange={(id) => void add(id)} exclude={rows.map((r) => r.id)} placeholder={t('att.mobileStaffAdd')} ariaLabel={t('att.mobileStaffAdd')} allowClear={false} disabled={setStaff.isPending} />
        ) : (
          <p className="text-xs text-muted-foreground">{t('att.mobileStaffViewOnly')}</p>
        )}
      </div>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        danger
        title={t('att.mobileStaffRemove')}
        description={t('att.mobileStaffRemoveMsg', { name: removing ? memberLabel(removing, t('members.unnamed')) : '' })}
        confirmLabel={t('common.confirm')}
        busy={setStaff.isPending}
        onConfirm={remove}
      />
    </section>
  )
}
