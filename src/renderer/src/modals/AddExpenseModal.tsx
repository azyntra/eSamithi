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
  expenseTypes: Array<{ id: number; name: string; standard_payout: number; is_active: number; code?: string | null }>
  wallets: Array<{ id: number; name: string; balance: number; is_active: number }>
}

// ── Adaptive form configuration per expense type (Requirement 4, v2.0) ──
// Member-benefit payouts are paid to a registered member with the standard
// payout pre-filled (editable). Bills & other expenses are paid to a payee.
const MEMBER_BENEFIT_CODES = [
  'funeral_benefit',
  'inlaw_funeral_benefit',
  'hospital_assistance',
  'grade5_scholarship',
  'year_end_bonus'
]

const BILL_CATEGORIES = [
  'Electricity Bill',
  'Water Bill',
  'Telephone Bill',
  'Internet Bill',
  'Building Maintenance',
  'Operational Expenses'
]

export default function AddExpenseModal({ onClose, onCreated, expenseTypes, wallets }: Props): React.ReactElement {
  const { t } = useT()

  const activeWallets = wallets.filter(w => w.is_active == 1)
  const activeExpenseTypes = expenseTypes.filter(et => et.is_active == 1)

  const [members, setMembers] = useState<Array<{ id: number; nic: string; full_name: string }>>([])
  const [submitting, setSubmitting] = useState(false)

  // Form State — expense type is selected first; the rest of the form adapts
  const [expenseTypeId, setExpenseTypeId] = useState<number | ''>('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [memberId, setMemberId] = useState<number | ''>('')
  const [recipientType, setRecipientType] = useState<'Member' | 'Vendor'>('Vendor')
  const [vendorName, setVendorName] = useState('')
  const [billCategory, setBillCategory] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank Transfer' | 'Cheque'>('Cash')
  const [walletId, setWalletId] = useState<number | ''>('')
  const [voucherNo, setVoucherNo] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    window.api.members.getAllSlim().then(setMembers)
  }, [])

  const selectedType = activeExpenseTypes.find(et => et.id === Number(expenseTypeId))
  const code = selectedType?.code || ''

  const isMemberBenefit = MEMBER_BENEFIT_CODES.includes(code)
  const isBills = code === 'bills_operational'
  const isOther = code === 'other_expense'
  const isGeneric = code === '' && selectedType !== undefined // custom type without a code

  // Reset adaptive fields & pre-fill default amount when the type changes
  useEffect(() => {
    if (expenseTypeId === '') return
    if (selectedType && selectedType.standard_payout > 0) {
      setAmountStr((selectedType.standard_payout / 100).toFixed(2))
    } else {
      setAmountStr('')
    }
    setMemberId('')
    setVendorName('')
    setBillCategory(isBills ? BILL_CATEGORIES[0] : '')
    setRecipientType(isMemberBenefit ? 'Member' : 'Vendor')
  }, [expenseTypeId])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (expenseTypeId === '') {
      showToast('error', t('eform.selectTypeFirst'))
      return
    }

    const memberRequired = isMemberBenefit || ((isOther || isGeneric) && recipientType === 'Member')
    if (memberRequired && memberId === '') {
      showToast('error', t('common.pleaseMember'))
      return
    }
    if (isBills && !vendorName.trim()) {
      showToast('error', t('eform.enterPayeeBills'))
      return
    }
    if ((isOther || isGeneric) && recipientType === 'Vendor' && !vendorName.trim()) {
      showToast('error', t('eform.enterPayeeName'))
      return
    }
    if (isOther && !notes.trim()) {
      showToast('error', t('eform.enterDescExpense'))
      return
    }
    if (walletId === '') {
      showToast('error', t('common.pleaseWallet'))
      return
    }

    const amountCents = Math.round(Number(amountStr) * 100)
    if (amountCents <= 0) {
      showToast('error', t('wform.amountGtZero'))
      return
    }

    // Client-side wallet balance check
    const selectedWallet = activeWallets.find(w => w.id === Number(walletId))
    if (selectedWallet && amountCents > selectedWallet.balance) {
      showToast('error', t('lform.insufficientWallet'))
      return
    }

    setSubmitting(true)
    try {
      await window.api.expenses.create({
        date,
        recipient_type: memberRequired ? 'Member' : 'Vendor',
        member_id: memberRequired ? memberId : null,
        vendor_name: memberRequired ? null : vendorName.trim(),
        expense_type_id: expenseTypeId,
        amount: amountCents,
        payment_method: paymentMethod,
        wallet_id: walletId,
        voucher_no: voucherNo.trim() || null,
        notes: billCategory ? `${billCategory}${notes.trim() ? ` — ${notes.trim()}` : ''}` : (notes.trim() || null)
      })
      showToast('success', t('eform.recorded'))
      onCreated()
      onClose()
    } catch (error: any) {
      showToast('error', error.message || t('eform.recordFailed'))
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal" role="dialog" aria-label={t('eform.title')} aria-modal="true">
        <div className="modal-header gradient-header">
          <h3>{t('eform.title')}</h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.close')}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Step 1 — expense type drives the rest of the form */}
            <div className="form-group full-width">
              <label>{t('eform.expenseType')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select className="form-control" value={expenseTypeId} onChange={(e) => setExpenseTypeId(Number(e.target.value))} required autoFocus>
                <option value="" disabled>{t('eform.selectExpenseType')}</option>
                {activeExpenseTypes.map(et => (
                  <option key={et.id} value={et.id}>{et.name}</option>
                ))}
              </select>
              {isMemberBenefit && selectedType && selectedType.standard_payout > 0 && (
                <small style={{ color: 'var(--text-secondary)' }}>
                  {t('eform.defaultPrefilled')}
                </small>
              )}
            </div>

            {expenseTypeId !== '' && (
              <>
                {/* Recipient — adapts to the selected type */}
                {(isOther || isGeneric) && (
                  <div className="form-group full-width">
                    <label>{t('eform.recipientType')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select className="form-control" value={recipientType} onChange={(e) => setRecipientType(e.target.value as any)}>
                      <option value="Vendor">{t('eform.vendorServiceOther')}</option>
                      <option value="Member">{t('iform.registeredMember')}</option>
                    </select>
                  </div>
                )}

                {(isMemberBenefit || ((isOther || isGeneric) && recipientType === 'Member')) && (
                  <div className="form-group full-width">
                    <label>{t('common.member')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <SearchableSelect
                      options={members.map(m => ({ value: m.id, label: m.full_name, sublabel: m.nic }))}
                      value={memberId}
                      onChange={(val) => setMemberId(Number(val))}
                      placeholder={t('lform.selectMember')}
                      required
                    />
                  </div>
                )}

                {isBills && (
                  <div className="form-grid">
                    <div className="form-group">
                      <label>{t('eform.billCategory')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <select className="form-control" value={billCategory} onChange={(e) => setBillCategory(e.target.value)} required>
                        {BILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{t('eform.payee')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input type="text" className="form-control" value={vendorName} onChange={(e) => setVendorName(e.target.value)} required placeholder={t('eform.payeePlaceholderBills')} />
                    </div>
                  </div>
                )}

                {(isOther || isGeneric) && recipientType === 'Vendor' && (
                  <div className="form-group full-width">
                    <label>{t('eform.payeeRecipientName')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" className="form-control" value={vendorName} onChange={(e) => setVendorName(e.target.value)} required placeholder={t('eform.payeePlaceholderOther')} />
                  </div>
                )}

                {/* Common fields */}
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('wform.amountRs')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <RupeeInput style={{ fontWeight: 700, color: 'var(--danger)' }} value={amountStr} onChange={setAmountStr} required />
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
                    <label>{t('eform.deductFromWallet')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select className="form-control" value={walletId} onChange={(e) => setWalletId(Number(e.target.value))} required>
                      <option value="" disabled>{t('wform.selectWallet')}</option>
                      {activeWallets.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('eform.voucherNumber')}</label>
                    <input type="text" className="form-control" value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder={t('eform.voucherPlaceholder')} />
                  </div>
                  <div className="form-group">
                    <label>
                      {isOther ? <>{t('iform.description')} <span style={{ color: 'var(--danger)' }}>*</span></> : t('lform.notesRef')}
                    </label>
                    <input type="text" className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} required={isOther} placeholder={isOther ? t('eform.descPlaceholder') : t('eform.notesPlaceholder')} />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || expenseTypeId === ''}>
              {submitting ? t('lform.recording') : t('eform.title')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
