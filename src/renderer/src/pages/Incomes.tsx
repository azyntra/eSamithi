import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Ban, Trash2, Printer, FileDown } from 'lucide-react'
import { useLedger, PAGE_SIZE_OPTIONS } from '../hooks/useLedger'
import { useWallets } from '../hooks/useWallets'
import { useSettings } from '../hooks/useSettings'
import { formatCurrency } from '../utils/formatters'
import { printReceipt, buildReceiptHtml } from '../utils/print'
import { invalidateCaches } from '../utils/cache'
import { showToast } from '../components/Toast'
import LedgerFilterBar from '../components/LedgerFilterBar'
import ConfirmModal from '../components/ConfirmModal'
import AddIncomeModal from '../modals/AddIncomeModal'
import VoidModal from '../modals/VoidModal'
import { useT } from '../i18n'
import type { IncomeTransaction } from '../types'

export default function Incomes(): React.ReactElement {
  const { t } = useT()
  const ledger = useLedger<IncomeTransaction>(window.api.income)
  const { transactions, total, activeTotal, loading, error, filters, setFilters, refresh, fetchAllForExport } = ledger
  const { wallets } = useWallets()
  const { settings, incomeTypes } = useSettings()
  const [showAddModal, setShowAddModal] = useState(false)
  const [addMemberId, setAddMemberId] = useState<number | undefined>(undefined)
  const [voidingId, setVoidingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [assets, setAssets] = useState<any[]>([])
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    window.api.assets.getAll().then(setAssets)
  }, [])

  // Counter flow: "Record Payment" on a member profile lands here with the
  // member pre-selected. Clear the state so refresh/back doesn't re-open it.
  useEffect(() => {
    const forMember = (location.state as { addForMember?: number } | null)?.addForMember
    if (forMember) {
      setAddMemberId(forMember)
      setShowAddModal(true)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recording or voiding income moves money in a wallet — drop the wallet and
  // dashboard caches so those pages show the new balance instead of a stale one.
  const afterBalanceChange = async (): Promise<void> => {
    invalidateCaches('wallets', 'dashboard')
    await refresh()
  }

  const handleDelete = async (id: number): Promise<void> => {
    try {
      await window.api.income.delete(id)
      await refresh()
      showToast('success', t('ledger.deleted'))
    } catch (err: any) {
      showToast('error', err.message || t('ledger.deleteFailed'))
    }
  }

  const confirmVoid = async (reason: string): Promise<void> => {
    if (!voidingId) return
    try {
      await window.api.income.void(voidingId, reason)
      await afterBalanceChange()
      showToast('success', t('ledger.voidedIncome'))
      setVoidingId(null)
    } catch (err: any) {
      showToast('error', err.message || t('ledger.voidFailed'))
    }
  }

  const handlePrintReceipt = (t: IncomeTransaction): void => {
    printReceipt(buildReceiptHtml({
      societyName: settings.society_name || 'eSamithi',
      title: 'Income Receipt',
      receiptNo: `INC-${String(t.id).padStart(5, '0')}`,
      date: new Date(t.date).toLocaleDateString('en-GB'),
      rows: [
        ['Received From', t.payer_name || '—'],
        ...(t.member_nic ? ([['NIC', t.member_nic]] as Array<[string, string]>) : []),
        ['Income Type', t.income_type_name || '—'],
        ['Payment Method', t.payment_method],
        ['Deposited To', t.wallet_name || '—']
      ],
      amountLabel: 'Amount Received',
      amountValue: formatCurrency(t.amount),
      footerNote: t.notes || undefined
    }))
  }

  const handleExportCsv = async (): Promise<void> => {
    try {
      const rows = await fetchAllForExport()
      const header = ['Date', 'Payer', 'NIC', 'Type', 'Payment Method', 'Wallet', 'Amount (Rs.)', 'Status', 'Notes']
      const csv = [
        header.join(','),
        ...rows.map(t => [
          new Date(t.date).toLocaleDateString('en-GB'),
          `"${(t.payer_name || '').replace(/"/g, '""')}"`,
          t.member_nic || '',
          `"${(t.income_type_name || '').replace(/"/g, '""')}"`,
          t.payment_method,
          `"${(t.wallet_name || '').replace(/"/g, '""')}"`,
          (t.amount / 100).toFixed(2),
          t.status,
          `"${(t.notes || '').replace(/"/g, '""')}"`
        ].join(','))
      ].join('\n')
      const result = await window.api.exporter.csv(`income-ledger-${new Date().toISOString().split('T')[0]}.csv`, csv)
      if (result.success) showToast('success', t('ledger.exported', { count: rows.length }))
    } catch (err: any) {
      showToast('error', err.message || t('ledger.exportFailed'))
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / filters.limit))
  const startIndex = total === 0 ? 0 : (filters.page - 1) * filters.limit + 1
  const endIndex = Math.min(filters.page * filters.limit, total)

  return (
    <div className="page-container animation-fade-in">
      <div className="page-header gradient-header">
        <div>
          <h1 className="page-title">{t('ledger.incomeTitle')}</h1>
          <p className="page-subtitle">{t('ledger.incomeSubtitle')}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary glassmorphic" onClick={handleExportCsv}>
            <FileDown size={18} />
            {t('ledger.exportCsv')}
          </button>
          <button className="btn btn-primary glassmorphic" onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            {t('dash.recordIncome')}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="settings-card">
        <div className="settings-list-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t('ledger.totalActiveIncome')}</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(activeTotal)}</div>
          </div>
        </div>

        <LedgerFilterBar
          filters={filters}
          setFilters={setFilters}
          searchPlaceholder={t('ledger.searchIncome')}
          typeOptions={incomeTypes.filter(it => it.is_active == 1)}
          typeLabel={t('ledger.types')}
        />

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('ledger.payer')}</th>
                <th>{t('reports.category')}</th>
                <th>{t('ledger.method')}</th>
                <th>{t('ledger.wallet')}</th>
                <th className="text-right">{t('common.amount')}</th>
                <th className="text-center">{t('common.status')}</th>
                <th className="text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}><div className="spinner-wrapper"><div className="spinner"></div></div></td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">{t('ledger.noTransactions')}</td></tr>
              ) : (
                transactions.map(tx => (
                  <tr key={tx.id} style={tx.status === 'Void' ? { opacity: 0.45, textDecoration: 'line-through' } : {}}>
                    <td>{new Date(tx.date).toLocaleDateString()}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{tx.payer_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{tx.payer_type === 'Member' ? tx.member_nic : t('ledger.guest')}</div>
                    </td>
                    <td>
                      {tx.income_type_name}
                      {tx.notes && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.notes}>{tx.notes}</div>}
                    </td>
                    <td>{tx.payment_method}</td>
                    <td>{tx.wallet_name}</td>
                    <td className="text-right" style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(tx.amount)}</td>
                    <td className="text-center">
                      <span className={`status-badge ${tx.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="actions-cell">
                      {tx.status === 'Active' && (
                        <>
                          <button
                            className="btn-icon"
                            title={t('ledger.printReceipt')}
                            style={{ color: 'var(--primary)' }}
                            onClick={() => handlePrintReceipt(tx)}
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            className="btn-icon"
                            title={t('ledger.voidTx')}
                            style={{ color: 'var(--danger)' }}
                            onClick={() => setVoidingId(tx.id)}
                          >
                            <Ban size={16} />
                          </button>
                        </>
                      )}
                      {tx.status === 'Void' && (
                        <button
                          className="btn-icon"
                          title={t('ledger.deleteTxPermanently')}
                          style={{ color: 'var(--danger)' }}
                          onClick={() => setDeletingId(tx.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {t('ledger.showing', { start: startIndex, end: endIndex, total })}
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="form-control"
              aria-label="Rows per page"
              value={filters.limit}
              onChange={(e) => setFilters({ limit: Number(e.target.value) })}
              style={{ width: 'auto', padding: '5px 8px', fontSize: '0.8rem' }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{t('ledger.perPage', { n })}</option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" disabled={filters.page <= 1} onClick={() => setFilters({ page: filters.page - 1 })}>
              {t('common.previous')}
            </button>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t('ledger.pageOf', { page: filters.page, total: totalPages })}</span>
            <button className="btn btn-secondary btn-sm" disabled={filters.page >= totalPages} onClick={() => setFilters({ page: filters.page + 1 })}>
              {t('common.next')}
            </button>
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddIncomeModal
          onClose={() => { setShowAddModal(false); setAddMemberId(undefined) }}
          onCreated={afterBalanceChange}
          initialMemberId={addMemberId}
          incomeTypes={incomeTypes}
          wallets={wallets}
          assets={assets}
        />
      )}

      {voidingId && (
        <VoidModal
          onClose={() => setVoidingId(null)}
          onConfirm={confirmVoid}
        />
      )}

      {deletingId !== null && (
        <ConfirmModal
          title={t('ledger.deleteTitle')}
          message={t('ledger.deleteMsg')}
          confirmLabel={t('ledger.deletePermanently')}
          danger
          onConfirm={() => handleDelete(deletingId)}
          onClose={() => setDeletingId(null)}
        />
      )}
    </div>
  )
}
