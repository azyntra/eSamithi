import React, { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCcw, AlarmClock, WifiOff } from 'lucide-react'
import { api, rs, fmtDate, timeAgo } from '../api'
import { Button, Skeleton, EmptyState, useToast } from '../components/ui'

interface CompRow {
  slug: string; name_en: string; status: string; reachable: number | null; captured_at: string | null
  members_total: number; members_active: number; members_enrolled: number; staff_users: number
  wallets_total_cents: number; loans_active: number; loans_outstanding_cents: number
  fds_count: number; fds_value_cents: number; pending_requests: number; last_txn_at: string | null
}
interface Comparison { rows: CompRow[]; totals: Omit<CompRow, 'slug' | 'name_en' | 'status' | 'reachable' | 'captured_at' | 'last_txn_at'>; as_of: string | null }
interface InactRow { slug: string; name_en: string; last_txn_at: string | null; members_total: number; days_since: number | null; reachable: number | null }

function toCsv(rows: CompRow[]): string {
  const head = ['Samithi', 'Slug', 'Status', 'Members', 'Active', 'App enrolled', 'Staff', 'Wallets (Rs)', 'Active loans', 'Outstanding (Rs)', 'FDs', 'FD value (Rs)', 'Pending', 'Last txn']
  const money = (c: number): string => (c / 100).toFixed(2)
  const esc = (v: string | number): string => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const lines = [head.join(',')]
  for (const r of rows) {
    lines.push([r.name_en, r.slug, r.status, r.members_total, r.members_active, r.members_enrolled, r.staff_users,
      money(r.wallets_total_cents), r.loans_active, money(r.loans_outstanding_cents), r.fds_count, money(r.fds_value_cents),
      r.pending_requests, r.last_txn_at ? String(r.last_txn_at).slice(0, 10) : ''].map(esc).join(','))
  }
  return lines.join('\n')
}

export default function Reports(): React.ReactElement {
  const toast = useToast()
  const [comp, setComp] = useState<Comparison | null>(null)
  const [days, setDays] = useState(30)
  const [inact, setInact] = useState<InactRow[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => setComp(await api<Comparison>('/reports/comparison')), [])
  const loadInact = useCallback(async (d: number) => setInact((await api<{ rows: InactRow[] }>(`/reports/inactivity?days=${d}`)).rows), [])
  useEffect(() => { load().catch((e) => toast('error', (e as Error).message)) }, [load, toast])
  useEffect(() => { loadInact(days).catch((e) => toast('error', (e as Error).message)) }, [days, loadInact, toast])

  const refresh = async (): Promise<void> => {
    setRefreshing(true)
    try { await api('/dashboard/refresh', { method: 'POST' }); await load(); await loadInact(days); toast('success', 'Snapshots refreshed') }
    catch (e) { toast('error', (e as Error).message) }
    finally { setRefreshing(false) }
  }

  const download = (): void => {
    if (!comp) return
    const blob = new Blob(['﻿' + toCsv(comp.rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `esamithi-comparison-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <span className="t-mut">{comp?.as_of ? `Snapshot ${timeAgo(comp.as_of)}` : 'Cached snapshots'}</span>
        <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>
          <Button variant="ghost" loading={refreshing} onClick={refresh}>{!refreshing && <RefreshCcw size={14} />} Refresh</Button>
          <Button onClick={download} disabled={!comp || comp.rows.length === 0}><Download size={14} /> Export CSV</Button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><h3 style={{ flex: 1 }}>Fleet comparison</h3><span className="sub">{comp ? `${comp.rows.length} samithis` : ''}</span></div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr>
              <th>Samithi</th><th>Members</th><th>Enrolled</th><th style={{ textAlign: 'right' }}>Wallets</th>
              <th>Loans</th><th style={{ textAlign: 'right' }}>Outstanding</th><th>FDs</th><th>Pending</th><th>Last txn</th>
            </tr></thead>
            <tbody>
              {!comp ? Array.from({ length: 3 }).map((_, i) => <tr key={i}><td colSpan={9}><Skeleton h={20} /></td></tr>)
                : comp.rows.map((r) => (
                  <tr key={r.slug}>
                    <td>
                      <div className="t-strong row" style={{ gap: 6 }}>{r.name_en}{r.reachable === 0 && <WifiOff size={12} color="var(--warning)" />}</div>
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

      <div className="card">
        <div className="card-head">
          <AlarmClock size={15} /><h3 style={{ flex: 1 }}>Inactivity report</h3>
          <select className="select" style={{ width: 'auto' }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>No activity in 7 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
        {!inact ? <div className="card-pad"><Skeleton h={40} /></div>
          : inact.length === 0 ? <EmptyState title="All active samithis have recent activity" hint={`No samithi has been quiet for more than ${days} days.`} />
            : (
              <div className="table-wrap"><table className="tbl">
                <thead><tr><th>Samithi</th><th>Members</th><th>Last transaction</th><th>Quiet for</th></tr></thead>
                <tbody>{inact.map((r) => (
                  <tr key={r.slug}>
                    <td><div className="t-strong">{r.name_en}</div><div className="t-mut mono" style={{ fontSize: 12 }}>{r.slug}</div></td>
                    <td>{r.members_total}</td>
                    <td className="t-mut">{r.last_txn_at ? fmtDate(r.last_txn_at).slice(0, 10) : 'never'}</td>
                    <td><span className="badge warn">{r.days_since != null ? `${r.days_since} days` : 'no transactions'}</span></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
      </div>
    </>
  )
}
