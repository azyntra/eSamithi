import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Users, Smartphone, UserCog, Wallet, Landmark, PiggyBank, Inbox, RefreshCw, LogIn } from 'lucide-react'
import { api, rs, timeAgo } from '../api'
import { useAuth } from '../auth'
import { Button, Skeleton, StatusBadge, useToast } from '../components/ui'
import { enterSamithi } from '../lib/enter'

interface Dash {
  samithis: { total: number; active: number; suspended: number }
  totals: { members: number; enrolled: number; staff: number; wallets_cents: number; loans_active: number; loans_outstanding_cents: number; fds_count: number; fds_value_cents: number; pending_requests: number }
  at_a_glance: Array<{ slug: string; name_en: string; join_code: string; status: string; members_total: number | null; loans_outstanding_cents: number | null; last_txn_at: string | null; reachable: number | null; stale: number }>
}

function Tile({ icon, tint, label, value, sub }: { icon: React.ReactNode; tint: string; label: string; value: string; sub?: string }): React.ReactElement {
  return (
    <div className="tile">
      <div className="tile-top">
        <span className="tile-label">{label}</span>
        <span className="tile-ico" style={{ background: tint + '22', color: tint }}>{icon}</span>
      </div>
      <div className="tile-value">{value}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  )
}

export default function Dashboard(): React.ReactElement {
  const { admin } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [data, setData] = useState<Dash | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)
  const [entering, setEntering] = useState('')

  const load = useCallback(async () => {
    const d = await api<Dash>('/dashboard')
    setData(d)
    setUpdatedAt(new Date().toISOString())
  }, [])

  useEffect(() => { load().catch((e) => toast('error', (e as Error).message)) }, [load, toast])

  const refresh = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await api('/dashboard/refresh', { method: 'POST' })
      await load()
      toast('success', 'Fleet stats refreshed')
    } catch (e) { toast('error', (e as Error).message) }
    finally { setRefreshing(false) }
  }

  const enter = async (slug: string, name: string): Promise<void> => {
    setEntering(slug)
    try { await enterSamithi(slug, name, admin!.email) }
    catch (e) { toast('error', (e as Error).message); setEntering('') }
  }

  const t = data?.totals
  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <div className="t-mut">{updatedAt ? `Updated ${timeAgo(updatedAt)}` : 'Loading…'}</div>
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="ghost" size="sm" onClick={refresh} loading={refreshing}>
            {!refreshing && <RefreshCw size={14} />} Refresh now
          </Button>
        </div>
      </div>

      <div className="tiles" style={{ marginBottom: 22 }}>
        {!data ? (
          Array.from({ length: 8 }).map((_, i) => <div key={i} className="tile"><Skeleton h={64} /></div>)
        ) : (
          <>
            <Tile icon={<Building2 size={18} />} tint="#1E64D4" label="Samithis" value={`${data.samithis.active}/${data.samithis.total}`} sub={data.samithis.suspended ? `${data.samithis.suspended} suspended` : 'all active'} />
            <Tile icon={<Users size={18} />} tint="#16A34A" label="Members" value={t!.members.toLocaleString()} sub={`${t!.enrolled} app-enrolled`} />
            <Tile icon={<Smartphone size={18} />} tint="#8B5CF6" label="App enrolled" value={t!.enrolled.toLocaleString()} />
            <Tile icon={<UserCog size={18} />} tint="#0EA5E9" label="Staff users" value={String(t!.staff)} />
            <Tile icon={<Wallet size={18} />} tint="#16A34A" label="Wallet balances" value={rs(t!.wallets_cents)} sub="fleet total" />
            <Tile icon={<Landmark size={18} />} tint="#D97706" label="Active loans" value={String(t!.loans_active)} sub={`${rs(t!.loans_outstanding_cents)} owed`} />
            <Tile icon={<PiggyBank size={18} />} tint="#8B5CF6" label="Fixed deposits" value={String(t!.fds_count)} sub={rs(t!.fds_value_cents)} />
            <Tile icon={<Inbox size={18} />} tint="#DC2626" label="Pending requests" value={String(t!.pending_requests)} />
          </>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h3>Samithis at a glance</h3><span className="sub">{data ? `${data.at_a_glance.length} societies` : ''}</span></div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Samithi</th><th>Members</th><th>Outstanding loans</th><th>Last activity</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {!data ? (
                Array.from({ length: 2 }).map((_, i) => <tr key={i}><td colSpan={6}><Skeleton h={22} /></td></tr>)
              ) : data.at_a_glance.map((s) => (
                <tr key={s.slug} style={{ cursor: 'pointer' }} onClick={() => nav(`/samithis/${s.slug}`)}>
                  <td>
                    <div className="t-strong">{s.name_en}</div>
                    <div className="t-mut">{s.slug} · <span className="mono">{s.join_code}</span></div>
                  </td>
                  <td>{s.members_total ?? '—'}{s.reachable === 0 && <span className="t-mut"> (offline)</span>}</td>
                  <td>{s.loans_outstanding_cents != null ? rs(s.loans_outstanding_cents) : '—'}</td>
                  <td style={s.stale ? { color: 'var(--warning)' } : undefined}>{s.last_txn_at ? String(s.last_txn_at).slice(0, 10) : '—'}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
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
