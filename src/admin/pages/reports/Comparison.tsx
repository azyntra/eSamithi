import React, { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from 'recharts'
import { api, downloadCsv, rs, rsShort } from '../../api'
import { ChartCard, Segmented, Skeleton, useSort, useToast } from '../../components/ui'

export interface CompRow {
  slug: string; name_en: string; status: string; reachable: number | null; captured_at: string | null
  members_total: number; members_active: number; members_enrolled: number; staff_users: number
  wallets_total_cents: number; loans_active: number; loans_outstanding_cents: number
  fds_count: number; fds_value_cents: number; pending_requests: number; last_txn_at: string | null
}
type Totals = Omit<CompRow, 'slug' | 'name_en' | 'status' | 'reachable' | 'captured_at' | 'last_txn_at'>
export interface Comparison { rows: CompRow[]; totals: Totals; as_of: string | null }

type RankBy = 'wallets_total_cents' | 'members_total' | 'loans_outstanding_cents'
const RANKS: { value: RankBy; label: string; money: boolean }[] = [
  { value: 'wallets_total_cents', label: 'Wallets', money: true },
  { value: 'members_total', label: 'Members', money: false },
  { value: 'loans_outstanding_cents', label: 'Outstanding', money: true }
]

export function csvOf(rows: CompRow[]): { headers: string[]; body: (string | number)[][] } {
  const money = (c: number): string => (c / 100).toFixed(2)
  return {
    headers: ['Samithi', 'Slug', 'Status', 'Members', 'Active', 'App enrolled', 'Staff', 'Wallets (Rs)',
      'Active loans', 'Outstanding (Rs)', 'FDs', 'FD value (Rs)', 'Pending', 'Last txn'],
    body: rows.map((r) => [r.name_en, r.slug, r.status, r.members_total, r.members_active, r.members_enrolled,
      r.staff_users, money(r.wallets_total_cents), r.loans_active, money(r.loans_outstanding_cents),
      r.fds_count, money(r.fds_value_cents), r.pending_requests, r.last_txn_at ? String(r.last_txn_at).slice(0, 10) : ''])
  }
}

export default function Comparison({ onData }: { onData: (c: Comparison | null) => void }): React.ReactElement {
  const toast = useToast()
  const [comp, setComp] = useState<Comparison | null>(null)
  const [rankBy, setRankBy] = useState<RankBy>('wallets_total_cents')

  useEffect(() => {
    api<Comparison>('/reports/comparison')
      .then((c) => { setComp(c); onData(c) })
      .catch((e) => toast('error', (e as Error).message))
  }, [onData, toast])

  const { sorted, th } = useSort<CompRow>(comp?.rows ?? [], { key: 'wallets_total_cents', dir: 'desc' })
  const rank = RANKS.find((r) => r.value === rankBy)!
  const chartData = [...(comp?.rows ?? [])]
    .sort((a, b) => Number(b[rankBy]) - Number(a[rankBy]))
    .slice(0, 10)
    .map((r) => ({ name: r.name_en, value: Number(r[rankBy]) }))

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <ChartCard
          title="Ranked by"
          height={Math.max(200, chartData.length * 34 + 40)}
          empty={chartData.length === 0 ? { title: 'No samithi data yet' } : null}
          actions={<Segmented value={rankBy} onChange={setRankBy} options={RANKS.map((r) => ({ value: r.value, label: r.label }))} />}
        >
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
            <XAxis type="number" tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} tickLine={false}
              axisLine={{ stroke: 'var(--chart-grid)' }} tickFormatter={(v: number) => (rank.money ? rsShort(v) : String(v))} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
              tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--chart-cursor)' }}
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)' }}
              formatter={(v) => [rank.money ? rs(Number(v)) : Number(v).toLocaleString(), rank.label]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false} barSize={18}>
              {chartData.map((_, i) => <Cell key={i} fill={`var(--chart-${(i % 5) + 1})`} />)}
            </Bar>
          </BarChart>
        </ChartCard>
      </div>

      <div className="card">
        <div className="card-head">
          <h3 style={{ flex: 1 }}>Fleet comparison</h3>
          <span className="sub">{comp ? `${comp.rows.length} samithis` : ''}</span>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {th('name_en', 'Samithi')}
                {th('members_total', 'Members')}
                {th('members_enrolled', 'Enrolled')}
                {th('wallets_total_cents', 'Wallets', { textAlign: 'right' })}
                {th('loans_active', 'Loans')}
                {th('loans_outstanding_cents', 'Outstanding', { textAlign: 'right' })}
                {th('fds_count', 'FDs')}
                {th('pending_requests', 'Pending')}
                {th('last_txn_at', 'Last txn')}
              </tr>
            </thead>
            <tbody>
              {!comp ? Array.from({ length: 3 }).map((_, i) => <tr key={i}><td colSpan={9}><Skeleton h={20} /></td></tr>)
                : sorted.map((r) => (
                  <tr key={r.slug}>
                    <td>
                      <div className="t-strong row" style={{ gap: 6 }}>
                        {r.name_en}{r.reachable === 0 && <WifiOff size={12} color="var(--warning)" />}
                      </div>
                      <div className="t-mut mono" style={{ fontSize: 12 }}>{r.slug}{r.status !== 'active' ? ` · ${r.status}` : ''}</div>
                    </td>
                    <td>{r.members_total}<span className="t-mut"> · {r.members_active} active</span></td>
                    <td>{r.members_enrolled}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{rs(r.wallets_total_cents)}</td>
                    <td>{r.loans_active}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{rs(r.loans_outstanding_cents)}</td>
                    <td>{r.fds_count}</td>
                    <td>{r.pending_requests}</td>
                    <td className="t-mut">{r.last_txn_at ? String(r.last_txn_at).slice(0, 10) : '—'}</td>
                  </tr>
                ))}
            </tbody>
            {comp && comp.rows.length > 0 && (
              <tfoot><tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td>Fleet total</td>
                <td>{comp.totals.members_total}<span className="t-mut"> · {comp.totals.members_active}</span></td>
                <td>{comp.totals.members_enrolled}</td>
                <td style={{ textAlign: 'right' }} className="mono">{rs(comp.totals.wallets_total_cents)}</td>
                <td>{comp.totals.loans_active}</td>
                <td style={{ textAlign: 'right' }} className="mono">{rs(comp.totals.loans_outstanding_cents)}</td>
                <td>{comp.totals.fds_count}</td>
                <td>{comp.totals.pending_requests}</td>
                <td></td>
              </tr></tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  )
}

export function downloadComparison(comp: Comparison): void {
  const { headers, body } = csvOf(comp.rows)
  downloadCsv('esamithi-comparison', headers, body)
}
