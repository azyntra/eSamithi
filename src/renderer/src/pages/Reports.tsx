import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Printer, FileBarChart, AlertTriangle, Phone } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { formatCurrency } from '../utils/formatters'
import { showToast } from '../components/Toast'
import { useT } from '../i18n'

type Tab = 'monthly' | 'annual' | 'arrears'
type ArrearsTab = 'overdue' | 'fds' | 'members'

interface CategoryRow {
  name: string
  code: string | null
  entry_count: number
  total: number
}

interface Summary {
  income: CategoryRow[]
  expenses: CategoryRow[]
  totals: { income: number; expenses: number; net: number }
}

interface MonthlyReport extends Summary {
  year: number
  month: number
  from: string
  to: string
}

interface AnnualReport extends Summary {
  year: number
  position: {
    members: number
    walletBalance: number
    fdPrincipal: number
    fdCount: number
    loansOutstanding: number
    activeLoans: number
  }
}

interface ArrearsReport {
  overdueLoans: Array<{
    id: number
    principal_owed: number
    interest_owed: number
    fines_owed: number
    date_issued: string
    member_name: string
    society_id: string
    phone: string | null
  }>
  fdsMaturing: Array<{
    id: number
    fd_number: string
    bank_name: string
    principal: number
    maturity_date: string
  }>
  // null while in Migration Mode — historical fee payments were never entered
  membersWithoutFee: Array<{
    id: number
    society_id: string
    full_name: string
    phone: string | null
  }> | null
}

const now = new Date()
const YEARS = Array.from({ length: 10 }, (_, i) => now.getFullYear() - i)

function CategoryTable({ title, rows, total, accent }: { title: string; rows: CategoryRow[]; total: number; accent: string }): React.ReactElement {
  const { t } = useT()
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <h3 className="list-title" style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>{title}</h3>
      <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t('reports.category')}</th>
            <th className="text-right">{t('reports.entries')}</th>
            <th className="text-right">{t('common.total')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>{t('reports.noEntries')}</td></tr>
          ) : (
            rows.map((r) => (
              <tr key={`${r.code}-${r.name}`}>
                <td>{r.name}</td>
                <td className="text-right">{r.entry_count}</td>
                <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(r.total)}</td>
              </tr>
            ))
          )}
          <tr>
            <td style={{ fontWeight: 700 }}>{t('common.total')}</td>
            <td></td>
            <td className="text-right" style={{ fontWeight: 700, color: accent }}>{formatCurrency(total)}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  )
}

