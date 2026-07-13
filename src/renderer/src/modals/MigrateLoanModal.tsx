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
}

// Migration Mode workflow (Requirement 5, v2.0): enter the CURRENT position of
// an existing active loan from the paper records. No wallet is deducted and no
// historical transactions are created — the entered balances become the
// starting point for all future interest, fine, and repayment calculations.
export default function MigrateLoanModal({ onClose, onCreated }: Props): React.ReactElement {
  const { t } = useT()

  const [members, setMembers] = useState<Array<{ id: number; nic: string; full_name: string }>>([])
  const [submitting, setSubmitting] = useState(false)

  const [memberId, setMemberId] = useState<number | ''>('')
  const [originalPrincipalStr, setOriginalPrincipalStr] = useState('')
  const [principalOwedStr, setPrincipalOwedStr] = useState('')
  const [interestOwedStr, setInterestOwedStr] = useState('')
  const [finesOwedStr, setFinesOwedStr] = useState('')
  const [dateIssued, setDateIssued] = useState('')
  const [purpose, setPurpose] = useState('')

  useEffect(() => {
    window.api.members.getAllSlim().then(setMembers)
  }, [])

  const toCents = (s: string): number => Math.round(Number(s || 0) * 100)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (memberId === '') {
      showToast('error', t('lform.selectBorrower'))
      return
    }
    const principalOwed = toCents(principalOwedStr)
    if (principalOwed <= 0) {
      showToast('error', t('lform.remainingGtZero'))
      return
    }
    const originalPrincipal = toCents(originalPrincipalStr)
    if (originalPrincipal > 0 && originalPrincipal < principalOwed) {
      showToast('error', t('lform.originalLessThanRemaining'))
      return
    }

    setSubmitting(true)
    try {
      await window.api.loans.migrate({
        member_id: memberId,
        principal_amount: originalPrincipal || principalOwed,
        principal_owed: principalOwed,
        interest_owed: toCents(interestOwedStr),
        fines_owed: toCents(finesOwedStr),
        date_issued: dateIssued || null,
        purpose: purpose.trim() || null
      })
      showToast('success', t('lform.migrateSuccess'))
      onCreated()
      onClose()
    } catch (error: any) {
      showToast('error', error.message || t('lform.migrateFailed'))
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal" role="dialog" aria-label={t('loans.addExisting')} aria-modal="true">
        <div className="modal-header gradient-header">
          <h3>{t('lform.migrateTitle')}</h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.close')}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '16px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {t('lform.migrateInfoPre')} <strong>{t('lform.migrateInfoStrong')}</strong> {t('lform.migrateInfoPost')}
            </div>

            <div className="form-group full-width">
              <label>{t('lform.borrower')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <SearchableSelect
                options={members.map(m => ({ value: m.id, label: m.full_name, sublabel: m.nic }))}
                value={memberId}
                onChange={(val) => setMemberId(Number(val))}
                placeholder={t('lform.selectMember')}
                required
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>{t('lform.originalPrincipalRs')}</label>
                <RupeeInput value={originalPrincipalStr} onChange={setOriginalPrincipalStr} placeholder={t('lform.originalPrincipalPlaceholder')} />
              </div>
              <div className="form-group">
                <label>{t('lform.remainingPrincipalRs')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <RupeeInput style={{ fontWeight: 700 }} value={principalOwedStr} onChange={setPrincipalOwedStr} required />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>{t('lform.outstandingInterestRs')}</label>
                <RupeeInput value={interestOwedStr} onChange={setInterestOwedStr} />
              </div>
              <div className="form-group">
                <label>{t('lform.outstandingFineRs')}</label>
                <RupeeInput value={finesOwedStr} onChange={setFinesOwedStr} />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>{t('lform.originalIssueDate')}</label>
                <input type="date" max={new Date().toISOString().split('T')[0]} className="form-control" value={dateIssued} onChange={(e) => setDateIssued(e.target.value)} />
              </div>
              <div className="form-group">
                <label>{t('lform.notesLabel')}</label>
                <input type="text" className="form-control" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t('lform.migrateNotesPlaceholder')} />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('lform.migrating') : t('loans.addExisting')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
