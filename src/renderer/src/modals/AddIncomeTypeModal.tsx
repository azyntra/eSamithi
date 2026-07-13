import React, { useState, useRef, useEffect } from 'react'
import RupeeInput from '../components/RupeeInput'
import ModalOverlay from '../components/ModalOverlay'
import { X } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { showToast } from '../components/Toast'
import { useT } from '../i18n'

interface Props {
  onClose: () => void
  onCreated?: () => void
}

export default function AddIncomeTypeModal({ onClose, onCreated }: Props): React.ReactElement {
  const { t } = useT()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Donation')
  const [submitting, setSubmitting] = useState(false)
  
  const { createIncomeType } = useSettings()


  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      await createIncomeType({ 
        name: name.trim(), 
        standard_amount: Math.round(Number(amount) * 100) || 0,
        category_group: category
      })
      showToast('success', t('itype.added'))
      onCreated?.()
      onClose()
    } catch (error: any) {
      showToast('error', error.message || t('itype.addFailed'))
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal modal-sm" role="dialog" aria-label={t('itype.title')} aria-modal="true">
        <div className="modal-header gradient-header">
          <h3>{t('itype.title')}</h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.close')}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>{t('common.name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>

            <div className="form-group">
              <label>{t('itype.categoryGroup')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} required>
                <option value="Subscription">{t('itype.optSubscription')}</option>
                <option value="Fine">{t('itype.optFine')}</option>
                <option value="Loan">{t('itype.optLoan')}</option>
                <option value="Investment">{t('itype.optInvestment')}</option>
                <option value="Donation">{t('itype.optDonation')}</option>
                <option value="Rental">{t('itype.optRental')}</option>
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
              {submitting ? t('common.saving') : t('itype.save')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
