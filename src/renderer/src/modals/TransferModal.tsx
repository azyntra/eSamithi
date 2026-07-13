import React, { useState } from 'react'
import RupeeInput from '../components/RupeeInput'
import { X } from 'lucide-react'
import { showToast } from '../components/Toast'
import ModalOverlay from '../components/ModalOverlay'
import { formatCurrency } from '../utils/formatters'
import { useT } from '../i18n'
import type { Wallet } from '../types'

interface Props {
  wallets: Wallet[]
  onClose: () => void
  onTransferred: () => void
}

export default function TransferModal({ wallets, onClose, onTransferred }: Props): React.ReactElement {
  const { t } = useT()
  const activeWallets = wallets.filter(w => w.is_active === 1)
  
  const [fromId, setFromId] = useState<number>(activeWallets.length > 0 ? activeWallets[0].id : 0)
  const [toId, setToId] = useState<number>(activeWallets.length > 1 ? activeWallets[1].id : 0)
  const [amountStr, setAmountStr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (fromId === toId) {
      showToast('error', t('wform.sameWallet'))
      return
    }
    
    const amountCents = Math.round(Number(amountStr) * 100)
    if (amountCents <= 0) {
      showToast('error', t('wform.amountGtZero'))
      return
    }

    const sourceWallet = activeWallets.find(w => w.id === fromId)
    if (sourceWallet && amountCents > sourceWallet.balance) {
      showToast('error', t('wform.insufficientFunds', { max: formatCurrency(sourceWallet.balance) }))
      return
    }

    setSubmitting(true)
    try {
      await window.api.wallets.transfer(fromId, toId, amountCents)
      showToast('success', t('wform.transferSuccess'))
      onTransferred()
      onClose()
    } catch (error: any) {
      showToast('error', error.message || t('wform.transferFailed'))
      setSubmitting(false)
    }
  }

  if (activeWallets.length < 2) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="modal modal-sm" role="dialog" aria-modal="true">
          <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)', marginBottom: '8px' }}>{t('wform.cannotTransfer')}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>{t('wform.needTwoWallets')}</p>
            <button className="btn btn-primary" onClick={onClose}>{t('common.close')}</button>
          </div>
        </div>
      </ModalOverlay>
    )
  }

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal modal-sm" role="dialog" aria-label={t('wform.transferTitle')} aria-modal="true">
        <div className="modal-header gradient-header">
          <h3>{t('wform.transferTitle')}</h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.close')}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>{t('wform.fromWallet')}</label>
                <select 
                  className="form-control"
                  value={fromId}
                  onChange={(e) => setFromId(Number(e.target.value))}
                  required
                >
                  {activeWallets.map(w => (
                    <option key={w.id} value={w.id} disabled={w.id === toId}>
                      {w.name} ({formatCurrency(w.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>{t('wform.toWallet')}</label>
                <select 
                  className="form-control"
                  value={toId}
                  onChange={(e) => setToId(Number(e.target.value))}
                  required
                >
                  {activeWallets.map(w => (
                    <option key={w.id} value={w.id} disabled={w.id === fromId}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>{t('wform.amountRs')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <RupeeInput
                style={{ fontWeight: 600, fontSize: '1.05rem' }}
                value={amountStr}
                onChange={setAmountStr}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !amountStr}>
              {submitting ? t('common.processing') : t('wallet.transfer')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
