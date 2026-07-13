import React, { useMemo, useState } from 'react'
import { Users, Wallet, Landmark, HandCoins, ArrowUpRight, ArrowDownRight, ChevronRight, Activity, TrendingUp, RefreshCcw, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../hooks/useDashboard'
import { formatCurrency } from '../utils/formatters'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { showToast } from '../components/Toast'
import { useT } from '../i18n'

export default function Dashboard(): React.ReactElement {
  const navigate = useNavigate()
  const { t, lang, monthsShort } = useT()
  const { stats, loading, fetchData } = useDashboard()
  const [refreshing, setRefreshing] = useState(false)

  const chartData = useMemo(() => {
    if (!stats) return []
    return monthsShort.map((name, index) => {
      const monthStr = String(index + 1).padStart(2, '0')
      const inc = stats.chartData.income.find(i => i.month === monthStr)
      const exp = stats.chartData.expenses.find(e => e.month === monthStr)
      return {
        name,
        Income: inc ? inc.total / 100 : 0,
        Expenses: exp ? exp.total / 100 : 0
      }
    })
  }, [stats, monthsShort])

  const attentionItems = useMemo(() => {
    const a = stats?.attention
    if (!a) return []
    const items: Array<{ count: number; label: string; arrearsTab: 'overdue' | 'fds' | 'members' }> = []
    if (a.overdueLoans > 0) items.push({ count: a.overdueLoans, label: t('dash.overdueLoansItem'), arrearsTab: 'overdue' })
    if (a.fdsMaturingSoon > 0) items.push({ count: a.fdsMaturingSoon, label: t('dash.fdsMaturingItem'), arrearsTab: 'fds' })
    if (a.membersWithoutFee !== null && a.membersWithoutFee > 0) {
      items.push({ count: a.membersWithoutFee, label: t('dash.withoutFeeItem'), arrearsTab: 'members' })
    }
    return items
  }, [stats, t])

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await fetchData(true)
      showToast('success', t('dash.refreshed'))
    } catch (err) {
      showToast('error', t('dash.refreshFailed'))
    } finally {
      setRefreshing(false)
    }
  }

  const today = new Date().toLocaleDateString(lang === 'si' ? 'si-LK' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  if (loading && !stats) {
    return (
      <div className="page-container animation-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner-wrapper">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container animation-fade-in" style={{ paddingBottom: '40px' }}>
      {/* ── Executive Header ───────────────────────────────── */}
      <div className="page-header gradient-header" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="page-title">{t('dash.title')}</h1>
          <p className="page-subtitle">{today} • {stats ? t('dash.membersRegistered', { count: stats.totalMembers }) : t('common.loading')}</p>
        </div>
        <div className="header-actions">
          <button
            className={`btn-icon glassmorphic ${refreshing ? 'animation-spin' : ''}`}
            onClick={handleRefresh}
            title={t('dash.refresh')}
            style={{ color: 'white', background: 'rgba(255,255,255,0.2)' }}
          >
            <RefreshCcw size={18} />
          </button>
          <div className="badge-white-soft">
            <Activity size={14} style={{ marginRight: '6px' }} />
            {t('dash.societyOverview')}
          </div>
        </div>
      </div>

      {/* ── KPI Grid (Single Row) ──────────────────────────── */}
      <div className="kpi-grid" style={{ marginBottom: '28px' }}>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--primary)' }}>
          <div className="kpi-icon" style={{ color: 'var(--primary)', background: 'var(--primary-light)' }}><Users size={22} /></div>
          <div className="kpi-label">{t('dash.activeMembers')}</div>
          <div className="kpi-value">{loading ? '...' : (stats?.totalMembers || 0)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: '4px', fontWeight: 600 }}>● {t('dash.fullyRegistered')}</div>
        </div>

        <div className="kpi-card" style={{ borderLeftColor: 'var(--success)' }}>
          <div className="kpi-icon" style={{ color: 'var(--success)', background: 'var(--success-light)' }}><Wallet size={22} /></div>
          <div className="kpi-label">{t('dash.totalLiquid')}</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>{loading ? '...' : formatCurrency(stats?.totalLiquid || 0)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{t('dash.activeWallets')}</div>
        </div>

        <div className="kpi-card" style={{ borderLeftColor: 'var(--accent-purple)' }}>
          <div className="kpi-icon" style={{ color: 'var(--accent-purple)', background: 'var(--accent-purple-light)' }}><Landmark size={22} /></div>
          <div className="kpi-label">{t('dash.fixedDeposits')}</div>
          <div className="kpi-value">{loading ? '...' : formatCurrency(stats?.totalFDs || 0)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-purple)', marginTop: '4px', fontWeight: 600 }}>{t('dash.investedCapital')}</div>
        </div>

        <div className="kpi-card" style={{ borderLeftColor: 'var(--danger)' }}>
          <div className="kpi-icon" style={{ color: 'var(--danger)', background: 'var(--danger-light)' }}><HandCoins size={22} /></div>
          <div className="kpi-label">{t('dash.loansOutstanding')}</div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>{loading ? '...' : formatCurrency(stats?.totalLoansOwed || 0)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '4px', fontWeight: 600 }}>{t('dash.collectibles')}</div>
        </div>
      </div>

      {/* ── Attention Needed ──────────────────────────────── */}
      {attentionItems.length > 0 && (
        <div
          className="settings-card shadow-sm"
          style={{ marginBottom: '28px', padding: '16px 20px', borderLeft: '3px solid var(--danger)' }}
        >
          <h3 className="list-title" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
            <AlertTriangle size={18} color="var(--danger)" /> {t('dash.attentionNeeded')}
          </h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {attentionItems.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate('/reports', { state: { tab: 'arrears', arrearsTab: item.arrearsTab } })}
                title={t('dash.openArrears')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  background: 'var(--danger-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--danger)' }}>{item.count}</span>
                {item.label}
                <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Strategic Actions ─────────────────────────────── */}
      <div style={{ marginBottom: '32px' }}>
        <h3 className="list-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
          <TrendingUp size={18} color="var(--primary)" /> {t('dash.strategicActions')}
        </h3>
        <div className="action-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div className="action-tile compact" onClick={() => navigate('/incomes')}>
            <div className="tile-icon sm" style={{ background: 'var(--success-light)', color: 'var(--success)' }}><ArrowDownRight size={18} /></div>
            <div className="tile-content">
              <h4>{t('dash.recordIncome')}</h4>
              <p>{t('dash.memberPayments')}</p>
            </div>
            <ChevronRight size={14} className="tile-arrow" />
          </div>
          <div className="action-tile compact" onClick={() => navigate('/expenses')}>
            <div className="tile-icon sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}><ArrowUpRight size={18} /></div>
            <div className="tile-content">
              <h4>{t('dash.payExpense')}</h4>
              <p>{t('dash.societyPayouts')}</p>
            </div>
            <ChevronRight size={14} className="tile-arrow" />
          </div>
          <div className="action-tile compact" onClick={() => navigate('/loans')}>
            <div className="tile-icon sm" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}><HandCoins size={18} /></div>
            <div className="tile-content">
              <h4>{t('dash.issueLoan')}</h4>
              <p>{t('dash.newApplication')}</p>
            </div>
            <ChevronRight size={14} className="tile-arrow" />
          </div>
          <div className="action-tile compact" onClick={() => navigate('/members')}>
            <div className="tile-icon sm" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}><Users size={18} /></div>
            <div className="tile-content">
              <h4>{t('dash.registry')}</h4>
              <p>{t('dash.memberDatabase')}</p>
            </div>
            <ChevronRight size={14} className="tile-arrow" />
          </div>
        </div>
      </div>

      {/* ── Analytics & Activity ──────────────────────────── */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>

        <div className="settings-card shadow-sm" style={{ padding: '20px' }}>
          <div className="settings-list-header" style={{ marginBottom: '20px' }}>
            <h3 className="list-title">{t('dash.monthlyCashflow')}</h3>
            <div className="badge-primary-soft">{t('dash.fiscalYear', { year: new Date().getFullYear() })}</div>
          </div>
          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} tickFormatter={(val) => `Rs ${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`} />
                <Tooltip
                  cursor={{ fill: 'var(--chart-cursor)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="Income" name={t('dash.income')} fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={25} />
                <Bar dataKey="Expenses" name={t('dash.expenses')} fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="settings-card shadow-sm" style={{ padding: '20px' }}>
          <div className="settings-list-header" style={{ marginBottom: '16px' }}>
            <h3 className="list-title" style={{ fontSize: '1rem' }}>{t('dash.recentActivity')}</h3>
            <button className="btn-ghost btn-sm" onClick={() => navigate('/incomes')}>{t('common.viewAll')}</button>
          </div>
          <div className="activity-list">
            {!stats || stats.recentActivity.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 0', fontSize: '0.8rem' }}>{t('dash.noRecent')}</div>
            ) : (
              stats.recentActivity.map((item, idx) => (
                <div key={idx} className="activity-item" style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: idx === stats.recentActivity.length - 1 ? 'none' : '1px solid var(--border)'
                }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: item.type === 'Income' ? 'var(--success-light)' : 'var(--danger-light)',
                    color: item.type === 'Income' ? 'var(--success)' : 'var(--danger)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px'
                  }}>
                    {item.type === 'Income' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{new Date(item.date).toLocaleDateString()}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: item.type === 'Income' ? 'var(--success)' : 'var(--danger)' }}>
                    {item.type === 'Income' ? '+' : '-'}{formatCurrency(item.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
