import React, { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api, fmtDate } from '../api'
import { Skeleton, EmptyState, useToast } from '../components/ui'

interface Entry {
  id: number; admin_email: string | null; role: string | null; action: string
  samithi_slug: string | null; payload_after: unknown; ip: string | null; created_at: string
}

// Compact, readable rendering of the audit payload (not raw JSON)
function Detail({ payload }: { payload: unknown }): React.ReactElement {
  if (!payload || typeof payload !== 'object') return <span className="t-mut">—</span>
  const obj = payload as Record<string, unknown>
  const entries = Object.entries(obj).filter(([k]) => k !== '_status')
  const status = obj._status
  return (
    <span className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
      {typeof status === 'number' && <Badge>{`HTTP ${status}`}</Badge>}
      {entries.slice(0, 5).map(([k, v]) => (
        <span key={k} className="t-mut" style={{ fontSize: 12 }}>
          <b style={{ color: 'var(--text-secondary)' }}>{k}</b>: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
        </span>
      ))}
    </span>
  )
}

function Badge({ children }: { children: React.ReactNode }): React.ReactElement {
  return <span className="badge neutral" style={{ fontSize: 11 }}>{children}</span>
}

export default function Audit(): React.ReactElement {
  const toast = useToast()
  const [rows, setRows] = useState<Entry[] | null>(null)
  const [action, setAction] = useState('')
  const [samithi, setSamithi] = useState('')

  const load = useCallback(async () => {
    const q = new URLSearchParams({ limit: '100' })
    if (action) q.set('action', action)
    if (samithi) q.set('samithi', samithi)
    setRows(await api<Entry[]>(`/audit?${q.toString()}`))
  }, [action, samithi])

  useEffect(() => { load().catch((e) => toast('error', (e as Error).message)) }, [load, toast])

  return (
    <div className="card">
      <div className="card-head">
        <h3 style={{ flex: 1 }}>Audit log</h3>
        <div className="row" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 6, border: '1px solid var(--border)', borderRadius: 8, padding: '0 10px' }}>
            <Search size={14} className="t-mut" />
            <input className="input" style={{ border: 0, padding: '7px 0', width: 150, background: 'transparent' }}
              placeholder="Filter action…" value={action}
              onChange={(e) => setAction(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
          </div>
          <input className="input" style={{ width: 130, padding: '7px 10px' }} placeholder="samithi slug"
            value={samithi} onChange={(e) => setSamithi(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
      </div>
      {!rows ? (
        <div className="card-pad"><Skeleton h={22} /></div>
      ) : rows.length === 0 ? (
        <EmptyState title="No matching events" />
      ) : (
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Samithi</th><th>Detail</th></tr></thead>
          <tbody>{rows.map((a) => (
            <tr key={a.id}>
              <td className="t-mut" style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.created_at)}</td>
              <td>{a.admin_email || <span className="t-mut">system</span>}</td>
              <td><span className="mono">{a.action}</span></td>
              <td>{a.samithi_slug || <span className="t-mut">—</span>}</td>
              <td><Detail payload={a.payload_after} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  )
}
