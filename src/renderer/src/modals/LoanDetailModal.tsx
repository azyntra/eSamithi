import React, { useState, useEffect, useCallback } from 'react'
import { X, ShieldCheck, HandCoins, Printer, Archive } from 'lucide-react'
import { showToast } from '../components/Toast'
import ModalOverlay from '../components/ModalOverlay'
import { formatCurrency } from '../utils/formatters'
import { printReceipt, buildReceiptHtml } from '../utils/print'
import RepayLoanModal from './RepayLoanModal'
import { useT } from '../i18n'
import type { Loan } from '../types'

interface Guarantor {
  id: number
  full_name: string
  nic: string | null
  phone: string | null
}

interface LoanPayment {
  id: number
  date: string
  principal_paid: number
  interest_paid: number
  fines_paid: number
}

interface LoanDetail extends Loan {
  member_phone?: string | null
  member_society_id?: string | null
  guarantors: Guarantor[]
  payments: LoanPayment[]
}

interface Props {
  loanId: number
  onClose: () => void
  onChanged: () => void
  wallets: Array<{ id: number; name: string; is_active: number }>
  societyName: string
}

export default function LoanDetailModal({ loanId, onClose, onChanged, wallets, societyName }: Props): React.ReactElement {
  const { t } = useT()
  const [loan, setLoan] = useState<LoanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRepay, setShowRepay] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      const data = await window.api.loans.getById(loanId)
      setLoan(data)
    } catch (err: any) {
      showToast('error', err.message || t('lform.loadFailed'))
      onClose()
    } finally {
      setLoading(false)
    }
  }, [loanId, onClose])

  useEffect(() => {
    load()
  }, [load])

  const totalOwed = loan ? loan.principal_owed + loan.interest_owed + loan.fines_owed : 0

  const handlePrintPaymentReceipt = (p: LoanPayment): void => {
    if (!loan) return
    const totalPaid = p.principal_paid + p.interest_paid + p.fines_paid
    printReceipt(buildReceiptHtml({
      societyName,
      title: 'Loan Repayment Receipt',
      receiptNo: `LNP-${String(p.id).padStart(5, '0')}`,
      date: new Date(p.date).toLocaleDateString('en-GB'),
      rows: [
        ['Borrower', loan.member_name || '—'],
        ['Loan Ref.', `#${loan.id}`],
        ['Applied to Fine', formatCurrency(p.fines_paid)],
        ['Applied to Interest', formatCurrency(p.interest_paid)],
        ['Applied to Principal', formatCurrency(p.principal_paid)]
      ],
      amountLabel: 'Total Paid',
      amountValue: formatCurrency(totalPaid),
      footerNote: 'Fine → Interest → Principal allocation as per society rules.'
    }))
  }

  const handlePrintStatement = (): void => {
    if (!loan) return
    printReceipt(buildReceiptHtml({
      societyName,
      title: 'Loan Statement',
      receiptNo: `LN-${String(loan.id).padStart(5, '0')}`,
      date: new Date().toLocaleDateString('en-GB'),
      rows: [
        ['Borrower', loan.member_name || '—'],
        ['NIC', loan.member_nic || '—'],
        ['Issued On', loan.date_issued ? new Date(loan.date_issued).toLocaleDateString('en-GB') : '—'],
        ['Original Principal', formatCurrency(loan.principal_amount)],
        ['Remaining Principal', formatCurrency(loan.principal_owed)],
        ['Outstanding Interest', formatCurrency(loan.interest_owed)],
        ['Outstanding Fine', formatCurrency(loan.fines_owed)],
        ['Status', loan.status]
      ],
      amountLabel: 'Total Outstanding',
      amountValue: formatCurrency(totalOwed)
    }))
  }

  const cellLabel: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }
  const cellValue: React.CSSProperties = { fontSize: '1.05rem', fontWeight: 800 }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal" role="dialog" aria-label={t('lform.detailTitle')} aria-modal="true" style={{ maxWidth: '760px' }}>
        <div className="modal-header gradient-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HandCoins size={20} /> {t('lform.detailTitle')}
          </h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.close')}><X size={20} /></button>
        </div>

        <div className="modal-body">
          {loading || !loan ? (
            <div className="spinner-wrapper" style={{ minHeight: '260px' }}><div className="spinner"></div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Borrower + status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                    {loan.member_name}
                    {Number(loan.is_migrated) === 1 && (
                      <span className="badge-neutral" style={{ marginLeft: '8px', fontSize: '0.68rem', padding: '2px 8px', verticalAlign: 'middle' }}>
                        <Archive size={11} style={{ marginRight: '3px', verticalAlign: '-1px' }} />{t('loans.migrated')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {t('members.nic')} {loan.member_nic || '—'} · {t('lform.issuedShort')} {loan.date_issued ? new Date(loan.date_issued).toLocaleDateString('en-GB') : '—'}
                    {loan.purpose ? ` · ${loan.purpose}` : ''}
                  </div>
                </div>
                <span className={`status-badge ${
                  loan.status === 'Active' ? 'badge-primary' :
                  loan.status === 'Overdue' ? 'badge-danger' :
                  loan.status === 'Paid' ? 'badge-success' : 'badge-neutral'
                }`}>{loan.status}</span>
              </div>

              {/* Outstanding breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                  <div style={cellLabel}>{t('lform.originalPrincipalShort')}</div>
                  <div style={cellValue}>{formatCurrency(loan.principal_amount)}</div>
                </div>
                <div style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                  <div style={cellLabel}>{t('lform.remainingPrincipal')}</div>
                  <div style={cellValue}>{formatCurrency(loan.principal_owed)}</div>
                </div>
                <div style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                  <div style={cellLabel}>{t('lform.outstandingInterest')}</div>
                  <div style={{ ...cellValue, color: loan.interest_owed > 0 ? 'var(--danger)' : undefined }}>{formatCurrency(loan.interest_owed)}</div>
                </div>
                <div style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                  <div style={cellLabel}>{t('lform.outstandingFine')}</div>
                  <div style={{ ...cellValue, color: loan.fines_owed > 0 ? 'var(--danger)' : undefined }}>{formatCurrency(loan.fines_owed)}</div>
                </div>
              </div>

              {/* Guarantors */}
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} color="var(--primary)" /> {t('lform.guarantorsCount', { count: loan.guarantors.length })}
                </h4>
                {loan.guarantors.length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {t('lform.noGuarantors')}{Number(loan.is_migrated) === 1 ? t('lform.migratedSuffix') : ''}.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {loan.guarantors.map(g => (
                      <div key={g.id} style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{g.full_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {g.nic || '—'}{g.phone ? ` · ${g.phone}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment history */}
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px' }}>{t('lform.repaymentHistory', { count: loan.payments.length })}</h4>
                {loan.payments.length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('lform.noRepayments')}</div>
                ) : (
                  <div className="table-container" style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{t('common.date')}</th>
                          <th className="text-right">{t('lform.fine')}</th>
                          <th className="text-right">{t('reports.interest')}</th>
                          <th className="text-right">{t('reports.principal')}</th>
                          <th className="text-right">{t('common.total')}</th>
                          <th className="text-center">{t('lform.receipt')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loan.payments.map(p => (
                          <tr key={p.id}>
                            <td>{new Date(p.date).toLocaleDateString()}</td>
                            <td className="text-right">{formatCurrency(p.fines_paid)}</td>
                            <td className="text-right">{formatCurrency(p.interest_paid)}</td>
                            <td className="text-right">{formatCurrency(p.principal_paid)}</td>
                            <td className="text-right" style={{ fontWeight: 700 }}>{formatCurrency(p.fines_paid + p.interest_paid + p.principal_paid)}</td>
                            <td className="text-center">
                              <button className="btn-icon" title={t('ledger.printReceipt')} style={{ color: 'var(--primary)' }} onClick={() => handlePrintPaymentReceipt(p)}>
                                <Printer size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn btn-secondary" onClick={handlePrintStatement} disabled={!loan}>
            <Printer size={16} /> {t('lform.printStatement')}
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.close')}</button>
            {loan && (loan.status === 'Active' || loan.status === 'Overdue') && (
              <button type="button" className="btn btn-primary" onClick={() => setShowRepay(true)}>
                <HandCoins size={16} /> {t('loans.recordRepayment')}
              </button>
            )}
          </div>
        </div>
      </div>

      {showRepay && loan && (
        <RepayLoanModal
          loan={loan}
          onClose={() => setShowRepay(false)}
          onRepaid={() => { load(); onChanged() }}
          wallets={wallets}
        />
      )}
    </ModalOverlay>
  )
}