function SummaryTotals({ totals }: { totals: Summary['totals'] }): React.ReactElement {
  const { t } = useT()
  return (
    <div style={{ display: 'flex', gap: '16px', marginTop: '20px', flexWrap: 'wrap' }}>
      <div className="settings-card" style={{ flex: 1, padding: '16px', borderLeft: '3px solid var(--success)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.totalIncome')}</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(totals.income)}</div>
      </div>
      <div className="settings-card" style={{ flex: 1, padding: '16px', borderLeft: '3px solid var(--danger)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('reports.totalExpenses')}</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(totals.expenses)}</div>
      </div>
      <div className="settings-card" style={{ flex: 1, padding: '16px', borderLeft: '3px solid var(--primary)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{totals.net >= 0 ? t('reports.netSurplus') : t('reports.netDeficit')}</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: totals.net >= 0 ? 'var(--primary)' : 'var(--danger)' }}>{formatCurrency(Math.abs(totals.net))}</div>
      </div>
    </div>
  )
}

export default function Reports(): React.ReactElement {
  const { settings } = useSettings()
  const { t, monthsLong } = useT()
  const location = useLocation()
  // Dashboard's Attention card deep-links straight to the arrears tab, and each
  // attention item targets its specific arrears sub-tab.
  const navState = location.state as { tab?: Tab; arrearsTab?: ArrearsTab } | null
  const initialTab = navState?.tab ?? 'monthly'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [arrearsTab, setArrearsTab] = useState<ArrearsTab>(navState?.arrearsTab ?? 'overdue')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(false)
  const [monthly, setMonthly] = useState<MonthlyReport | null>(null)
  const [annual, setAnnual] = useState<AnnualReport | null>(null)
  const [arrears, setArrears] = useState<ArrearsReport | null>(null)

  const societyName = settings.society_name || 'eSamithi'

  // A running app instance older than the Reports feature can't serve it:
  // either the preload bridge is missing (window.api.reports undefined) or a
  // window reload picked up a new preload while the main process stayed old
  // ("No handler registered for 'reports:*'"). Both need a full app restart —
  // quitting entirely, not just reloading the window.
  const [staleMain, setStaleMain] = useState(false)
  const bridgeMissing = !window.api.reports || staleMain

  useEffect(() => {
    if (bridgeMissing) return
    let cancelled = false
    const load = async (): Promise<void> => {
      setLoading(true)
      try {
        if (tab === 'monthly') {
          const data = await window.api.reports.monthly(year, month)
          if (!cancelled) setMonthly(data)
        } else if (tab === 'annual') {
          const data = await window.api.reports.annual(year)
          if (!cancelled) setAnnual(data)
        } else {
          const data = await window.api.reports.arrears()
          if (!cancelled) setArrears(data)
        }
      } catch (err: any) {
        if (cancelled) return
        if (String(err?.message || '').includes('No handler registered')) {
          setStaleMain(true)
        } else {
          showToast('error', err.message || t('reports.loadFailed'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, year, month, bridgeMissing])

  const printTitle =
    tab === 'monthly'
      ? `${t('reports.monthly')} — ${monthsLong[month - 1]} ${year}`
      : tab === 'annual'
        ? `${t('reports.annual')} — ${year}`
        : t('reports.arrears')

  const overdueTotal = (l: ArrearsReport['overdueLoans'][number]): number =>
    l.principal_owed + l.interest_owed + l.fines_owed

  return (
    <div className="page-container animation-fade-in" style={{ paddingBottom: '40px' }}>
      <div className="page-header gradient-header">
        <div>
          <h1 className="page-title">{t('reports.title')}</h1>
          <p className="page-subtitle">{t('reports.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary glassmorphic" onClick={() => window.print()} title={t('reports.printHint')}>
            <Printer size={18} />
            {t('reports.print')}
          </button>
        </div>
      </div>

      {bridgeMissing && (
        <div className="settings-card" style={{ padding: '32px', textAlign: 'center', marginBottom: '20px' }}>
          <AlertTriangle size={32} color="var(--danger)" style={{ marginBottom: '12px' }} />
          <h3 className="list-title" style={{ marginBottom: '8px' }}>{t('reports.restartNeeded')}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            {t('reports.restartMsg')}
          </p>
        </div>
      )}

      {/* Shown only on paper — the app chrome is hidden by print CSS */}
      <div className="print-only" style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', margin: 0 }}>{societyName}</h1>
        <p style={{ fontSize: '14px', margin: '4px 0 0' }}>{printTitle}</p>
        <p style={{ fontSize: '11px', margin: '2px 0 0' }}>{t('reports.generatedOn', { date: now.toLocaleDateString('en-GB') })}</p>
      </div>

      {!bridgeMissing && (
        <div className="settings-tabs">
          <button className={`settings-tab ${tab === 'monthly' ? 'active' : ''}`} onClick={() => setTab('monthly')}>{t('reports.monthly')}</button>
          <button className={`settings-tab ${tab === 'annual' ? 'active' : ''}`} onClick={() => setTab('annual')}>{t('reports.annual')}</button>
          <button className={`settings-tab ${tab === 'arrears' ? 'active' : ''}`} onClick={() => setTab('arrears')}>{t('reports.arrears')}</button>
        </div>
      )}

      {!bridgeMissing && tab !== 'arrears' && (
        <div className="settings-card no-print" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <FileBarChart size={18} color="var(--primary)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('reports.period')}</span>
          {tab === 'monthly' && (
            <select className="form-control" style={{ width: '150px' }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {monthsLong.map((name, i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </select>
          )}
          <select className="form-control" style={{ width: '110px' }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="spinner-wrapper"><div className="spinner"></div></div>
        </div>
      ) : tab === 'monthly' && monthly ? (
        <div className="settings-card" style={{ padding: '20px' }}>
          <div className="settings-list-header" style={{ marginBottom: '16px' }}>
            <h3 className="list-title">{monthsLong[monthly.month - 1]} {monthly.year}</h3>
            <div className="badge-primary-soft">{monthly.from} → {monthly.to}</div>
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <CategoryTable title={t('reports.incomeByCategory')} rows={monthly.income} total={monthly.totals.income} accent="var(--success)" />
            <CategoryTable title={t('reports.expensesByCategory')} rows={monthly.expenses} total={monthly.totals.expenses} accent="var(--danger)" />
          </div>
          <SummaryTotals totals={monthly.totals} />
        </div>
      ) : tab === 'annual' && annual ? (
        <>
          <div className="settings-card" style={{ padding: '20px', marginBottom: '20px' }}>
            <div className="settings-list-header" style={{ marginBottom: '16px' }}>
              <h3 className="list-title">{t('reports.yearStatement', { year: annual.year })}</h3>
            </div>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <CategoryTable title={t('reports.incomeByCategory')} rows={annual.income} total={annual.totals.income} accent="var(--success)" />
              <CategoryTable title={t('reports.expensesByCategory')} rows={annual.expenses} total={annual.totals.expenses} accent="var(--danger)" />
            </div>
            <SummaryTotals totals={annual.totals} />
          </div>
          <div className="settings-card" style={{ padding: '20px' }}>
            <div className="settings-list-header" style={{ marginBottom: '16px' }}>
              <h3 className="list-title">{t('reports.societyPosition')}</h3>
            </div>
            <div className="table-container">
              <table className="data-table">
                <tbody>
                  <tr><td>{t('reports.activeMembers')}</td><td className="text-right" style={{ fontWeight: 600 }}>{annual.position.members}</td></tr>
                  <tr><td>{t('reports.cashInWallets')}</td><td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(annual.position.walletBalance)}</td></tr>
                  <tr><td>{t('reports.fixedDeposits', { count: annual.position.fdCount })}</td><td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(annual.position.fdPrincipal)}</td></tr>
                  <tr><td>{t('reports.loansOutstanding', { count: annual.position.activeLoans })}</td><td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(annual.position.loansOutstanding)}</td></tr>
                  <tr>
                    <td style={{ fontWeight: 700 }}>{t('reports.totalFunds')}</td>
                    <td className="text-right" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {formatCurrency(annual.position.walletBalance + annual.position.fdPrincipal + annual.position.loansOutstanding)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : tab === 'arrears' && arrears ? (
        <>
          {/* Sub-tabs: show one arrears list at a time instead of stacking all three */}
          <div className="tab-switcher no-print" style={{ display: 'flex', marginBottom: '20px' }}>
            <button className={`tab-btn ${arrearsTab === 'overdue' ? 'active' : ''}`} onClick={() => setArrearsTab('overdue')}>
              {t('reports.tabOverdue')} ({arrears.overdueLoans.length})
            </button>
            <button className={`tab-btn ${arrearsTab === 'fds' ? 'active' : ''}`} onClick={() => setArrearsTab('fds')}>
              {t('reports.tabFds')} ({arrears.fdsMaturing.length})
            </button>
            <button className={`tab-btn ${arrearsTab === 'members' ? 'active' : ''}`} onClick={() => setArrearsTab('members')}>
              {t('reports.tabUnpaidFees')}{arrears.membersWithoutFee ? ` (${arrears.membersWithoutFee.length})` : ''}
            </button>
          </div>

          {arrearsTab === 'overdue' && (
          <div className="settings-card" style={{ padding: '20px', marginBottom: '20px' }}>
            <div className="settings-list-header" style={{ marginBottom: '16px' }}>
              <h3 className="list-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} color="var(--danger)" /> {t('reports.overdueLoans', { count: arrears.overdueLoans.length })}
              </h3>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('reports.member')}</th>
                    <th>{t('common.phone')}</th>
                    <th>{t('reports.issued')}</th>
                    <th className="text-right">{t('reports.principal')}</th>
                    <th className="text-right">{t('reports.interest')}</th>
                    <th className="text-right">{t('reports.fines')}</th>
                    <th className="text-right">{t('reports.totalOwed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {arrears.overdueLoans.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>{t('reports.noOverdue')}</td></tr>
                  ) : (
                    arrears.overdueLoans.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{l.member_name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{l.society_id}</div>
                        </td>
                        <td>
                          {l.phone ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Phone size={12} />{l.phone}</span>
                          ) : '—'}
                        </td>
                        <td>{new Date(l.date_issued).toLocaleDateString('en-GB')}</td>
                        <td className="text-right">{formatCurrency(l.principal_owed)}</td>
                        <td className="text-right">{formatCurrency(l.interest_owed)}</td>
                        <td className="text-right" style={{ color: 'var(--danger)' }}>{formatCurrency(l.fines_owed)}</td>
                        <td className="text-right" style={{ fontWeight: 700 }}>{formatCurrency(overdueTotal(l))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {arrearsTab === 'fds' && (
          <div className="settings-card" style={{ padding: '20px', marginBottom: '20px' }}>
            <div className="settings-list-header" style={{ marginBottom: '16px' }}>
              <h3 className="list-title">{t('reports.fdsMaturing', { count: arrears.fdsMaturing.length })}</h3>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('reports.fdNumber')}</th>
                    <th>{t('reports.bank')}</th>
                    <th className="text-right">{t('reports.principal')}</th>
                    <th className="text-right">{t('reports.maturityDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {arrears.fdsMaturing.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>{t('reports.nothingMaturing')}</td></tr>
                  ) : (
                    arrears.fdsMaturing.map((f) => {
                      const matured = new Date(f.maturity_date) <= now
                      return (
                        <tr key={f.id}>
                          <td style={{ fontWeight: 600 }}>{f.fd_number}</td>
                          <td>{f.bank_name}</td>
                          <td className="text-right">{formatCurrency(f.principal)}</td>
                          <td className="text-right" style={{ color: matured ? 'var(--danger)' : undefined, fontWeight: matured ? 700 : 400 }}>
                            {new Date(f.maturity_date).toLocaleDateString('en-GB')}{matured ? t('reports.matured') : ''}
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

          {arrearsTab === 'members' && (
          <div className="settings-card" style={{ padding: '20px' }}>
            <div className="settings-list-header" style={{ marginBottom: '16px' }}>
              <h3 className="list-title">
                {t('reports.membersWithoutFee')}{arrears.membersWithoutFee ? ` (${arrears.membersWithoutFee.length})` : ''}
              </h3>
            </div>
            {arrears.membersWithoutFee === null ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                {t('reports.liveModeNote')}
              </p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('reports.societyId')}</th>
                      <th>{t('common.name')}</th>
                      <th>{t('common.phone')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arrears.membersWithoutFee.length === 0 ? (
                      <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>{t('reports.everyonePaid')}</td></tr>
                    ) : (
                      arrears.membersWithoutFee.map((m) => (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600 }}>{m.society_id}</td>
                          <td>{m.full_name}</td>
                          <td>{m.phone || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </>
      ) : null}
    </div>
  )
}
