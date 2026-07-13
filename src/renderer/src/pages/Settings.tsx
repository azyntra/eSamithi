import React, { useState, useEffect } from 'react'
import RupeeInput from '../components/RupeeInput'
import { Save, Download, AlertCircle, Plus, Trash2, UserPlus, Shield, ShieldCheck, RefreshCw, CheckCircle2, Info, ArrowDownToLine } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { showToast } from '../components/Toast'
import { formatCurrency } from '../utils/formatters'
import AddIncomeTypeModal from '../modals/AddIncomeTypeModal'
import AddExpenseTypeModal from '../modals/AddExpenseTypeModal'
import ConfirmModal from '../components/ConfirmModal'
import { useT } from '../i18n'

interface SettingsPageProps {
  user: { id: number; username: string; full_name: string; role: string }
}

interface SystemUser {
  id: number
  username: string
  full_name: string
  role: string
}

export default function SettingsPage({ user }: SettingsPageProps): React.ReactElement {
  const { t } = useT()
  const isAdmin = user.role === 'admin'
  const { settings, incomeTypes, expenseTypes, loading, fetchData, updateSettings, deleteIncomeType, deleteExpenseType } = useSettings()

  const [activeTab, setActiveTab] = useState<'general' | 'loans' | 'income' | 'expense' | 'system' | 'about'>('general')
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [showAddIncome, setShowAddIncome] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [confirmState, setConfirmState] = useState<{ title: string; message: React.ReactNode; label: string; action: () => void } | null>(null)

  // System Users
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([])
  const [showAddUser, setShowAddUser] = useState(false)
  const [userForm, setUserForm] = useState({ username: '', password: '', full_name: '', role: 'user' })
  const [userFormError, setUserFormError] = useState('')
  const [savingUser, setSavingUser] = useState(false)

  // Samithi connection (multi-samithi; change is admin-only)
  const [samithiState, setSamithiState] = useState<{ code: string | null; name: string | null } | null>(null)
  const [newSamithiCode, setNewSamithiCode] = useState('')
  const [changingSamithi, setChangingSamithi] = useState(false)

  // Updater state
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloadPercent, setDownloadPercent] = useState(0)
  const [updateError, setUpdateError] = useState('')

  useEffect(() => {
    if (settings) {
      setFormData(settings)
    }
  }, [settings])

  useEffect(() => {
    if (activeTab === 'system' && isAdmin) {
      fetchUsers()
    }
  }, [activeTab, isAdmin])

  useEffect(() => {
    window.api.setup
      ?.getState?.()
      .then((s) => setSamithiState({ code: s.code, name: s.name }))
      .catch(() => setSamithiState(null))
  }, [])

  const handleChangeSamithi = async (): Promise<void> => {
    if (!newSamithiCode.trim() || changingSamithi) return
    setChangingSamithi(true)
    try {
      const record = await window.api.setup.resolve(newSamithiCode)
      showToast('success', t('settings.samithiChanged', { name: record.name }))
      // New samithi = new server/tenant: current session and caches are stale
      setTimeout(() => window.location.reload(), 1200)
    } catch (err: any) {
      showToast('error', err?.message || t('settings.samithiChangeFailed'))
      setChangingSamithi(false)
    }
  }

  // Load app version and listen for update events
  useEffect(() => {
    window.api.updater.getVersion().then(setAppVersion).catch(() => setAppVersion('unknown'))

    const cleanup = window.api.updater.onUpdateEvent((event) => {
      switch (event.type) {
        case 'checking':
          setUpdateStatus('checking')
          setUpdateError('')
          break
        case 'available':
          setUpdateStatus('available')
          setUpdateVersion(event.version || '')
          break
        case 'not-available':
          setUpdateStatus('not-available')
          break
        case 'progress':
          setUpdateStatus('downloading')
          setDownloadPercent(event.percent || 0)
          break
        case 'downloaded':
          setUpdateStatus('downloaded')
          setUpdateVersion(event.version || '')
          setDownloadPercent(100)
          break
        case 'error':
          setUpdateStatus('error')
          setUpdateError(event.message || 'Update check failed')
          break
      }
    })

    return cleanup
  }, [])

  const fetchUsers = async (): Promise<void> => {
    try {
      const result = await window.api.users.getAll()
      setSystemUsers(result)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateSettings(formData)
      showToast('success', t('settings.saved'))
    } catch (err: any) {
      showToast('error', err.message || t('settings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // max_loan_limit is stored in cents but must be entered in rupees
  const maxLoanLimitRupees = formData.max_loan_limit === '' || formData.max_loan_limit === undefined
    ? ''
    : String(Number(formData.max_loan_limit) / 100)

  const handleMaxLoanLimitChange = (rupees: string): void => {
    setFormData({
      ...formData,
      max_loan_limit: rupees === '' ? '' : String(Math.round(parseFloat(rupees) * 100) || 0)
    })
  }

  const handleDeleteIncomeType = (id: number, name: string): void => {
    setConfirmState({
      title: t('settings.deleteIncomeTypeTitle'),
      message: t('settings.deleteIncomeTypeMsg', { name }),
      label: t('settings.deleteTypeLabel'),
      action: async () => {
        try {
          await deleteIncomeType(id)
          showToast('success', t('settings.incomeTypeDeleted'))
        } catch (err: any) {
          showToast('error', err.message || t('settings.deleteFailed'))
        }
      }
    })
  }

  const handleDeleteExpenseType = (id: number, name: string): void => {
    setConfirmState({
      title: t('settings.deleteExpenseTypeTitle'),
      message: t('settings.deleteExpenseTypeMsg', { name }),
      label: t('settings.deleteTypeLabel'),
      action: async () => {
        try {
          await deleteExpenseType(id)
          showToast('success', t('settings.expenseTypeDeleted'))
        } catch (err: any) {
          showToast('error', err.message || t('settings.deleteFailed'))
        }
      }
    })
  }

  const handleCreateUser = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setUserFormError('')

    if (!userForm.username.trim()) {
      setUserFormError(t('settings.usernameRequired'))
      return
    }
    if (!userForm.password || userForm.password.length < 4) {
      setUserFormError(t('settings.passwordMin'))
      return
    }
    if (!userForm.full_name.trim()) {
      setUserFormError(t('settings.fullNameRequired'))
      return
    }

    setSavingUser(true)
    try {
      await window.api.users.create({
        username: userForm.username.trim(),
        password: userForm.password,
        full_name: userForm.full_name.trim(),
        role: userForm.role
      })
      showToast('success', t('settings.userCreated', { name: userForm.username.trim() }))
      setUserForm({ username: '', password: '', full_name: '', role: 'user' })
      setShowAddUser(false)
      fetchUsers()
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.userCreateFailed')
      setUserFormError(message)
    } finally {
      setSavingUser(false)
    }
  }

  const handleDeleteUser = (targetUser: SystemUser): void => {
    if (targetUser.id === user.id) {
      showToast('error', t('settings.cannotDeleteSelf'))
      return
    }

    setConfirmState({
      title: t('settings.deleteUserTitle'),
      message: t('settings.deleteUserMsg', { name: targetUser.full_name, username: targetUser.username }),
      label: t('settings.deleteUserLabel'),
      action: async () => {
        try {
          await window.api.users.delete(targetUser.id)
          showToast('success', t('settings.userDeleted', { name: targetUser.full_name }))
          fetchUsers()
        } catch (error) {
          const message = error instanceof Error ? error.message : t('settings.userDeleteFailed')
          showToast('error', message)
        }
      }
    })
  }

  const exportData = async (): Promise<void> => {
    const data = {
      timestamp: new Date().toISOString(),
      settings: formData,
      version: '1.0.0'
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `esamithi_backup_${new Date().getTime()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('success', t('settings.backupExported'))
  }

  const handleCheckForUpdates = async (): Promise<void> => {
    setUpdateStatus('checking')
    setUpdateError('')
    try {
      const result = await window.api.updater.checkForUpdates()
      if (!result.success) {
        setUpdateStatus('error')
        setUpdateError(result.error || 'Failed to check for updates')
      }
    } catch (err: any) {
      setUpdateStatus('error')
      setUpdateError(err.message || 'Failed to check for updates')
    }
  }

  const handleDownloadUpdate = async (): Promise<void> => {
    try {
      setUpdateStatus('downloading')
      setDownloadPercent(0)
      await window.api.updater.downloadUpdate()
    } catch (err: any) {
      setUpdateStatus('error')
      setUpdateError(err.message || 'Failed to download update')
    }
  }

  const handleInstallUpdate = (): void => {
    window.api.updater.installUpdate()
  }

  if (loading) return (
    <div className="page-container animation-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div className="spinner-wrapper">
        <div className="spinner"></div>
      </div>
    </div>
  )

  return (
    <div className="page-container animation-fade-in">
      <div className="page-header gradient-header">
        <div>
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="page-subtitle">{t('settings.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary glassmorphic" onClick={exportData}>
            <Download size={18} /> {t('settings.exportBackup')}
          </button>
        </div>
      </div>

      {/* ── Tab Selector ─────────────────────────────────────── */}
      <div className="settings-tabs">
        <button className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>{t('settings.tabGeneral')}</button>
        <button className={`settings-tab ${activeTab === 'loans' ? 'active' : ''}`} onClick={() => setActiveTab('loans')}>{t('settings.tabLoans')}</button>
        <button className={`settings-tab ${activeTab === 'income' ? 'active' : ''}`} onClick={() => setActiveTab('income')}>{t('settings.tabIncome')}</button>
        <button className={`settings-tab ${activeTab === 'expense' ? 'active' : ''}`} onClick={() => setActiveTab('expense')}>{t('settings.tabExpense')}</button>
        <button className={`settings-tab ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>{t('settings.tabSystem')}</button>
        <button className={`settings-tab ${activeTab === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>{t('settings.tabAbout')}</button>
      </div>

      {/* ── Tab Content ──────────────────────────────────────── */}

      {activeTab === 'general' && (
        <div className="settings-card">
          <h2 className="card-title">{t('settings.generalTitle')}</h2>
          <p className="card-desc">{t('settings.generalDesc')}</p>
          <form onSubmit={handleSaveSettings}>
            <div className="settings-form-grid single">
              <div className="form-group">
                <label>{t('settings.societyName')}</label>
                <input type="text" className="form-control" name="society_name" value={formData.society_name || ''} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>{t('settings.lowWalletThreshold')}</label>
                <input type="number" className="form-control" name="low_wallet_threshold" value={formData.low_wallet_threshold || ''} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>{t('settings.dashboardRange')}</label>
                <select className="form-control" name="dashboard_date_range" value={formData.dashboard_date_range || 'current_month'} onChange={handleChange}>
                  <option value="current_month">{t('settings.currentMonth')}</option>
                  <option value="current_quarter">{t('settings.currentQuarter')}</option>
                  <option value="current_year">{t('settings.currentYear')}</option>
                </select>
              </div>
            </div>
            <div className="settings-form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}><Save size={18} /> {saving ? t('settings.saving') : t('settings.saveSettings')}</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'loans' && (
        <div className="settings-card">
          <h2 className="card-title">{t('settings.loanEngineTitle')}</h2>
          <p className="card-desc">{t('settings.loanEngineDesc')}</p>
          <form onSubmit={handleSaveSettings}>
            <div className="settings-form-grid">
              {/* Guarantor count is fixed at exactly 2 by requirement v2.0 — not configurable */}
              <div className="form-group">
                <label>{t('settings.gracePeriod')}</label>
                <input type="number" min="0" className="form-control" name="grace_period_days" value={formData.grace_period_days || ''} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>{t('settings.monthlyInterest')}</label>
                <input type="number" step="0.1" className="form-control" name="monthly_interest_rate" value={formData.monthly_interest_rate || ''} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>{t('settings.lateFine')}</label>
                <input type="number" step="0.1" className="form-control" name="late_fine_rate" value={formData.late_fine_rate || ''} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>{t('settings.maxLoanLimit')}</label>
                <RupeeInput value={maxLoanLimitRupees} onChange={handleMaxLoanLimitChange} required />
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{t('settings.currently', { value: formData.max_loan_limit ? formatCurrency(Number(formData.max_loan_limit)) : '—' })}</small>
              </div>
            </div>
            <div className="settings-form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}><Save size={18} /> {saving ? t('settings.saving') : t('settings.saveSettings')}</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'income' && (
        <div className="settings-card">
          <div className="settings-list-header">
            <div>
              <div className="list-title">{t('settings.tabIncome')}</div>
              <div className="list-desc">{t('settings.incomeTypesDesc')}</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddIncome(true)}><Plus size={16}/> {t('settings.addType')}</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('settings.categoryGroup')}</th>
                <th className="text-right">{t('settings.defaultAmount')}</th>
                <th className="text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {incomeTypes.length === 0 ? (
                <tr><td colSpan={4} className="empty-state">{t('settings.noIncomeTypes')}</td></tr>
              ) : (
                incomeTypes.map(it => (
                  <tr key={it.id} style={Number(it.is_active) === 0 ? { opacity: 0.5 } : {}}>
                    <td className="font-medium">{it.name} {Number(it.is_active) === 0 && <span className="status-badge badge-neutral">{t('common.inactive')}</span>}</td>
                    <td><span className="status-badge badge-primary">{it.category_group}</span></td>
                    <td className="text-right">{formatCurrency(it.standard_amount)}</td>
                    <td className="actions-cell">
                      {it.code ? (
                        <span className="status-badge badge-neutral" title={t('settings.systemHint')}>{t('settings.system')}</span>
                      ) : (
                        <button className="icon-btn text-danger" title={t('common.delete')} onClick={() => handleDeleteIncomeType(it.id, it.name)}><Trash2 size={16} /></button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'expense' && (
        <div className="settings-card">
          <div className="settings-list-header">
            <div>
              <div className="list-title">{t('settings.tabExpense')}</div>
              <div className="list-desc">{t('settings.expenseTypesDesc')}</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddExpense(true)}><Plus size={16}/> {t('settings.addType')}</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th className="text-right">{t('settings.standardPayout')}</th>
                <th className="text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {expenseTypes.length === 0 ? (
                <tr><td colSpan={3} className="empty-state">{t('settings.noExpenseTypes')}</td></tr>
              ) : (
                expenseTypes.map(et => (
                  <tr key={et.id} style={Number(et.is_active) === 0 ? { opacity: 0.5 } : {}}>
                    <td className="font-medium">{et.name} {Number(et.is_active) === 0 && <span className="status-badge badge-neutral">{t('common.inactive')}</span>}</td>
                    <td className="text-right">{formatCurrency(et.standard_payout)}</td>
                    <td className="actions-cell">
                      {et.code ? (
                        <span className="status-badge badge-neutral" title={t('settings.systemHint')}>{t('settings.system')}</span>
                      ) : (
                        <button className="icon-btn text-danger" title={t('common.delete')} onClick={() => handleDeleteExpenseType(et.id, et.name)}><Trash2 size={16} /></button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'system' && (
        <div className="settings-card">
          <div className="settings-list-header">
            <div>
              <div className="list-title">{t('settings.tabSystem')}</div>
              <div className="list-desc">{t('settings.systemUsersDesc')}</div>
            </div>
            {isAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddUser(!showAddUser)}>
                <UserPlus size={16}/> {showAddUser ? t('common.cancel') : t('settings.addUser')}
              </button>
            )}
          </div>

          {!isAdmin && (
            <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} /> {t('settings.onlyAdmins')}
            </div>
          )}

          {isAdmin && showAddUser && (
            <div className="add-user-form">
              <form onSubmit={handleCreateUser}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('settings.fullName')} <span className="text-danger">*</span></label>
                    <input type="text" className="form-control" placeholder="e.g. Kumara Perera" value={userForm.full_name} onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>{t('login.username')} <span className="text-danger">*</span></label>
                    <input type="text" className="form-control" placeholder="e.g. kumara" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>{t('login.password')} <span className="text-danger">*</span></label>
                    <input type="password" className="form-control" placeholder={t('settings.passwordPlaceholder')} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required minLength={4} />
                  </div>
                  <div className="form-group">
                    <label>{t('settings.role')} <span className="text-danger">*</span></label>
                    <select className="form-control" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                      <option value="user">{t('settings.roleUser')}</option>
                      <option value="admin">{t('settings.roleAdmin')}</option>
                    </select>
                  </div>
                </div>
                {userFormError && <div className="alert alert-danger" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', fontSize: '0.85rem' }}><AlertCircle size={14} /> {userFormError}</div>}
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowAddUser(false); setUserFormError('') }}>{t('common.cancel')}</button>
                  <button type="submit" className="btn btn-primary" disabled={savingUser}>{savingUser ? t('settings.creating') : t('settings.createUser')}</button>
                </div>
              </form>
            </div>
          )}

          {isAdmin && (
            <div>
              {systemUsers.map(su => (
                <div className="user-card" key={su.id}>
                  <div className="user-card-info">
                    <div className={`user-avatar ${su.role}`}>
                      {su.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="user-card-meta">
                      <h4>{su.full_name}</h4>
                      <span>@{su.username}</span>
                    </div>
                  </div>
                  <div className="user-card-actions">
                    <span className="status-badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {su.role === 'admin' ? <ShieldCheck size={13} /> : <Shield size={13} />}
                      {su.role}
                    </span>
                    {su.id !== user.id && (
                      <button className="icon-btn text-danger" title={t('settings.deleteUserTooltip')} onClick={() => handleDeleteUser(su)}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="settings-card">
          <h2 className="card-title">{t('settings.aboutTitle')}</h2>
          <p className="card-desc">{t('settings.aboutDesc')}</p>

          {/* Version Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'var(--bg-page)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', marginBottom: '24px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: '1.4rem', fontWeight: 800
            }}>
              eS
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>eSamithi</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>{t('login.platform')}</p>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-subtle)', padding: '2px 8px', borderRadius: '100px', marginTop: '4px', display: 'inline-block' }}>
                {t('settings.version', { v: appVersion || '...' })}
              </span>
            </div>
          </div>

          {/* Samithi connection (multi-samithi) */}
          {samithiState?.code && (
            <div style={{ padding: '20px', background: 'var(--bg-page)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', marginBottom: '24px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                {t('settings.samithiSection')}
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                {samithiState.name} · <span style={{ fontFamily: 'monospace' }}>{samithiState.code}</span>
              </p>
              {isAdmin && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="form-control"
                    style={{ maxWidth: '200px' }}
                    placeholder={t('settings.samithiCodePlaceholder')}
                    value={newSamithiCode}
                    onChange={(e) => setNewSamithiCode(e.target.value.toUpperCase())}
                  />
                  <button className="btn btn-secondary" onClick={handleChangeSamithi} disabled={changingSamithi || !newSamithiCode.trim()}>
                    {changingSamithi ? t('settings.samithiChanging') : t('settings.changeSamithi')}
                  </button>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{t('settings.changeSamithiWarn')}</span>
                </div>
              )}
            </div>
          )}

          {/* Update Section */}
          <div style={{ padding: '20px', background: 'var(--bg-page)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowDownToLine size={16} color="var(--primary)" /> {t('settings.softwareUpdates')}
            </h4>

            {/* Status Messages */}
            {updateStatus === 'idle' && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                {t('settings.clickCheck')}
              </p>
            )}

            {updateStatus === 'checking' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <RefreshCw size={16} className="spin-animation" style={{ animation: 'spin 1s linear infinite' }} />
                {t('settings.checking')}
              </div>
            )}

            {updateStatus === 'not-available' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', color: 'var(--success)', fontSize: '0.85rem', fontWeight: 600 }}>
                <CheckCircle2 size={16} />
                {t('settings.latestVersion')}
              </div>
            )}

            {updateStatus === 'available' && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px' }}>
                  <Info size={16} />
                  {t('settings.newVersion', { v: updateVersion })}
                </div>
                <button className="btn btn-primary" onClick={handleDownloadUpdate} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Download size={16} /> {t('settings.downloadUpdate')}
                </button>
              </div>
            )}

            {updateStatus === 'downloading' && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                  {t('settings.downloading', { p: downloadPercent })}
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '100px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${downloadPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--primary), var(--primary-hover))',
                    borderRadius: '100px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}

            {updateStatus === 'downloaded' && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--success)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px' }}>
                  <CheckCircle2 size={16} />
                  {t('settings.downloadedReady', { v: updateVersion })}
                </div>
                <button className="btn btn-primary" onClick={handleInstallUpdate} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw size={16} /> {t('settings.installRestart')}
                </button>
              </div>
            )}

            {updateStatus === 'error' && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
                  <AlertCircle size={16} />
                  {updateError}
                </div>
              </div>
            )}

            {(updateStatus === 'idle' || updateStatus === 'not-available' || updateStatus === 'error') && (
              <button className="btn btn-secondary" onClick={handleCheckForUpdates} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={16} /> {t('settings.checkForUpdates')}
              </button>
            )}
          </div>
        </div>
      )}

      {showAddIncome && <AddIncomeTypeModal onClose={() => { setShowAddIncome(false); }} onCreated={fetchData} />}
      {showAddExpense && <AddExpenseTypeModal onClose={() => { setShowAddExpense(false); }} onCreated={fetchData} />}

      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.label}
          danger
          onConfirm={confirmState.action}
          onClose={() => setConfirmState(null)}
        />
      )}
    </div>
  )
}
