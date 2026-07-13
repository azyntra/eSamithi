import React, { useState, useEffect, useRef } from 'react'
import RupeeInput from '../components/RupeeInput'
import ModalOverlay from '../components/ModalOverlay'
import { X } from 'lucide-react'
import { showToast } from '../components/Toast'
import { formatCurrency } from '../utils/formatters'
import { useT } from '../i18n'
import type { Loan } from '../types'

interface Props {
  loan: Loan
  onClose: () => void
  onRepaid: () => void
  wallets: Array<{ id: number; name: string; is_active: number }>
}

// Repayments are applied automatically in this order (Requirement 5, v2.0):
// Outstanding Fine → Outstanding Interest → Loan Principal
export default function RepayLoanModal({ loan, onClose, onRepaid, wallets }: Props): React.ReactElement {
  const { t } = useT()
  const activeWallets = wallets.filter(w => w.is_active == 1)

  const [amountStr, setAmountStr] = useState('')
  const [walletId, setWalletId] = useState<number | ''>('')
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank Transfer' | 'Cheque'>('Cash')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)


  const totalOwed = loan.fines_owed + loan.interest_owed + loan.principal_owed

  // Live waterfall preview of how the entered amount will be allocated
  const amountCents = Math.max(0, Math.round(Number(amountStr || 0) * 100))
  const previewFines = Math.min(amountCents, loan.fines_owed)
  const previewInterest = Math.min(amountCents - previewFines, loan.interest_owed)
  const previewPrincipal = Math.min(amountCents - previewFines - previewInterest, loan.principal_owed)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (walletId === '') {
      showToast('error', t('lform.selectReceiveWallet'))
      return
    }
    if (amountCents <= 0) {
      showToast('error', t('lform.repayGtZero'))
      return
    }
    if (amountCents > totalOwed) {
      showToast('error', t('lform.exceedsOutstanding', { total: formatCurrency(totalOwed) }))
      return
    }

    setSubmitting(true)
    try {
      const result = await window.api.loans.repay(loan.id, {
        amount: amountCents,
        wallet_id: walletId,
        payment_method: paymentMethod,
        date,
        notes: notes.trim() || null
      })
      showToast('success', result.status === 'Paid' ? t('lform.fullySettled') : t('lform.repayRecorded'))
      onRepaid()
      onClose()
    } catch (error: any) {
      showToast('error', error.message || t('lform.repayFailed'))
      setSubmitting(false)
    }
  }

  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem' }

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal" role="dialog" aria-label={t('lform.repayTitle')} aria-modal="true">
        <div className="modal-header gradient-header">
          <h3>{t('lform.repayTitle')}</h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.close')}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Outstanding position */}
            <div style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, marginBottom: '8px' }}>{loan.member_name}</div>
              <div style={rowStyle}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('lform.outstandingFine')}</span>
                <span style={{ fontWeight: 600, color: loan.fines_owed > 0 ? 'var(--danger)' : 'inherit' }}>{formatCurrency(loan.fines_owed)}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('lform.outstandingInterest')}</span>
                <span style={{ fontWeight: 600, color: loan.interest_owed > 0 ? 'var(--danger)' : 'inherit' }}>{formatCurrency(loan.interest_owed)}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('lform.remainingPrincipal')}</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(loan.principal_owed)}</span>
              </div>
              <div style={{ ...rowStyle, borderTop: '1px solid var(--border)', marginTop: '4px', paddingTop: '10px' }}>
                <span style={{ fontWeight: 700 }}>{t('lform.totalOutstanding')}</span>
                <span style={{ fontWeight: 800, color: 'var(--danger)' }}>{formatCurrency(totalOwed)}</span>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>{t('lform.repayAmount')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <RupeeInput style={{ fontWeight: 700, color: 'var(--success)' }} value={amountStr} onChange={setAmountStr} required autoFocus />
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{t('lform.maxAmountHint', { amount: formatCurrency(totalOwed) })}</small>
              </div>
              <div className="form-group">
                <label>{t('common.date')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="date" max={new Date().toISOString().split('T')[0]} className="form-control" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>{t('lform.paymentMethod')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select className="form-control" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} required>
                  <option value="Cash">{t('lform.pmCash')}</option>
                  <option value="Bank Transfer">{t('lform.pmBankTransfer')}</option>
                  <option value="Cheque">{t('lform.pmCheque')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('lform.depositToWallet')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select className="form-control" value={walletId} onChange={(e) => setWalletId(Number(e.target.value))} required>
                  <option value="" disabled>{t('wform.selectWallet')}</option>
                  {activeWallets.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Waterfall preview */}
            {amountCents > 0 && (
              <div style={{ background: 'var(--bg-light, var(--bg-page))', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '12px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px' }}>
                  {t('lform.autoAllocation')}
                </div>
                <div style={rowStyle}><span>{t('lform.appliedFine')}</span><span style={{ fontWeight: 600 }}>{formatCurrency(previewFines)}</span></div>
                <div style={rowStyle}><span>{t('lform.appliedInterest')}</span><span style={{ fontWeight: 600 }}>{formatCurrency(previewInterest)}</span></div>
                <div style={rowStyle}><span>{t('lform.appliedPrincipal')}</span><span style={{ fontWeight: 600 }}>{formatCurrency(previewPrincipal)}</span></div>
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  {t('lform.allocationNote')}
                </small>
              </div>
            )}

            <div className="form-group full-width">
              <label>{t('lform.notesRef')}</label>
              <input type="text" className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('lform.receiptPlaceholder')} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || amountCents <= 0}>
              {submitting ? t('lform.recording') : t('loans.recordRepayment')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
