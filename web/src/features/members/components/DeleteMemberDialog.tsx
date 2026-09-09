import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { errorMessage } from '@/lib/api/errors'
import { useT } from '@/lib/i18n'
import { useDeleteMember } from '../queries'
import type { Member } from '../types'

export function DeleteMemberDialog({ member, onOpenChange, onDeleted }: { member: Member | null; onOpenChange: (open: boolean) => void; onDeleted?: () => void }) {
  const { t } = useT()
  const del = useDeleteMember()
  return (
    <ConfirmDialog
      open={Boolean(member)}
      onOpenChange={onOpenChange}
      danger
      title={t('del.confirmQ')}
      description={
        <>
          {t('del.msgPre')} <strong className="text-foreground">{member?.full_name || member?.society_id}</strong> {t('del.msgPost')}
        </>
      }
      typeToConfirm={member?.society_id}
      typeToConfirmLabel={member ? t('members.deleteTyped', { id: member.society_id }) : undefined}
      confirmLabel={t('common.delete')}
      busy={del.isPending}
      onConfirm={async () => {
        if (!member) return
        try {
          await del.mutateAsync(member.id)
          toast.success(t('del.deleted'))
          onOpenChange(false)
          onDeleted?.()
        } catch (e) {
          toast.error(errorMessage(e, t('del.failed')))
        }
      }}
    />
  )
}
