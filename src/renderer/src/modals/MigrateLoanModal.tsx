import React, { useState, useEffect } from 'react'
import RupeeInput from '../components/RupeeInput'
import ModalOverlay from '../components/ModalOverlay'
import { X } from 'lucide-react'
import { showToast } from '../components/Toast'
import SearchableSelect from '../components/SearchableSelect'
import { useSettings } from '../hooks/useSettings'
import { formatCurrency } from '../utils/formatters'
import { formatPrintDate } from '../utils/print'
import { useT } from '../i18n'
import { memberOptions, MemberOption, SlimMember } from '../utils/members'
import ExistingLoansPanel from '../components/ExistingLoansPanel'
import type { Loan } from '../types'

interface Props {
  onClose: () => void
  onCreated: () => void
  /** Portfolio for the existing-loans panel — informational only here (the
      exposure cap deliberately does not apply to paper-record migration). */
  loans?: Loan[]
  /** Rendered at the top of the body — the New / Existing loan chooser. */
  headerSlot?: React.ReactNode
}

// Migration Mode workflow (Requirement 5, v2.0): enter the CURRENT position of
// an existing active loan from the paper records. No wallet is deducted and no
// historical transactions are created — the entered balances become the
// starting point for all future interest, fine, and repayment calculations.
//
// The "balances as of" date is what keeps those calculations honest: interest
// resumes from the day the society's figures were computed through, so no
// part-month is forgiven and the monthly charge day still matches the passbook.
export default function MigrateLoanModal({ onClose, onCreated, loans = [], headerSlot }: Props): React.ReactElement {
  const { t } = useT()
  const { settings } = useSettings()
  const today = new Date().toISOString().split('T')[0]

  const [members, setMembers] = useState<SlimMember[]>([])
  const [submitting, setSubmitting] = useState(false)

  const [memberId, setMemberId] = useState<number | ''>('')
  const [originalPrincipalStr, setOriginalPrincipalStr] = useState('')
  const [principalOwedStr, setPrincipalOwedStr] = useState('')
  const [interestOwedStr, setInterestOwedStr] = useState('')
  const [finesOwedStr, setFinesOwedStr] = useState('')
  const [dateIssued, setDateIssued] = useState('')
  const [asOfDate, setAsOfDate] = useState(today)
  const [status, setStatus] = useState<'Auto' | 'Defaulted'>('Auto')
  const [guarantor1, setGuarantor1] = useState<number | ''>('')
  const [guarantor2, setGuarantor2] = useState<number | ''>('')
  const [purpose, setPurpose] = useState('')

  useEffect(() => {
    window.api.members.getAllSlim().then(setMembers)
  }, [])

  const toCents = (s: string): number => Math.round(Number(s || 0) * 100)

  // What the officer should be able to check against the passbook before saving.
  const interestRate = Number(settings.monthly_interest_rate) || 0
  const principalOwedCents = toCents(principalOwedStr)
  const nextCharge = ((): { date: string; amount: number } | null => {
    if (!asOfDate || principalOwedCents <= 0 || interestRate <= 0) return null
    const [y, m, d] = asOfDate.split('-').map(Number)
    const nextMonth = m === 12 ? 1 : m + 1
    const nextYear = m === 12 ? y + 1 : y
    const daysInNext = new Date(nextYear, nextMonth, 0).getDate()
    const day = Math.min(d, daysInNext)
    return {
      date: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      amount: Math.round(principalOwedCents * (interestRate / 100))
    }
  })()

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
    if (asOfDate && dateIssued && asOfDate < dateIssued) {
      showToast('error', t('lform.asOfBeforeIssued'))
      return
    }
    const guarantorIds = [guarantor1, guarantor2].filter((g): g is number => g !== '')
    if (guarantorIds.length === 2 && guarantorIds[0] === guarantorIds[1]) {
      showToast('error', t('lform.guarantorsDistinct'))
      return
    }
    if (guarantorIds.includes(Number(memberId))) {
      showToast('error', t('lform.borrowerNotGuarantor'))
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
        as_of_date: asOfDate || null,
        status: status === 'Defaulted' ? 'Defaulted' : undefined,
        guarantor_ids: guarantorIds,
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

  const guarantorOptions = (exclude: number | ''): MemberOption[] =>
    memberOptions(members.filter((m) => m.id !== Number(memberId) && m.id !== exclude))

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal" role="dialog" aria-label={t('loans.addExisting')} aria-modal="true">
        <div className="modal-header gradient-header">
          <h3>{t('lform.migrateTitle')}</h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.close')}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {headerSlot}

            <div style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '16px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {t('lform.migrateInfoPre')} <strong>{t('lform.migrateInfoStrong')}</strong> {t('lform.migrateInfoPost')}
            </div>

            <div className="form-group full-width">
              <label>{t('lform.borrower')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <SearchableSelect
                options={memberOptions(members)}
                searchPlaceholder={t('common.searchMember')}
                value={memberId}
                onChange={(val) => setMemberId(Number(val))}
                placeholder={t('lform.selectMember')}
                required
              />
            </div>

            <ExistingLoansPanel loans={loans} memberId={memberId} maxLoanLimit={0} />

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
                <input type="date" max={today} className="form-control" value={dateIssued} onChange={(e) => setDateIssued(e.target.value)} />
              </div>
              <div className="form-group">
                <label>{t('lform.asOfDate')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="date" max={today} min={dateIssued || undefined} className="form-control" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} required />
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>{t('lform.asOfHint')}</small>
              </div>
            </div>

            {/* Check this against the passbook before saving */}
            {nextCharge && (
              <div style={{ background: 'var(--primary-light)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '16px', fontSize: '0.82rem', color: 'var(--primary)' }}>
                {t('lform.nextChargePreview', { amount: formatCurrency(nextCharge.amount), date: formatPrintDate(nextCharge.date) })}
              </div>
            )}

            <div className="form-grid">
              <div className="form-group">
                <label>{t('lform.guarantor1')}</label>
                <SearchableSelect
                  options={guarantorOptions(guarantor2)}
                  searchPlaceholder={t('common.searchMember')}
                  value={guarantor1}
                  onChange={(val) => setGuarantor1(val === '' ? '' : Number(val))}
                  placeholder={t('lform.guarantorOptional')}
                />
              </div>
              <div className="form-group">
                <label>{t('lform.guarantor2')}</label>
                <SearchableSelect
                  options={guarantorOptions(guarantor1)}
                  searchPlaceholder={t('common.searchMember')}
                  value={guarantor2}
                  onChange={(val) => setGuarantor2(val === '' ? '' : Number(val))}
                  placeholder={t('lform.guarantorOptional')}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>{t('lform.loanStatus')}</label>
                <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value as 'Auto' | 'Defaulted')}>
                  <option value="Auto">{t('lform.statusAuto')}</option>
                  <option value="Defaulted">{t('rcpt.stDefaulted')}</option>
                </select>
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
