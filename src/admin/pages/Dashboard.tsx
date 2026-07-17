import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Users, Smartphone, UserCog, Wallet, Landmark, PiggyBank, Inbox,
  RefreshCw, LogIn, WifiOff, AlarmClock, AlertTriangle, Lock, BellRing, Activity
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { api, delta, pct, rs, rsShort, timeAgo } from '../api'
import type { Delta } from '../api'
import { useAuth } from '../auth'
import { Button, ChartCard, SearchBox, Segmented, Skeleton, StatusBadge, Tile, useSort, useToast } from '../components/ui'
import { enterSamithi } from '../lib/enter'

interface GlanceRow {
  slug: string; name_en: string; join_code: string; status: string
  members_total: number | null; members_enrolled: number | null
  wallets_total_cents: number | null; loans_outstanding_cents: number | null
  loans_overdue: number | null; pending_requests: number | null
  last_txn_at: string | null; reachable: number | null; stale: number
}
interface Dash {
  samithis: { total: number; active: number; suspended: number }
  totals: {
    members: number; enrolled: number; staff: number; wallets_cents: number
    loans_active: number; loans_outstanding_cents: number; fds_count: number
    fds_value_cents: number; pending_requests: number; loans_overdue: number
    push_tokens: number; locked_pins: number
    month_income_cents: number; month_expense_cents: number
  }
  attention: { unreachable: number; stale: number; loans_overdue: number; locked_pins: number }
  baseline: Record<string, number> | null
  as_of: string | null
  at_a_glance: GlanceRow[]
}
interface TrendPoint {
  date: string; members_total: number; members_enrolled: number; push_tokens: number
  wallets_total_cents: number; loans_outstanding_cents: number; fds_value_cents: number
}

type Metric = 'members_total' | 'wallets_total_cents' | 'loans_outstanding_cents'
const METRICS: { value: Metric; label: string; money: boolean; goodWhenUp: boolean }[] = [
  { value: 'members_total', label: 'Members', money: false, goodWhenUp: true },
  { value: 'wallets_total_cents', label: 'Wallet balances', money: true, goodWhenUp: true },
  { value: 'loans_outstanding_cents', label: 'Loans outstanding', money: true, goodWhenUp: false }
]

function AttnChip({ tone, icon, text, onClick }: {
  tone: 'warn' | 'danger' | 'neutral'; icon: React.ReactNode; text: string; onClick: () => void
}): React.ReactElement {
  return (
    <button className={`attn-chip ${tone}`} onClick={onClick}>{icon}{text}</button>
  )
}

