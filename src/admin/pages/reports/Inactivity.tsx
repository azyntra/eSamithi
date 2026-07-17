import React, { useCallback, useEffect, useState } from 'react'
import { AlarmClock } from 'lucide-react'
import { api, downloadCsv, fmtDate } from '../../api'
import { EmptyState, Skeleton, useToast } from '../../components/ui'

export interface InactRow {
  slug: string; name_en: string; last_txn_at: string | null
  members_total: number; days_since: number | null; reachable: number | null
}

export default function Inactivity({ onData }: { onData: (rows: InactRow[] | null, days: number) => void }): React.ReactElement {
  const toast = useToast()
  const [rows, setRows] = useState<InactRow[] | null>(null)
  const [days, setDays] = useState(30)

  const load = useCallback(async (d: number) => {
    const r = await api<{ rows: InactRow[] }>(`/reports/inactivity?days=${d}`)
    setRows(r.rows)
    onData(r.rows, d)
  }, [onData])

  useEffect(() => { load(days).catch((e) => toast('error', (e as Error).message)) }, [days, load, toast])

  return (
    <div className="card">
      <div className="card-head">
        <AlarmClock size={15} />
        <h3 style={{ flex: 1 }}>Inactivity report</h3>
        <select className="select no-print" style={{ width: 'auto' }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>No activity in 7 days</option>
          <option value={30}>30 days</option>
          <option value={60}>60 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>
      {!rows ? <div className="card-pad"><Skeleton h={40} /></div>
        : rows.length === 0
          ? <EmptyState title="All active samithis have recent activity" hint={`No samithi has been quiet for more than ${days} days.`} />
          : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Samithi</th><th>Members</th><th>Last transaction</th><th>Quiet for</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.slug}>
                    <td><div className="t-strong">{r.name_en}</div><div className="t-mut mono" style={{ fontSize: 12 }}>{r.slug}</div></td>
                    <td>{r.members_total}</td>
                    <td className="t-mut">{r.last_txn_at ? fmtDate(r.last_txn_at).slice(0, 10) : 'never'}</td>
                    <td><span className="badge warn">{r.days_since != null ? `${r.days_since} days` : 'no transactions'}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
    </div>
  )
}

export function downloadInactivity(rows: InactRow[], days: number): void {
  downloadCsv(
    `esamithi-inactivity-${days}d`,
    ['Samithi', 'Slug', 'Members', 'Last transaction', 'Days quiet'],
    rows.map((r) => [r.name_en, r.slug, r.members_total,
      r.last_txn_at ? String(r.last_txn_at).slice(0, 10) : 'never', r.days_since ?? ''])
  )
}
