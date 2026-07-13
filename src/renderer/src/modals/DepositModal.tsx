import React, { useState, useRef, useEffect } from 'react'
import RupeeInput from '../components/RupeeInput'
import ModalOverlay from '../components/ModalOverlay'
import { X, CirclePlus } from 'lucide-react'
import { showToast } from '../components/Toast'
import { useT } from '../i18n'

interface Props {
  walletId: number
  walletName: string
  onClose: () => void
  onDeposited: () => void
}

export default function DepositModal({ walletId, walletName, onClose, onDeposited }: Props): React.ReactElement {
  const { t } = useT()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState(t('wform.manualDeposit'))
  const [submitting, setSubmitting] = useState(false)


  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    
    const num = parseFloat(amount.replace(/,/g, ''))
    if (isNaN(num) || num <= 0) {
      showToast('error', t('wform.invalidAmount'))
      return
    }

    const amountCents = Math.round(num * 100)

    setSubmitting(true)
    try {
      await window.api.wallets.deposit(walletId, amountCents, note.trim())
      showToast('success', t('wform.depositSuccess', { name: walletName }))
      onDeposited()
      onClose()
    } catch (error: any) {
      showToast('error', error.message || t('wform.depositFailed'))
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal modal-sm" role="dialog" aria-modal="true">
        <div className="modal-header gradient-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CirclePlus size={20} /> {t('wform.depositTitle', { name: walletName })}
          </h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>{t('wform.amountRs')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <RupeeInput
                style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}
                value={amount}
                onChange={setAmount}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>{t('wform.noteRef')}</label>
              <input 
                type="text" 
                className="form-control" 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('wform.notePlaceholder')}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !amount}>
              {submitting ? t('common.processing') : t('wform.confirmDeposit')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