export default function Dashboard(): React.ReactElement {
  const { admin } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [data, setData] = useState<Dash | null>(null)
  const [trend, setTrend] = useState<TrendPoint[] | null>(null)
  const [metric, setMetric] = useState<Metric>('members_total')
  const [range, setRange] = useState<'30' | '90'>('30')
  const [refreshing, setRefreshing] = useState(false)
  const [entering, setEntering] = useState('')
  const [q, setQ] = useState('')

  const load = useCallback(async () => setData(await api<Dash>('/dashboard')), [])
  const loadTrend = useCallback(async (days: string) => {
    setTrend((await api<{ series: TrendPoint[] }>(`/dashboard/trends?days=${days}`)).series)
  }, [])

  useEffect(() => { load().catch((e) => toast('error', (e as Error).message)) }, [load, toast])
  useEffect(() => { loadTrend(range).catch((e) => toast('error', (e as Error).message)) }, [range, loadTrend, toast])

  const refresh = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await api('/dashboard/refresh', { method: 'POST' })
      await Promise.all([load(), loadTrend(range)])
      toast('success', 'Fleet stats refreshed')
    } catch (e) { toast('error', (e as Error).message) }
    finally { setRefreshing(false) }
  }

  const enter = async (slug: string, name: string): Promise<void> => {
    setEntering(slug)
    try { await enterSamithi(slug, name, admin!.email) }
    catch (e) { toast('error', (e as Error).message); setEntering('') }
  }

  // Deltas need a prior day in the history table; on a fresh install there is
  // none and every badge stays hidden until the collector has run a second day.
  const d = useCallback((cur: number, key: string): Delta | null =>
    (data?.baseline ? delta(cur, data.baseline[key]) : null), [data])
  const spark = useCallback((key: keyof TrendPoint): number[] =>
    (trend ? trend.map((p) => Number(p[key])) : []), [trend])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = data?.at_a_glance ?? []
    return needle
      ? list.filter((r) => r.name_en.toLowerCase().includes(needle) || r.slug.toLowerCase().includes(needle))
      : list
  }, [data, q])
  const { sorted, th } = useSort<GlanceRow>(rows, { key: 'members_total', dir: 'desc' })

  const t = data?.totals
  const active = METRICS.find((m) => m.value === metric)!
  const fmtMetric = (v: number): string => (active.money ? rsShort(v) : String(v))
  const enoughHistory = (trend?.length ?? 0) > 1

  return (
    <>
      <div className="row no-print" style={{ marginBottom: 16 }}>
        <div className="t-mut">{data?.as_of ? `Fleet updated ${timeAgo(data.as_of)}` : 'Loading…'}</div>
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="ghost" size="sm" onClick={refresh} loading={refreshing}>
            {!refreshing && <RefreshCw size={14} />} Refresh now
          </Button>
        </div>
      </div>

      {data && (data.attention.unreachable > 0 || data.attention.stale > 0 || data.attention.loans_overdue > 0 || data.attention.locked_pins > 0) && (
        <div className="attn">
          {data.attention.unreachable > 0 && (
            <AttnChip tone="danger" icon={<WifiOff size={14} />} onClick={() => nav('/samithis')}
              text={`${data.attention.unreachable} samithi${data.attention.unreachable > 1 ? 's' : ''} unreachable`} />
          )}
          {data.attention.stale > 0 && (
            <AttnChip tone="warn" icon={<AlarmClock size={14} />} onClick={() => nav('/reports')}
              text={`${data.attention.stale} quiet for 30+ days`} />
          )}
          {data.attention.loans_overdue > 0 && (
            <AttnChip tone="warn" icon={<AlertTriangle size={14} />} onClick={() => nav('/reports')}
              text={`${data.attention.loans_overdue} overdue loan${data.attention.loans_overdue > 1 ? 's' : ''}`} />
          )}
          {data.attention.locked_pins > 0 && (
            <AttnChip tone="neutral" icon={<Lock size={14} />} onClick={() => nav('/samithis')}
              text={`${data.attention.locked_pins} member${data.attention.locked_pins > 1 ? 's' : ''} locked out`} />
          )}
        </div>
      )}

      {!data ? (
        <div className="tiles" style={{ marginBottom: 22 }}>
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="tile"><Skeleton h={64} /></div>)}
        </div>
      ) : (
        <>
          <div className="group">
            <div className="group-label">Fleet</div>
            <div className="tiles">
              <Tile icon={<Building2 size={18} />} tint="#1E64D4" label="Samithis"
                value={`${data.samithis.active}/${data.samithis.total}`}
                sub={data.samithis.suspended ? `${data.samithis.suspended} suspended` : 'all active'} />
              <Tile icon={<Users size={18} />} tint="#16A34A" label="Members"
                value={t!.members.toLocaleString()} sub={`${t!.enrolled} app-enrolled`}
                delta={d(t!.members, 'members_total')} spark={{ data: spark('members_total') }} />
              <Tile icon={<UserCog size={18} />} tint="#0EA5E9" label="Staff users" value={String(t!.staff)} />
            </div>
          </div>

          <div className="group">
            <div className="group-label">Financials</div>
            <div className="tiles">
              <Tile icon={<Wallet size={18} />} tint="#16A34A" label="Wallet balances"
                value={rs(t!.wallets_cents)} sub="fleet total"
                delta={d(t!.wallets_cents, 'wallets_total_cents')}
                spark={{ data: spark('wallets_total_cents') }} />
              <Tile icon={<Landmark size={18} />} tint="#D97706" label="Active loans"
                value={String(t!.loans_active)} sub={`${rs(t!.loans_outstanding_cents)} owed`}
                delta={d(t!.loans_outstanding_cents, 'loans_outstanding_cents')}
                spark={{ data: spark('loans_outstanding_cents'), goodWhenUp: false }} />
              <Tile icon={<PiggyBank size={18} />} tint="#8B5CF6" label="Fixed deposits"
                value={String(t!.fds_count)} sub={rs(t!.fds_value_cents)}
                delta={d(t!.fds_value_cents, 'fds_value_cents')} />
              <Tile icon={<Activity size={18} />} tint="#0EA5E9" label="This month"
                value={rs(t!.month_income_cents)} sub={`in · ${rs(t!.month_expense_cents)} out`} />
              <Tile icon={<Inbox size={18} />} tint="#DC2626" label="Pending requests" value={String(t!.pending_requests)} />
            </div>
          </div>

          <div className="group">
            <div className="group-label">App adoption</div>
            <div className="tiles">
              <Tile icon={<Smartphone size={18} />} tint="#8B5CF6" label="App enrolled"
                value={t!.enrolled.toLocaleString()} sub={`${pct(t!.enrolled, t!.members)}% of members`}
                delta={d(t!.enrolled, 'members_enrolled')} spark={{ data: spark('members_enrolled') }} />
              <Tile icon={<BellRing size={18} />} tint="#1E64D4" label="Push reach"
                value={t!.push_tokens.toLocaleString()} sub={`${pct(t!.push_tokens, t!.members)}% of members`}
                delta={d(t!.push_tokens, 'push_tokens')} spark={{ data: spark('push_tokens') }} />
              <Tile icon={<Lock size={18} />} tint="#D97706" label="PIN lockouts" value={String(t!.locked_pins)} />
            </div>
          </div>
        </>
      )}

      <div style={{ marginBottom: 18 }}>
        <ChartCard
          title="Fleet trend"
          height={280}
          empty={enoughHistory ? null : {
            title: 'Collecting data',
            hint: 'Trends appear once the collector has logged a couple of days of history.'
          }}
          actions={
            <div className="row no-print" style={{ gap: 8 }}>
              <Segmented value={metric} onChange={setMetric} options={METRICS.map((m) => ({ value: m.value, label: m.label }))} />
              <Segmented value={range} onChange={setRange} options={[{ value: '30', label: '30d' }, { value: '90', label: '90d' }]} />
            </div>
          }
        >
          <AreaChart data={trend ?? []} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
              tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }}
              tickFormatter={(v: string) => String(v).slice(5)} minTickGap={24} />
            {/* Auto domain, not zero-based: fleet numbers move by a few percent
                and a 0-anchored axis flattens the trend into a straight line. */}
            <YAxis tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} tickLine={false} axisLine={false}
              domain={['auto', 'auto']} width={active.money ? 70 : 44} tickFormatter={fmtMetric} />
            <Tooltip
              cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 40 }}
              contentStyle={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, fontSize: 12, color: 'var(--text-primary)'
              }}
              formatter={(v) => [active.money ? rs(Number(v)) : Number(v).toLocaleString(), active.label]}
            />
            <Area type="monotone" dataKey={metric} stroke="var(--chart-1)" strokeWidth={2}
              fill="url(#trendFill)" isAnimationActive={false} dot={false} />
          </AreaChart>
        </ChartCard>
      </div>

      <div className="card">
        <div className="card-head">
          <h3 style={{ flex: 1 }}>Samithis at a glance</h3>
          <SearchBox value={q} onChange={setQ} placeholder="Search samithis…" />
          <span className="sub">{data ? `${sorted.length} of ${data.at_a_glance.length}` : ''}</span>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {th('name_en', 'Samithi')}
                {th('members_total', 'Members')}
                {th('loans_outstanding_cents', 'Outstanding loans', { textAlign: 'right' })}
                {th('last_txn_at', 'Last activity')}
                {th('status', 'Status')}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                Array.from({ length: 2 }).map((_, i) => <tr key={i}><td colSpan={6}><Skeleton h={22} /></td></tr>)
              ) : sorted.length === 0 ? (
                <tr><td colSpan={6} className="t-mut" style={{ textAlign: 'center', padding: 26 }}>No samithi matches “{q}”.</td></tr>
              ) : sorted.map((s) => (
                <tr key={s.slug} style={{ cursor: 'pointer' }} onClick={() => nav(`/samithis/${s.slug}`)}>
                  <td>
                    <div className="t-strong row" style={{ gap: 6 }}>
                      <span className="dot" title={s.reachable === 0 ? 'Unreachable' : 'Reachable'}
                        style={{ background: s.reachable === 0 ? 'var(--danger)' : 'var(--success)', flexShrink: 0 }} />
                      {s.name_en}
                    </div>
                    <div className="t-mut">{s.slug} · <span className="mono">{s.join_code}</span></div>
                  </td>
                  <td>
                    {s.members_total ?? '—'}
                    {s.members_enrolled != null && s.members_total ? (
                      <span className="t-mut"> · {pct(s.members_enrolled, s.members_total)}% on app</span>
                    ) : null}
                  </td>
                  <td style={{ textAlign: 'right' }} className="mono">
                    {s.loans_outstanding_cents != null ? rs(s.loans_outstanding_cents) : '—'}
                    {s.loans_overdue ? <span className="badge warn" style={{ marginLeft: 6 }}>{s.loans_overdue} overdue</span> : null}
                  </td>
                  <td style={s.stale ? { color: 'var(--warning)' } : undefined}>
                    {s.last_txn_at ? String(s.last_txn_at).slice(0, 10) : '—'}
                  </td>
                  <td><StatusBadge status={s.status} /></td>
                  <td className="no-print" onClick={(e) => e.stopPropagation()}>
                    {s.status === 'active' && (
                      <Button size="sm" variant="ghost" loading={entering === s.slug} onClick={() => enter(s.slug, s.name_en)}>
                        {entering !== s.slug && <LogIn size={13} />} Enter
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
