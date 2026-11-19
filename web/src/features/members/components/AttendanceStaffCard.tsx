import { useState } from 'react'
import { ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { errorMessage } from '@/lib/api/errors'
import { useSession } from '@/lib/api/session'
import { formatDate } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { memberLabel } from '@/lib/members'
import { useSetAppStaff } from '../queries'
import { isAppEnabled, isAttendanceStaff, isMemberActive, type MemberWithDependents } from '../types'

// Nominate this member as attendance staff in the mobile app, or remove it
// (docs/MOBILE-STAFF-ATTENDANCE-REQUIREMENTS.md §4.1). Administrators and
// Staff may change it; view-only accounts see the state. The server is the
// control — this card only decides which buttons to offer.
export function AttendanceStaffCard({ member }: { member: MemberWithDependents }) {
  const { t, lang } = useT()
  const { user } = useSession()
  const setStaff = useSetAppStaff()
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  const canChange = user?.role === 'admin' || user?.role === 'user'
  const staff = isAttendanceStaff(member)
  const blocked = !isMemberActive(member) ? t('vmember.staffInactive') : !isAppEnabled(member) ? t('vmember.staffNeedsAccess') : null
  const name = memberLabel(member, t('members.unnamed'))

  const apply = async (attendance: 0 | 1) => {
    try {
      await setStaff.mutateAsync({ id: member.id, attendance })
      toast.success(attendance === 1 ? t('vmember.staffGrantedToast', { name }) : t('vmember.staffRevokedToast'))
      setConfirmRevoke(false)
    } catch (e) {
      toast.error(errorMessage(e))
      setConfirmRevoke(false)
    }
  }

  const since = member.app_staff_granted_at ? formatDate(new Date(member.app_staff_granted_at), lang) : null

  return (
    <>
      <Card className="max-w-2xl gap-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ScanLine className="size-4 text-primary" /> {t('vmember.staffSection')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t('vmember.staffHint')}</p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{t('vmember.staffStatus')}</span>
            {staff ? <Badge variant="success">{t('vmember.staffAllowed')}</Badge> : <Badge variant="neutral">{t('vmember.staffNotAllowed')}</Badge>}
          </div>
          {staff && since && (
            <p className="text-xs text-muted-foreground">
              {member.app_staff_granted_by_name ? t('vmember.staffGranted', { date: since, name: member.app_staff_granted_by_name }) : t('vmember.staffGrantedNoName', { date: since })}
            </p>
          )}
          {staff && !member.pin_set_at && <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">{t('vmember.staffNoPinNote')}</p>}
          {!staff && blocked && <p className="text-xs text-muted-foreground">{blocked}</p>}
          {canChange ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {staff ? (
                <Button variant="secondary" disabled={setStaff.isPending} onClick={() => setConfirmRevoke(true)}>
                  {t('vmember.staffRevokeBtn')}
                </Button>
              ) : (
                <Button loading={setStaff.isPending} disabled={blocked !== null} onClick={() => void apply(1)}>
                  <ScanLine /> {t('vmember.staffGrantBtn')}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t('vmember.staffViewOnly')}</p>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={(o) => !o && setConfirmRevoke(false)}
        danger
        title={t('vmember.staffSection')}
        description={t('vmember.staffRevokeConfirm')}
        confirmLabel={t('vmember.staffRevokeBtn')}
        busy={setStaff.isPending}
        onConfirm={() => void apply(0)}
      />
    </>
  )
}
