import React, { useCallback, useEffect, useState } from 'react'
import { ShieldOff } from 'lucide-react'
import { api, fmtDate, timeAgo } from '../api'
import { Button, Skeleton, EmptyState, useToast, useConfirm } from '../components/ui'

interface Session { sid: string; samithi_slug: string; admin_email: string; created_at: string; expires_at: string }

export default function Sessions(): React.ReactElement {
  const toast = useToast()
  const { confirm, node } = useConfirm()
  const [rows, setRows] = useState<Session[] | null>(null)
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => setRows(await api<Session[]>('/impersonations')), [])
  useEffect(() => {
    load().catch((e) => toast('error', (e as Error).message))
    const id = setInterval(() => load().catch(() => {}), 20000) // live refresh
    return () => clearInterval(id)
  }, [load, toast])

  const revoke = async (s: Session): Promise<void> => {
    if (!(await confirm({ title: 'Revoke this support session?', danger: true, confirmLabel: 'Revoke',
      message: <>The operator in <b>{s.samithi_slug}</b> will be signed out on their next action (within ~60s).</> }))) return
    setBusy(s.sid)
    try { await api(`/impersonations/${s.sid}`, { method: 'DELETE' }); await load(); toast('success', 'Session revoked') }
    catch (e) { toast('error', (e as Error).message) }
    finally { setBusy('') }
  }

  return (
    <>
      {node}
      <div className="card">
        <div className="card-head"><h3>Active support sessions</h3><span className="sub">{rows ? rows.length : ''}</span></div>
        {!rows ? (
          <div className="card-pad"><Skeleton h={22} /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="No active support sessions" hint="Sessions appear here while an operator is inside a samithi." />
        ) : (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Samithi</th><th>Operator</th><th>Started</th><th>Expires</th><th style={{ textAlign: 'right' }}></th></tr></thead>
            <tbody>{rows.map((s) => (
              <tr key={s.sid}>
                <td className="t-strong">{s.samithi_slug}</td>
                <td className="t-mut">{s.admin_email}</td>
                <td className="t-mut">{timeAgo(s.created_at)}</td>
                <td className="t-mut">{fmtDate(s.expires_at).slice(11)}</td>
                <td style={{ textAlign: 'right' }}>
                  <Button size="sm" variant="danger" loading={busy === s.sid} onClick={() => revoke(s)}>
                    {busy !== s.sid && <ShieldOff size={13} />} Revoke
                  </Button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  )
}
