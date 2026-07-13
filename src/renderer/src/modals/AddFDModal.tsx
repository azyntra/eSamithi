import React, { useState, useRef, useEffect } from 'react'
import RupeeInput from '../components/RupeeInput'
import ModalOverlay from '../components/ModalOverlay'
import { X, Landmark } from 'lucide-react'
import { showToast } from '../components/Toast'
import { formatCurrency } from '../utils/formatters'
import { useT } from '../i18n'

interface Props {
  onClose: () => void
  onCreated: () => void
  wallets: Array<{ id: number; name: string; balance: number; is_active: number }>
  // Migration Mode: paper-record FDs are entered without touching wallets
  inMigrationMode: boolean
}

export default function AddFDModal({ onClose, onCreated, wallets, inMigrationMode }: Props): React.ReactElement {
  const { t } = useT()
  const [fdNumber, setFdNumber] = useState('')
  const [bankName, setBankName] = useState('')
  const [principal, setPrincipal] = useState('')
  const [rate, setRate] = useState('')
  const [term, setTerm] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [maturityDate, setMaturityDate] = useState('')
  const [notes, setNotes] = useState('')
  const [linkedWalletId, setLinkedWalletId] = useState<number | ''>('')
  const [fundFromWallet, setFundFromWallet] = useState(!inMigrationMode)
  const [submitting, setSubmitting] = useState(false)

  const activeWallets = wallets.filter(w => w.is_active == 1)


  // Auto-calculate maturity date if term is entered
  useEffect(() => {
    if (startDate && term) {
      const date = new Date(startDate)
      date.setMonth(date.getMonth() + parseInt(term))
      setMaturityDate(date.toISOString().split('T')[0])
    }
  }, [startDate, term])

  const selectedWallet = activeWallets.find(w => w.id === Number(linkedWalletId))
  const willFund = fundFromWallet && !inMigrationMode && linkedWalletId !== ''

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    const principalCents = Math.round(parseFloat(principal) * 100)
    if (isNaN(principalCents) || principalCents <= 0) {
      showToast('error', t('wform.invalidPrincipal'))
      return
    }
    if (willFund && selectedWallet && principalCents > selectedWallet.balance) {
      showToast('error', t('wform.fdInsufficient'))
      return
    }
    if (fundFromWallet && !inMigrationMode && linkedWalletId === '') {
      showToast('error', t('wform.selectFundWallet'))
      return
    }

    setSubmitting(true)
    try {
      await window.api.fixedDeposits.create({
        fd_number: fdNumber.trim(),
        bank_name: bankName.trim(),
        principal: principalCents,
        interest_rate: parseFloat(rate),
        term_months: parseInt(term),
        start_date: startDate,
        maturity_date: maturityDate,
        notes: notes.trim(),
        linked_wallet_id: linkedWalletId === '' ? null : linkedWalletId,
        fund_from_wallet: willFund
      })
      showToast('success', t('wform.fdRegistered'))
      onCreated()
      onClose()
    } catch (error: any) {
      showToast('error', error.message || t('wform.fdSaveFailed'))
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header gradient-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Landmark size={20} /> {t('wform.fdTitle')}
          </h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>{t('wform.fdNumberRef')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="text" className="form-control" value={fdNumber} onChange={(e) => setFdNumber(e.target.value)} required placeholder={t('wform.fdNumberPlaceholder')} />
              </div>
              <div className="form-group">
                <label>{t('mform.bankName')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="text" className="form-control" value={bankName} onChange={(e) => setBankName(e.target.value)} required placeholder={t('wform.bankPlaceholder')} />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>{t('wform.principalAmount')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <RupeeInput style={{ fontWeight: 700 }} value={principal} onChange={setPrincipal} required />
              </div>
              <div className="form-group">
                <label>{t('wform.interestRate')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="number" step="0.1" className="form-control" value={rate} onChange={(e) => setRate(e.target.value)} required placeholder={t('wform.ratePlaceholder')} />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>{t('wform.termMonths')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="number" className="form-control" value={term} onChange={(e) => setTerm(e.target.value)} required placeholder={t('wform.termPlaceholder')} />
              </div>
              <div className="form-group">
                <label>{t('wform.startDate')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label>{t('wform.maturityDateCalc')}</label>
              <input type="date" className="form-control" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} required />
            </div>

            {/* Wallet linkage — keeps society cash and invested capital consistent */}
            <div className="form-group" style={{ padding: '12px', background: 'var(--bg-page)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <label>{t('wform.linkedWallet')} {!inMigrationMode && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
              <select className="form-control" value={linkedWalletId} onChange={(e) => setLinkedWalletId(e.target.value === '' ? '' : Number(e.target.value))} required={!inMigrationMode}>
                <option value="">{inMigrationMode ? t('wform.optNoneFd') : t('wform.selectWallet')}</option>
                {activeWallets.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({formatCurrency(w.balance)})</option>
                ))}
              </select>
              {inMigrationMode ? (
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                  {t('wform.fdMigrationHint')}
                </small>
              ) : (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={fundFromWallet} onChange={(e) => setFundFromWallet(e.target.checked)} />
                    {t('wform.fdDeductLabel')}
                  </label>
                  <small style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                    {t('wform.fdWithdrawHint')}
                  </small>
                </>
              )}
            </div>

            <div className="form-group">
              <label>{t('wform.additionalNotes')}</label>
              <textarea className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('wform.notesPlaceholder')} rows={2}></textarea>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('common.saving') : t('wform.registerInvestment')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
