import React, { useState } from 'react'
import RupeeInput from '../components/RupeeInput'
import ModalOverlay from '../components/ModalOverlay'
import { X } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { showToast } from '../components/Toast'
import { useT } from '../i18n'
import type { IncomeType } from '../types'

// The six groups the form has always offered. Seeded system types use their own
// vocabulary (Fees, Funeral, Interest…), so when editing one we add its group to
// the list — otherwise the select would silently show no match and saving would
// rewrite it.
const STANDARD_GROUPS = ['Subscription', 'Fine', 'Loan', 'Investment', 'Donation', 'Rental']

interface Props {
  onClose: () => void
  onCreated?: () => void
  /** Present when editing an existing type; absent when adding a new one. */
  incomeType?: IncomeType
}

export default function AddIncomeTypeModal({ onClose, onCreated, incomeType }: Props): React.ReactElement {
  const { t } = useT()
  const isEdit = Boolean(incomeType)
  const isSystem = Boolean(incomeType?.code)

  const [name, setName] = useState(incomeType?.name ?? '')
  const [amount, setAmount] = useState(
    incomeType && incomeType.standard_amount ? String(incomeType.standard_amount / 100) : ''
  )
  const [category, setCategory] = useState(incomeType?.category_group ?? 'Donation')
  const [submitting, setSubmitting] = useState(false)

  const { createIncomeType, updateIncomeType } = useSettings()

  const groups = STANDARD_GROUPS.includes(category) ? STANDARD_GROUPS : [...STANDARD_GROUPS, category]

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        standard_amount: Math.round(Number(amount) * 100) || 0,
        category_group: category
      }
      if (isEdit) {
        // A system type keeps its category group — the adaptive forms branch on it
        if (isSystem) delete (payload as Partial<typeof payload>).category_group
        await updateIncomeType(incomeType!.id, payload)
        showToast('success', t('itype.updated'))
      } else {
        await createIncomeType(payload)
        showToast('success', t('itype.added'))
      }
      onCreated?.()
      onClose()
    } catch (error: any) {
      showToast('error', error.message || t(isEdit ? 'itype.updateFailed' : 'itype.addFailed'))
      setSubmitting(false)
    }
  }

  const title = isEdit ? t('itype.editTitle') : t('itype.title')

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
              <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              {isSystem && (
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{t('itype.systemRenameHint')}</small>
              )}
            </div>

            <div className="form-group">
              <label>{t('itype.categoryGroup')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select
                className="form-control"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                disabled={isSystem}
              >
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g === 'Subscription' ? t('itype.optSubscription')
                      : g === 'Fine' ? t('itype.optFine')
                      : g === 'Loan' ? t('itype.optLoan')
                      : g === 'Investment' ? t('itype.optInvestment')
                      : g === 'Donation' ? t('itype.optDonation')
                      : g === 'Rental' ? t('itype.optRental')
                      : g}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{t('itype.defaultAmount')}</label>
              <RupeeInput value={amount} onChange={setAmount} />
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{t('itype.variableHint')}</small>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !name.trim()}>
              {submitting ? t('common.saving') : isEdit ? t('common.save') : t('itype.save')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
