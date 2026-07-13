import React, { useState, useEffect, useRef } from 'react'
import RupeeInput from '../components/RupeeInput'
import ModalOverlay from '../components/ModalOverlay'
import { X } from 'lucide-react'
import { showToast } from '../components/Toast'
import SearchableSelect from '../components/SearchableSelect'
import { useT } from '../i18n'
interface Props {
  onClose: () => void
  onCreated: () => void
  wallets: Array<{ id: number; name: string; balance: number; is_active: number }>
  settings: Record<string, string>
}

export default function IssueLoanModal({ onClose, onCreated, wallets, settings }: Props): React.ReactElement {
  const { t } = useT()

  const activeWallets = wallets.filter(w => w.is_active == 1)

  const [members, setMembers] = useState<Array<{ id: number; nic: string; full_name: string }>>([])
  const [submitting, setSubmitting] = useState(false)

  // Config bounds
  const maxLoanLimit = Number(settings.max_loan_limit || 100000)

  // Form State — exactly two guarantors are required (Requirement 5, v2.0)
  const [memberId, setMemberId] = useState<number | ''>('')
  const [principalStr, setPrincipalStr] = useState('')
  const [purpose, setPurpose] = useState('')
  const [dateIssued, setDateIssued] = useState(new Date().toISOString().split('T')[0])
  const [walletId, setWalletId] = useState<number | ''>('')
  const [guarantor1, setGuarantor1] = useState<number | ''>('')
  const [guarantor2, setGuarantor2] = useState<number | ''>('')

  useEffect(() => {
    window.api.members.getAllSlim().then(setMembers)
  }, [])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (memberId === '' || walletId === '') {
      showToast('error', t('lform.selectMemberWallet'))
      return
    }

    if (guarantor1 === '' || guarantor2 === '') {
      showToast('error', t('lform.twoGuarantors'))
      return
    }

    if (guarantor1 === guarantor2) {
      showToast('error', t('lform.guarantorsDifferent'))
      return
    }

    if (guarantor1 === Number(memberId) || guarantor2 === Number(memberId)) {
      showToast('error', t('lform.ownGuarantor'))
      return
    }

    const principalCents = Math.round(Number(principalStr) * 100)
    if (principalCents <= 0) {
      showToast('error', t('lform.principalGtZero'))
      return
    }

    if (principalCents > maxLoanLimit) {
      showToast('error', t('lform.maxLimit', { max: maxLoanLimit / 100 }))
      return
    }

    const selectedWallet = activeWallets.find(w => w.id === Number(walletId))
    if (selectedWallet && principalCents > selectedWallet.balance) {
      showToast('error', t('lform.insufficientWallet'))
      return
    }

    setSubmitting(true)
    try {
      await window.api.loans.issue({
        member_id: memberId,
        principal_amount: principalCents,
        purpose: purpose.trim(),
        date_issued: dateIssued,
        disbursement_wallet_id: walletId,
        guarantor_ids: [guarantor1, guarantor2]
      })
      showToast('success', t('lform.issued'))
      onCreated()
      onClose()
    } catch (error: any) {
      showToast('error', error.message || t('lform.issueFailed'))
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal" role="dialog" aria-label={t('lform.issueTitle')} aria-modal="true">
        <div className="modal-header gradient-header">
          <h3>{t('lform.issueTitle')}</h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.close')}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>{t('lform.applicantMember')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <SearchableSelect
                  options={members.map(m => ({ value: m.id, label: m.full_name, sublabel: m.nic }))}
                  value={memberId}
                  onChange={(val) => setMemberId(Number(val))}
                  placeholder={t('lform.selectMember')}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('lform.dateIssued')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="date" max={new Date().toISOString().split('T')[0]} className="form-control" value={dateIssued} onChange={(e) => setDateIssued(e.target.value)} required />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>{t('wform.principalAmount')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <RupeeInput max={maxLoanLimit / 100} style={{ fontWeight: 700 }} value={principalStr} onChange={setPrincipalStr} required />
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{t('lform.maxLimitHint', { max: maxLoanLimit / 100 })}</small>
              </div>
              <div className="form-group">
                <label>{t('lform.disbursementWallet')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select className="form-control" value={walletId} onChange={(e) => setWalletId(Number(e.target.value))} required>
                  <option value="" disabled>{t('wform.selectWallet')}</option>
                  {activeWallets.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group full-width">
              <label>{t('lform.purposeOfLoan')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" className="form-control" value={purpose} onChange={(e) => setPurpose(e.target.value)} required placeholder={t('lform.purposePlaceholder')} />
            </div>

            <div className="form-grid" style={{ marginTop: '8px' }}>
              <div className="form-group">
                <label>{t('lform.guarantor1')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <SearchableSelect
                  options={members
                    .filter(m => m.id !== memberId && m.id !== guarantor2)
                    .map(m => ({ value: m.id, label: m.full_name, sublabel: m.nic }))}
                  value={guarantor1}
                  onChange={(val) => setGuarantor1(Number(val))}
                  placeholder={t('lform.selectGuarantor1')}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('lform.guarantor2')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <SearchableSelect
                  options={members
                    .filter(m => m.id !== memberId && m.id !== guarantor1)
                    .map(m => ({ value: m.id, label: m.full_name, sublabel: m.nic }))}
                  value={guarantor2}
                  onChange={(val) => setGuarantor2(Number(val))}
                  placeholder={t('lform.selectGuarantor2')}
                  required
                />
              </div>
            </div>
            <small style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
              {t('lform.guarantorNote')}
            </small>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || guarantor1 === '' || guarantor2 === ''}>
              {submitting ? t('common.processing') : t('lform.issueDisburse')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
