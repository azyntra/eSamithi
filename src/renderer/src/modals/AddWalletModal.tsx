import React, { useState, useRef, useEffect } from 'react'
import RupeeInput from '../components/RupeeInput'
import ModalOverlay from '../components/ModalOverlay'
import { X } from 'lucide-react'
import { showToast } from '../components/Toast'
import { useT } from '../i18n'

interface Props {
  onClose: () => void
  onCreated: () => void
  // Opening balances can only be entered during Migration Mode (Requirement 2)
  allowOpeningBalance?: boolean
}

export default function AddWalletModal({ onClose, onCreated, allowOpeningBalance = false }: Props): React.ReactElement {
  const { t } = useT()
  const [name, setName] = useState('')
  const [walletType, setWalletType] = useState<'Cash' | 'Bank'>('Cash')
  const [openingBalance, setOpeningBalance] = useState('')
  const [submitting, setSubmitting] = useState(false)


  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return

    const balanceCents = allowOpeningBalance ? Math.round(Number(openingBalance || '0') * 100) : 0

    setSubmitting(true)
    try {
      await window.api.wallets.create({ 
        name: name.trim(), 
        wallet_type: walletType,
        opening_balance: balanceCents
      })
      showToast('success', t('wform.walletCreated'))
      onCreated()
      onClose()
    } catch (error: any) {
      showToast('error', error.message || t('wform.walletAddFailed'))
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal modal-sm" role="dialog" aria-label={t('wform.addWalletTitle')} aria-modal="true">
        <div className="modal-header gradient-header">
          <h3>{t('wform.addWalletTitle')}</h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.close')}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>{t('wallet.walletName')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input 
                type="text" 
                className="form-control" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('wform.walletNamePlaceholder')}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>{t('wform.walletType')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select 
                className="form-control"
                value={walletType}
                onChange={(e) => setWalletType(e.target.value as 'Cash' | 'Bank')}
                required
              >
                <option value="Cash">{t('wform.optCash')}</option>
                <option value="Bank">{t('wform.optBank')}</option>
              </select>
            </div>

            {allowOpeningBalance && (
              <div className="form-group">
                <label>{t('wform.openingBalance')}</label>
                <RupeeInput
                  style={{ fontWeight: 700, color: 'var(--success)' }}
                  value={openingBalance}
                  onChange={setOpeningBalance}
                />
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{t('wform.openingBalanceHint')}</small>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !name.trim()}>
              {submitting ? t('common.saving') : t('wform.createWallet')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
