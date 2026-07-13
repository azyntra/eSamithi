import React, { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { showToast } from '../components/Toast'
import ModalOverlay from '../components/ModalOverlay'
import { useT } from '../i18n'
import type { Member } from '../types'

interface DeleteConfirmModalProps {
  member: Member
  onClose: () => void
  onDeleted: () => void
  deleteMember: (id: number) => Promise<{ success: boolean }>
}

export default function DeleteConfirmModal({
  member,
  onClose,
  onDeleted,
  deleteMember
}: DeleteConfirmModalProps): React.ReactElement {
  const { t } = useT()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (): Promise<void> => {
    setDeleting(true)
    try {
      await deleteMember(member.id)
      showToast('error', t('del.deleted'))
      onDeleted()
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : t('del.failed')
      showToast('error', message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div
        className="modal modal-sm"
        role="alertdialog"
        aria-label={t('del.title')}
        aria-modal="true"
      >
        <div className="modal-body">
          <div className="delete-dialog">
            <div className="warning-icon">
              <AlertTriangle size={28} />
            </div>
            <h4>{t('del.confirmQ')}</h4>
            <p>
              {t('del.msgPre')} <strong>{member.full_name}</strong> {t('del.msgPost')}
            </p>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={deleting}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? t('common.deleting') : t('common.delete')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
