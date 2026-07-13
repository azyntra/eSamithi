import React, { useState } from 'react'
import { Plus, Search, HandCoins, UserCheck, ShieldCheck, Eye, Trash2, Archive, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { showToast } from '../components/Toast'
import { useLoans } from '../hooks/useLoans'
import { useWallets } from '../hooks/useWallets'
import { useSettings } from '../hooks/useSettings'
import { formatCurrency } from '../utils/formatters'
import { invalidateCaches } from '../utils/cache'
import ConfirmModal from '../components/ConfirmModal'
import IssueLoanModal from '../modals/IssueLoanModal'
import RepayLoanModal from '../modals/RepayLoanModal'
import MigrateLoanModal from '../modals/MigrateLoanModal'
import LoanDetailModal from '../modals/LoanDetailModal'
import { useT } from '../i18n'
import type { Loan } from '../types'

type SortKey = 'date_issued' | 'principal_amount' | 'balance'

const balanceOf = (l: Loan): number => l.principal_owed + l.interest_owed + l.fines_owed

export default function Loans(): React.ReactElement {
  const { t } = useT()
  const { loans, loading, error, fetchData } = useLoans()
  const { wallets } = useWallets()
  const { settings } = useSettings()
  const [searchTerm, setSearchTerm] = useState('')
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [showMigrateModal, setShowMigrateModal] = useState(false)
  const [repayLoan, setRepayLoan] = useState<Loan | null>(null)
  const [detailLoanId, setDetailLoanId] = useState<number | null>(null)
  const [deletingLoan, setDeletingLoan] = useState<Loan | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date_issued', dir: 'desc' })

  // Migration Mode (Requirement 2): existing paper-record loans can only be
  // entered before the developer flips migration_completed to true.
  const inMigrationMode = settings.migration_completed !== undefined && settings.migration_completed !== 'true'

  if (loading) return (
    <div className="page-container animation-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div className="spinner-wrapper">
        <div className="spinner"></div>
      </div>
    </div>
  )

  // Issuing, repaying, or deleting a loan moves money in a wallet — drop the
  // wallet and dashboard caches so those pages refetch the new balance.
  const afterLoanChange = async (): Promise<void> => {
    invalidateCaches('wallets', 'dashboard')
    await fetchData(true)
  }

  const handleDelete = async (id: number): Promise<void> => {
    try {
      await window.api.loans.delete(id)
      await afterLoanChange()
      showToast('success', t('loans.deleted'))
    } catch (err: any) {
      showToast('error', err.message || t('loans.deleteFailed'))
    }
  }

  const filteredLoans = loans.filter(l => 
    l.member_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.member_nic?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.purpose?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const sortedLoans = [...filteredLoans].sort((a, b) => {
    let cmp = 0
    if (sort.key === 'date_issued') cmp = new Date(a.date_issued).getTime() - new Date(b.date_issued).getTime()
    else if (sort.key === 'principal_amount') cmp = a.principal_amount - b.principal_amount
    else cmp = balanceOf(a) - balanceOf(b)
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const toggleSort = (key: SortKey): void => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))
  }

  const sortIcon = (key: SortKey): React.ReactElement =>
    sort.key !== key ? (
      <ArrowUpDown size={12} style={{ opacity: 0.5 }} />
    ) : sort.dir === 'asc' ? (
      <ArrowUp size={12} />
    ) : (
      <ArrowDown size={12} />
    )

  const sortableThStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none' }
  const thInner: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '4px' }

  const totalOwed = loans
    .filter(l => l.status === 'Active' || l.status === 'Overdue')
    .reduce((sum, l) => sum + l.principal_owed + l.interest_owed + l.fines_owed, 0)

  return (
    <div className="page-container animation-fade-in">
      <div className="page-header gradient-header">
        <div>
          <h1 className="page-title">{t('nav.loans')}</h1>
          <p className="page-subtitle">{t('loans.subtitle')}</p>
        </div>
        <div className="header-actions">
          {inMigrationMode && (
            <button className="btn btn-secondary glassmorphic" onClick={() => setShowMigrateModal(true)} title={t('loans.addExistingHint')}>
              <Archive size={18} />
              {t('loans.addExisting')}
            </button>
          )}
          <button className="btn btn-primary glassmorphic" onClick={() => setShowIssueModal(true)}>
            <Plus size={18} />
            {t('loans.issueNew')}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="settings-card">
        <div className="settings-list-header">
          <div className="search-container" style={{ position: 'relative', width: '360px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder={t('loans.searchPlaceholder')}
              className="form-control"
              style={{ paddingLeft: '36px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t('loans.outstandingExposure')}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger)' }}>{formatCurrency(totalOwed)}</div>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={sortableThStyle} onClick={() => toggleSort('date_issued')} aria-sort={sort.key === 'date_issued' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} title={t('loans.sortIssued')}>
                  <span style={thInner}>{t('loans.issuedDate')} {sortIcon('date_issued')}</span>
                </th>
                <th>{t('loans.memberApplicant')}</th>
                <th className="text-right" style={sortableThStyle} onClick={() => toggleSort('principal_amount')} aria-sort={sort.key === 'principal_amount' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} title={t('loans.sortPrincipal')}>
                  <span style={thInner}>{t('reports.principal')} {sortIcon('principal_amount')}</span>
                </th>
                <th className="text-right" style={sortableThStyle} onClick={() => toggleSort('balance')} aria-sort={sort.key === 'balance' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} title={t('loans.sortBalance')}>
                  <span style={thInner}>{t('loans.balanceOwed')} {sortIcon('balance')}</span>
                </th>
                <th className="text-center">{t('loans.guarantors')}</th>
                <th className="text-center">{t('common.status')}</th>
                <th className="text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedLoans.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">{t('loans.noLoans')}</td></tr>
              ) : (
                sortedLoans.map(l => (
                  <tr key={l.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{new Date(l.date_issued).toLocaleDateString()}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{l.purpose || t('loans.personalLoan')}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <UserCheck size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {l.member_name}
                            {Number(l.is_migrated) === 1 && (
                              <span className="badge-neutral" style={{ marginLeft: '6px', fontSize: '0.65rem', padding: '2px 6px', verticalAlign: 'middle' }} title={t('loans.migratedHint')}>
                                {t('loans.migrated')}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{l.member_nic}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(l.principal_amount)}</td>
                    <td className="text-right">
                      <div style={{ fontWeight: 800, color: 'var(--danger)' }}>
                        {formatCurrency(l.principal_owed + l.interest_owed + l.fines_owed)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        P: {formatCurrency(l.principal_owed)} | I: {formatCurrency(l.interest_owed)} | F: {formatCurrency(l.fines_owed)}
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px' }}>
                        <ShieldCheck size={14} color="var(--primary)" />
                        <span style={{ fontWeight: 700 }}>{l.guarantor_count}</span>
                      </div>
                    </td>
                    <td className="text-center">
                      <span className={`status-badge ${
                        l.status === 'Active' ? 'badge-primary' : 
                        l.status === 'Overdue' ? 'badge-danger' : 
                        l.status === 'Paid' ? 'badge-success' : 'badge-neutral'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button
                        className="btn-icon"
                        title={t('loans.viewDetails')}
                        style={{ color: 'var(--primary)' }}
                        onClick={() => setDetailLoanId(l.id)}
                      >
                        <Eye size={16} />
                      </button>
                      {(l.status === 'Active' || l.status === 'Overdue') && (
                        <button
                          className="btn-icon"
                          title={t('loans.recordRepayment')}
                          style={{ color: 'var(--success)' }}
                          onClick={() => setRepayLoan(l)}
                        >
                          <HandCoins size={16} />
                        </button>
                      )}
                      <button
                        className="btn-icon"
                        title={t('loans.deletePermanently')}
                        style={{ color: 'var(--danger)' }}
                        onClick={() => setDeletingLoan(l)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showIssueModal && (
        <IssueLoanModal
          onClose={() => setShowIssueModal(false)}
          onCreated={afterLoanChange}
          wallets={wallets}
          settings={settings}
        />
      )}

      {showMigrateModal && (
        <MigrateLoanModal
          onClose={() => setShowMigrateModal(false)}
          onCreated={afterLoanChange}
        />
      )}

      {repayLoan && (
        <RepayLoanModal
          loan={repayLoan}
          onClose={() => setRepayLoan(null)}
          onRepaid={afterLoanChange}
          wallets={wallets}
        />
      )}

      {detailLoanId !== null && (
        <LoanDetailModal
          loanId={detailLoanId}
          onClose={() => setDetailLoanId(null)}
          onChanged={afterLoanChange}
          wallets={wallets}
          societyName={settings.society_name || 'eSamithi'}
        />
      )}

      {deletingLoan && (
        <ConfirmModal
          title={t('loans.deleteTitle')}
          message={
            <>
              {t('loans.deleteMsg', { name: deletingLoan.member_name ?? '' })}
              {' '}
              {Number(deletingLoan.is_migrated) === 1 ? t('loans.deleteMsgMigrated') : t('loans.deleteMsgNormal')}
            </>
          }
          confirmLabel={t('loans.deleteTitle')}
          danger
          onConfirm={() => handleDelete(deletingLoan.id)}
          onClose={() => setDeletingLoan(null)}
        />
      )}
    </div>
  )
}
