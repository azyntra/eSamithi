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

export default function AddExpenseTypeModal({ onClose, onCreated }: Props): React.ReactElement {
  const { t } = useT()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  const { createExpenseType } = useSettings()


  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      await createExpenseType({ 
        name: name.trim(), 
        standard_payout: Math.round(Number(amount) * 100) || 0
      })
      showToast('success', t('etype.added'))
      onCreated?.()
      onClose()
    } catch (error: any) {
      showToast('error', error.message || t('etype.addFailed'))
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal modal-sm" role="dialog" aria-label={t('etype.title')} aria-modal="true">
        <div className="modal-header gradient-header">
          <h3>{t('etype.title')}</h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.close')}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>{t('common.name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder={t('etype.namePlaceholder')} />
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
              {submitting ? t('common.saving') : t('etype.save')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
