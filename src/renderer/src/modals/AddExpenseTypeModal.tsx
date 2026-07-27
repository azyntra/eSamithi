import React, { useState } from 'react'
import RupeeInput from '../components/RupeeInput'
import ModalOverlay from '../components/ModalOverlay'
import { X } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { showToast } from '../components/Toast'
import { useT } from '../i18n'
import type { ExpenseType } from '../types'

interface Props {
  onClose: () => void
  onCreated?: () => void
  /** Present when editing an existing type; absent when adding a new one. */
  expenseType?: ExpenseType
}

export default function AddExpenseTypeModal({ onClose, onCreated, expenseType }: Props): React.ReactElement {
  const { t } = useT()
  const isEdit = Boolean(expenseType)
  const isSystem = Boolean(expenseType?.code)

  const [name, setName] = useState(expenseType?.name ?? '')
  const [amount, setAmount] = useState(
    expenseType && expenseType.standard_payout ? String(expenseType.standard_payout / 100) : ''
  )
  const [submitting, setSubmitting] = useState(false)

  const { createExpenseType, updateExpenseType } = useSettings()

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        standard_payout: Math.round(Number(amount) * 100) || 0
      }
      if (isEdit) {
        await updateExpenseType(expenseType!.id, payload)
        showToast('success', t('etype.updated'))
      } else {
        await createExpenseType(payload)
        showToast('success', t('etype.added'))
      }
      onCreated?.()
      onClose()
    } catch (error: any) {
      showToast('error', error.message || t(isEdit ? 'etype.updateFailed' : 'etype.addFailed'))
      setSubmitting(false)
    }
  }

  const title = isEdit ? t('etype.editTitle') : t('etype.title')

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal modal-sm" role="dialog" aria-label={title} aria-modal="true">
        <div className="modal-header gradient-header">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.close')}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>{t('common.name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder={t('etype.namePlaceholder')} />
              {isSystem && (
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{t('itype.systemRenameHint')}</small>
              )}
            </div>

            <div className="form-group">
              <label>{t('etype.defaultPayout')}</label>
              <RupeeInput value={amount} onChange={setAmount} />
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{t('itype.variableHint')}</small>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !name.trim()}>
              {submitting ? t('common.saving') : isEdit ? t('common.save') : t('etype.save')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
