import React, { useState } from 'react'
import { Plus, ArrowRightLeft, Landmark, Box, PiggyBank, CircleDollarSign, Trash2, Pencil, CalendarClock, LayoutGrid, ListFilter } from 'lucide-react'
import { useWallets } from '../hooks/useWallets'
import { useSettings } from '../hooks/useSettings'
import { formatCurrency } from '../utils/formatters'
import { invalidateCaches } from '../utils/cache'
import { showToast } from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import AddWalletModal from '../modals/AddWalletModal'
import TransferModal from '../modals/TransferModal'
import DepositModal from '../modals/DepositModal'
import AddFDModal from '../modals/AddFDModal'
import AddAssetModal from '../modals/AddAssetModal'
import { useT } from '../i18n'
import type { PhysicalAsset, FixedDeposit, Wallet } from '../types'

type TabType = 'liquid' | 'investments' | 'assets'

export default function WalletPage(): React.ReactElement {
  const { t } = useT()
  const { wallets, fixedDeposits, assets, loading, fetchData } = useWallets()
  const { settings } = useSettings()
  const [activeTab, setActiveTab] = useState<TabType>('liquid')

  // Opening balances / direct deposits are Migration Mode only (Requirement 2)
  const inMigrationMode = settings.migration_completed === 'false'
  
  // Modal States
  const [showAddWallet, setShowAddWallet] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showAddFD, setShowAddFD] = useState(false)
  const [showAddAsset, setShowAddAsset] = useState(false)
  const [depositData, setDepositData] = useState<{ id: number, name: string } | null>(null)
  const [editingAsset, setEditingAsset] = useState<PhysicalAsset | null>(null)
  const [deletingAsset, setDeletingAsset] = useState<PhysicalAsset | null>(null)
  const [deletingWallet, setDeletingWallet] = useState<Wallet | null>(null)
  const [withdrawingFD, setWithdrawingFD] = useState<FixedDeposit | null>(null)

  if (loading) return (
    <div className="page-container animation-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div className="spinner-wrapper">
        <div className="spinner"></div>
      </div>
    </div>
  )

  // Totals
  const totalLiquid = wallets.filter(w => Number(w.is_active) === 1).reduce((sum, w) => sum + w.balance, 0)
  const totalFD = fixedDeposits.filter(fd => fd.status === 'Active').reduce((sum, fd) => sum + (fd.principal || 0), 0)

  const isNearingMaturity = (dateStr: string): boolean => {
    const maturity = new Date(dateStr)
    const today = new Date()
    const diffTime = maturity.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays >= 0 && diffDays <= 30
  }

  const handleToggle = async (id: number, balance: number): Promise<void> => {
    if (balance > 0) {
      showToast('error', t('wallet.cannotDeactivateToast'))
      return
    }
    try {
      await window.api.wallets.toggleActive(id)
      invalidateCaches('dashboard')
      await fetchData(true)
      showToast('success', t('wallet.statusUpdated'))
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleDelete = async (id: number, name: string): Promise<void> => {
    try {
      await window.api.wallets.delete(id)
      await fetchData(true)
      showToast('success', t('wallet.deletedToast', { name }))
    } catch (err: any) {
      showToast('error', err.message || t('wallet.deleteFailed'))
    }
  }

  // Adding a wallet, transferring, depositing, or adding an FD (all routed here
  // by the modals) shifts the society's totals — refresh the dashboard too.
  const handleRefresh = async (): Promise<void> => {
    invalidateCaches('dashboard')
    await fetchData(true)
  }

  const handleWithdrawFD = async (id: number): Promise<void> => {
    try {
      await window.api.fixedDeposits.withdraw(id)
      invalidateCaches('dashboard')
      await fetchData(true)
      showToast('success', t('wallet.fdWithdrawn'))
    } catch (err: any) {
      showToast('error', err.message || t('wallet.fdWithdrawFailed'))
    }
  }

  const handleDeleteAsset = async (id: number, name: string): Promise<void> => {
    try {
      await window.api.assets.delete(id)
      await fetchData(true)
      showToast('success', t('wallet.assetDeleted', { name }))
    } catch (err: any) {
      showToast('error', err.message || t('wallet.assetDeleteFailed'))
    }
  }

  // FDs past their maturity date but not withdrawn are displayed as Matured
  const fdDisplayStatus = (fd: FixedDeposit): string => {
    if (fd.status === 'Active' && new Date(fd.maturity_date) < new Date()) return 'Matured'
    return fd.status
  }

  return (
    <div className="page-container animation-fade-in">
      <div className="page-header gradient-header">
        <div>
          <h1 className="page-title">{t('nav.wallet')}</h1>
          <p className="page-subtitle">{t('wallet.subtitle')}</p>
        </div>
        <div className="header-actions">
          {activeTab === 'liquid' && (
            <button className="btn btn-secondary glassmorphic" onClick={() => setShowTransfer(true)}>
              <ArrowRightLeft size={18} /> {t('wallet.transfer')}
            </button>
          )}

          <button
            className="btn btn-primary glassmorphic"
            onClick={() => {
              if (activeTab === 'liquid') setShowAddWallet(true)
              if (activeTab === 'investments') setShowAddFD(true)
              if (activeTab === 'assets') setShowAddAsset(true)
            }}
          >
            <Plus size={18} />
            {activeTab === 'liquid' ? t('wallet.newWallet') : activeTab === 'investments' ? t('wallet.newInvestment') : t('wallet.newAsset')}
          </button>
        </div>
      </div>

      {/* ── Summary Hub ────────────────────────────────────── */}
      <div className="kpi-grid" style={{ marginBottom: '32px' }}>
        <div className={`kpi-card ${activeTab === 'liquid' ? 'active-pulse' : ''}`} onClick={() => setActiveTab('liquid')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon" style={{ color: 'var(--success)' }}><PiggyBank size={28} /></div>
          <div className="kpi-label">{t('wallet.liquidCash')}</div>
          <div className="kpi-value">{formatCurrency(totalLiquid)}</div>
        </div>
        <div className={`kpi-card ${activeTab === 'investments' ? 'active-pulse' : ''}`} onClick={() => setActiveTab('investments')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon" style={{ color: 'var(--primary)' }}><Landmark size={28} /></div>
          <div className="kpi-label">{t('dash.investedCapital')}</div>
          <div className="kpi-value">{formatCurrency(totalFD)}</div>
        </div>
        <div className={`kpi-card ${activeTab === 'assets' ? 'active-pulse' : ''}`} onClick={() => setActiveTab('assets')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon" style={{ color: 'var(--warning)' }}><Box size={28} /></div>
          <div className="kpi-label">{t('wallet.physicalAssets')}</div>
          <div className="kpi-value">{t('wallet.items', { count: assets.length })}</div>
        </div>
      </div>

      {/* ── Tab Switcher ───────────────────────────────────── */}
      <div className="tab-container" style={{ marginBottom: '24px' }}>
        <div className="tab-switcher">
          <button className={`tab-btn ${activeTab === 'liquid' ? 'active' : ''}`} onClick={() => setActiveTab('liquid')}>
            <LayoutGrid size={18} /> {t('wallet.liquidWallets')}
          </button>
          <button className={`tab-btn ${activeTab === 'investments' ? 'active' : ''}`} onClick={() => setActiveTab('investments')}>
            <Landmark size={18} /> {t('dash.fixedDeposits')}
          </button>
          <button className={`tab-btn ${activeTab === 'assets' ? 'active' : ''}`} onClick={() => setActiveTab('assets')}>
            <Box size={18} /> {t('wallet.societyAssets')}
          </button>
        </div>
      </div>

      {/* ── Content Sections ───────────────────────────────── */}
      <div className="animation-slide-up">
        {activeTab === 'liquid' && (
          <div className="settings-card shadow-sm">
            <div className="settings-list-header">
              <div>
                <div className="list-title">{t('wallet.operationalWallets')}</div>
                <div className="list-desc">{t('wallet.operationalDesc')}</div>
              </div>
              <div className="badge-primary-soft">{t('wallet.totalWallets', { count: wallets.length })}</div>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('wallet.walletName')}</th>
                    <th>{t('wallet.type')}</th>
                    <th className="text-right">{t('wallet.balance')}</th>
                    <th className="text-center">{t('common.status')}</th>
                    <th className="text-center">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map(w => (
                    <tr key={w.id} style={Number(w.is_active) === 0 ? { opacity: 0.6 } : {}}>
                      <td><div style={{ fontWeight: 600, fontSize: '1rem' }}>{w.name}</div></td>
                      <td><span className={`status-badge ${w.wallet_type === 'Bank' ? 'badge-primary' : 'badge-success'}`}>{w.wallet_type}</span></td>
                      <td className="text-right" style={{ fontWeight: 700, color: w.balance > 0 ? 'var(--success)' : 'inherit' }}>{formatCurrency(w.balance)}</td>
                      <td className="text-center"><span className={`status-badge ${w.is_active ? 'badge-success' : 'badge-neutral'}`}>{w.is_active ? t('common.active') : t('common.inactive')}</span></td>
                      <td className="actions-cell">
                        {Number(w.is_active) === 1 && inMigrationMode && (
                          <button className="btn btn-secondary btn-sm" onClick={() => setDepositData({ id: w.id, name: w.name })} style={{ marginRight: '6px' }} title={t('wallet.depositHint')}>
                            <Plus size={14} /> {t('wallet.deposit')}
                          </button>
                        )}
                        <button className="btn btn-secondary btn-sm" style={{ marginRight: '6px' }} onClick={() => handleToggle(w.id, w.balance)}>
                          {w.is_active ? t('wallet.deactivate') : t('wallet.activate')}
                        </button>
                        <button
                          className="btn-icon"
                          style={{
                            color: (w.balance && w.balance > 0) ? 'var(--text-secondary)' : 'var(--danger)',
                            opacity: (w.balance && w.balance > 0) ? 0.5 : 1,
                            cursor: (w.balance && w.balance > 0) ? 'not-allowed' : 'pointer'
                          }}
                          title={(w.balance && w.balance > 0) ? t('wallet.cannotDeleteBalance') : t('wallet.deleteWallet')}
                          onClick={() => {
                            if (w.balance && w.balance > 0) {
                              showToast('error', t('wallet.cannotDeleteBalanceToast'))
                            } else {
                              setDeletingWallet(w)
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'investments' && (
          <div className="settings-card shadow-sm">
            <div className="settings-list-header">
              <div>
                <div className="list-title">{t('wallet.investmentPortfolio')}</div>
                <div className="list-desc">{t('wallet.investmentDesc')}</div>
              </div>
              <div className="badge-primary-soft">{t('wallet.activeFDs', { count: fixedDeposits.filter(f => f.status === 'Active').length })}</div>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('reports.fdNumber')}</th>
                    <th>{t('reports.bank')}</th>
                    <th className="text-right">{t('reports.principal')}</th>
                    <th>{t('wallet.rate')}</th>
                    <th>{t('reports.maturityDate')}</th>
                    <th className="text-center">{t('common.status')}</th>
                    <th className="text-center">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fixedDeposits.length === 0 ? (
                    <tr><td colSpan={7} className="empty-state">{t('wallet.noFDs')}</td></tr>
                  ) : (
                    fixedDeposits.map(fd => {
                      const nearing = isNearingMaturity(fd.maturity_date)
                      const displayStatus = fdDisplayStatus(fd)
                      return (
                        <tr key={fd.id} style={nearing ? { backgroundColor: 'rgba(255, 165, 0, 0.08)' } : {}}>
                          <td style={{ fontWeight: 600 }}>{fd.fd_number}</td>
                          <td>{fd.bank_name}</td>
                          <td className="text-right" style={{ fontWeight: 700 }}>{formatCurrency(fd.principal)}</td>
                          <td>{fd.interest_rate}%</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: nearing ? 'var(--warning)' : 'inherit', fontWeight: nearing ? 700 : 400 }}>
                              {nearing && <CalendarClock size={16} />}
                              {new Date(fd.maturity_date).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="text-center">
                            <span
                              className={`status-badge ${displayStatus === 'Active' ? 'badge-success' : displayStatus === 'Matured' ? 'badge-primary' : 'badge-neutral'}`}
                              style={displayStatus === 'Matured' ? { background: 'var(--warning-light)', color: 'var(--warning-text)' } : undefined}
                              title={displayStatus === 'Matured' ? t('wallet.maturedHint') : undefined}
                            >
                              {displayStatus}
                            </span>
                          </td>
                          <td className="text-center">
                            {fd.status !== 'Withdrawn' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                title={fd.linked_wallet_id ? t('wallet.withdrawLinkedHint') : t('wallet.withdrawNoLinkHint')}
                                onClick={() => setWithdrawingFD(fd)}
                              >
                                {t('wallet.withdraw')}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="settings-card shadow-sm">
            <div className="settings-list-header">
              <div>
                <div className="list-title">{t('wallet.inventoryAssets')}</div>
                <div className="list-desc">{t('wallet.inventoryDesc')}</div>
              </div>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('wallet.assetName')}</th>
                    <th className="text-center">{t('wallet.quantity')}</th>
                    <th>{t('wallet.descriptionCondition')}</th>
                    <th className="text-center">{t('common.status')}</th>
                    <th className="text-center">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.length === 0 ? (
                    <tr><td colSpan={5} className="empty-state">{t('wallet.noAssets')}</td></tr>
                  ) : (
                    assets.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600, fontSize: '1rem' }}>{a.name}</td>
                        <td className="text-center" style={{ fontWeight: 700 }}>{a.quantity}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{a.description || '-'}</td>
                        <td className="text-center"><span className="status-badge badge-success">Active</span></td>
                        <td className="actions-cell">
                          <button className="btn-icon" title={t('wallet.editAsset')} onClick={() => setEditingAsset(a)}>
                            <Pencil size={16} />
                          </button>
                          <button className="btn-icon" title={t('wallet.deleteAsset')} style={{ color: 'var(--danger)' }} onClick={() => setDeletingAsset(a)}>
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
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────── */}
      {showAddWallet && <AddWalletModal onClose={() => setShowAddWallet(false)} onCreated={handleRefresh} allowOpeningBalance={inMigrationMode} />}
      {showTransfer && <TransferModal wallets={wallets} onClose={() => setShowTransfer(false)} onTransferred={handleRefresh} />}
      {depositData && <DepositModal walletId={depositData.id} walletName={depositData.name} onClose={() => setDepositData(null)} onDeposited={handleRefresh} />}
      {showAddFD && <AddFDModal onClose={() => setShowAddFD(false)} onCreated={handleRefresh} wallets={wallets} inMigrationMode={inMigrationMode} />}
      {showAddAsset && <AddAssetModal onClose={() => setShowAddAsset(false)} onCreated={handleRefresh} />}
      {editingAsset && <AddAssetModal onClose={() => setEditingAsset(null)} onCreated={handleRefresh} asset={editingAsset} />}

      {deletingWallet && (
        <ConfirmModal
          title={t('wallet.deleteWalletTitle')}
          message={t('wallet.deleteWalletMsg', { name: deletingWallet.name })}
          confirmLabel={t('wallet.deleteWalletLabel')}
          danger
          onConfirm={() => handleDelete(deletingWallet.id, deletingWallet.name)}
          onClose={() => setDeletingWallet(null)}
        />
      )}

      {withdrawingFD && (
        <ConfirmModal
          title={t('wallet.withdrawFdTitle')}
          message={t(
            withdrawingFD.linked_wallet_id ? 'wallet.withdrawFdMsgLinked' : 'wallet.withdrawFdMsgUnlinked',
            { number: withdrawingFD.fd_number, amount: formatCurrency(withdrawingFD.principal) }
          )}
          confirmLabel={t('wallet.withdrawFdLabel')}
          onConfirm={() => handleWithdrawFD(withdrawingFD.id)}
          onClose={() => setWithdrawingFD(null)}
        />
      )}

      {deletingAsset && (
        <ConfirmModal
          title={t('wallet.deleteAssetTitle')}
          message={t('wallet.deleteAssetMsg', { name: deletingAsset.name })}
          confirmLabel={t('wallet.deleteAssetLabel')}
          danger
          onConfirm={() => handleDeleteAsset(deletingAsset.id, deletingAsset.name)}
          onClose={() => setDeletingAsset(null)}
        />
      )}
    </div>
  )
}
