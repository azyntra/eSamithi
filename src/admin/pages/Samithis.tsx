import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Ban, CircleCheck, RefreshCcw, ChevronRight } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Button, StatusBadge, Skeleton, CopyChip, useToast, useConfirm } from '../components/ui'
import { enterSamithi } from '../lib/enter'

interface Row {
  id: number; slug: string; join_code: string; name_en: string; status: string
  db_name: string; min_app_version: string | null; api_url: string
}

export default function Samithis(): React.ReactElement {
  const { admin } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const { confirm, node } = useConfirm()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => setRows(await api<Row[]>('/samithis')), [])
  useEffect(() => { load().catch((e) => toast('error', (e as Error).message)) }, [load, toast])

  const patch = async (slug: string, body: object, ok: string): Promise<void> => {
    setBusy(slug)
    try { await api(`/samithis/${slug}`, { method: 'PATCH', body: JSON.stringify(body) }); await load(); toast('success', ok) }
    catch (e) { toast('error', (e as Error).message) }
    finally { setBusy('') }
  }

  const suspend = async (r: Row): Promise<void> => {
    if (await confirm({ title: `Suspend ${r.name_en}?`, danger: true, confirmLabel: 'Suspend',
      message: <>All of this samithi's apps will get a clear "suspended" error within 30 seconds. Data is untouched and you can reactivate anytime.</> }))
      patch(r.slug, { action: 'suspend' }, `${r.name_en} suspended`)
  }
  const reactivate = (r: Row): void => { patch(r.slug, { action: 'reactivate' }, `${r.name_en} reactivated`) }
  const regen = async (r: Row): Promise<void> => {
    if (await confirm({ title: `Regenerate join code for ${r.name_en}?`, confirmLabel: 'Regenerate',
      message: <>The current code <b>{r.join_code}</b> will stop working immediately. New members and re-installs must use the new code.</> }))
      patch(r.slug, { action: 'regenerate_code' }, 'New join code generated')
  }

  const enter = async (r: Row): Promise<void> => {
    setBusy(r.slug)
    try { await enterSamithi(r.slug, r.name_en, admin!.email) }
    catch (e) { toast('error', (e as Error).message); setBusy('') }
  }

  return (
    <>
      {node}
      <div className="card">
        <div className="card-head"><h3>All samithis</h3><span className="sub">{rows ? `${rows.length} total` : ''}</span></div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Samithi</th><th>Join code</th><th>Database</th><th>Min app</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {!rows ? (
                Array.from({ length: 2 }).map((_, i) => <tr key={i}><td colSpan={6}><Skeleton h={22} /></td></tr>)
              ) : rows.map((r) => (
                <tr key={r.slug}>
                  <td onClick={() => nav(`/samithis/${r.slug}`)} style={{ cursor: 'pointer' }}>
                    <div className="t-strong row" style={{ gap: 6 }}>{r.name_en} <ChevronRight size={14} className="t-mut" /></div>
                    <div className="t-mut">{r.slug}</div>
                  </td>
                  <td><span className="row"><span className="mono">{r.join_code}</span><CopyChip text={r.join_code} /></span></td>
                  <td className="t-mut mono">{r.db_name}</td>
                  <td className="t-mut">{r.min_app_version || '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      {r.status === 'active'
                        ? <Button size="sm" variant="ghost" loading={busy === r.slug} onClick={() => enter(r)}><LogIn size={13} /> Enter</Button>
                        : null}
                      {r.status === 'active'
                        ? <Button size="sm" variant="ghost" onClick={() => suspend(r)}><Ban size={13} /> Suspend</Button>
                        : <Button size="sm" variant="success" onClick={() => reactivate(r)}><CircleCheck size={13} /> Reactivate</Button>}
                      <Button size="sm" variant="ghost" onClick={() => regen(r)} title="Regenerate join code"><RefreshCcw size={13} /></Button>
                    </div>
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
