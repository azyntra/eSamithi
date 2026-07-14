import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, LogIn, Users, Wallet, Landmark, PiggyBank, Smartphone, Lock, ShieldAlert, Database, WifiOff } from 'lucide-react'
import { api, rs, fmtDate } from '../api'
import { useAuth } from '../auth'
import { Button, StatusBadge, Skeleton, EmptyState, useToast } from '../components/ui'
import { enterSamithi } from '../lib/enter'

interface Detail {
  samithi: { slug: string; name_en: string; join_code: string; status: string; db_name: string; min_app_version: string | null; onboarded_at: string; api_url: string }
  snapshot: { captured_at: string } | null
  reachable: boolean
  detail: null | {
    members: { total: number; active: number; inactive: number; enrolled: number; locked_pins: number; app_disabled: number; push_tokens: number }
    loans: { active: number; overdue: number; outstanding_cents: number }
    fds: { count: number; value_cents: number }
    pending_requests: number
    wallets: Array<{ id: number; name: string; balance_cents: number; is_active: number }>
    staff: Array<{ id: number; username: string; full_name: string; role: string }>
    settings: Array<{ key: string; value: string }>
    migrations: Array<{ id: string; applied_at: string }>
  }
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }): React.ReactElement {
  return (
    <div className="tile">
      <div className="tile-top"><span className="tile-label">{label}</span><span className="tile-ico" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{icon}</span></div>
      <div className="tile-value" style={{ fontSize: 21 }}>{value}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  )
}

export default function SamithiDetail(): React.ReactElement {
  const { slug } = useParams()
  const nav = useNavigate()
  const { admin } = useAuth()
  const toast = useToast()
  const [d, setD] = useState<Detail | null>(null)
  const [entering, setEntering] = useState(false)

  const load = useCallback(async () => setD(await api<Detail>(`/samithis/${slug}`)), [slug])
  useEffect(() => { load().catch((e) => toast('error', (e as Error).message)) }, [load, toast])

  const enter = async (): Promise<void> => {
    setEntering(true)
    try { await enterSamithi(d!.samithi.slug, d!.samithi.name_en, admin!.email) }
    catch (e) { toast('error', (e as Error).message); setEntering(false) }
  }

  if (!d) return <div className="card card-pad"><Skeleton h={28} w={280} /><div style={{ height: 16 }} /><Skeleton h={90} /></div>

  const s = d.samithi
  const det = d.detail
  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <Link to="/samithis" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> Samithis</Link>
        <div style={{ marginLeft: 'auto' }} className="row">
          {s.status === 'active' && <Button loading={entering} onClick={enter}>{!entering && <LogIn size={15} />} Enter samithi</Button>}
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 14 }}>
          <div>
            <div className="row" style={{ gap: 10 }}><h2 style={{ fontSize: 20, fontWeight: 800 }}>{s.name_en}</h2><StatusBadge status={s.status} /></div>
            <div className="t-mut" style={{ marginTop: 4 }}>{s.slug} · join code <span className="mono">{s.join_code}</span> · onboarded {fmtDate(s.onboarded_at).slice(0, 10)}</div>
          </div>
          {!d.reachable && <span className="badge warn" style={{ marginLeft: 'auto' }}><WifiOff size={12} /> API unreachable</span>}
          {d.snapshot && <span className="t-mut" style={{ marginLeft: d.reachable ? 'auto' : 0 }}>snapshot {fmtDate(d.snapshot.captured_at)}</span>}
        </div>
      </div>

      {!det ? (
        <div className="card"><EmptyState title="Live data unavailable" hint="This samithi's API did not respond. Cached registry info is shown above." /></div>
      ) : (
        <>
          <div className="tiles" style={{ marginBottom: 18 }}>
            <Stat icon={<Users size={17} />} label="Members" value={String(det.members.total)} sub={`${det.members.active} active · ${det.members.inactive} inactive`} />
            <Stat icon={<Smartphone size={17} />} label="App enrolled" value={String(det.members.enrolled)} sub={`${det.members.push_tokens} push tokens`} />
            <Stat icon={<Wallet size={17} />} label="Wallet balances" value={rs(det.wallets.reduce((a, w) => a + w.balance_cents, 0))} sub={`${det.wallets.length} wallets`} />
            <Stat icon={<Landmark size={17} />} label="Active loans" value={String(det.loans.active)} sub={`${det.loans.overdue} overdue · ${rs(det.loans.outstanding_cents)}`} />
            <Stat icon={<PiggyBank size={17} />} label="Fixed deposits" value={String(det.fds.count)} sub={rs(det.fds.value_cents)} />
            <Stat icon={<ShieldAlert size={17} />} label="Pending requests" value={String(det.pending_requests)} />
          </div>

          {(det.members.locked_pins > 0 || det.members.app_disabled > 0) && (
            <div className="card card-pad row" style={{ marginBottom: 18, gap: 22 }}>
              <span className="row" style={{ gap: 7 }}><Lock size={15} color="var(--warning)" /> <b>{det.members.locked_pins}</b> <span className="t-mut">locked PINs</span></span>
              <span className="row" style={{ gap: 7 }}><Smartphone size={15} color="var(--text-muted)" /> <b>{det.members.app_disabled}</b> <span className="t-mut">app-disabled members</span></span>
              <span className="t-mut" style={{ marginLeft: 'auto', fontSize: 12 }}>Unlock/manage from Enter samithi (or Phase C tools)</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
            <div className="card">
              <div className="card-head"><h3>Staff users</h3><span className="sub">{det.staff.length}</span></div>
              <div className="table-wrap"><table className="tbl">
                <thead><tr><th>User</th><th>Username</th><th>Role</th></tr></thead>
                <tbody>{det.staff.map((u) => (
                  <tr key={u.id}><td className="t-strong">{u.full_name}</td><td className="t-mut mono">{u.username}</td><td><span className="badge neutral">{u.role}</span></td></tr>
                ))}</tbody>
              </table></div>
            </div>
            <div className="card">
              <div className="card-head"><h3>Wallets</h3><span className="sub">{det.wallets.length}</span></div>
              <div className="table-wrap"><table className="tbl">
                <thead><tr><th>Wallet</th><th style={{ textAlign: 'right' }}>Balance</th><th></th></tr></thead>
                <tbody>{det.wallets.map((w) => (
                  <tr key={w.id}><td className="t-strong">{w.name}</td><td style={{ textAlign: 'right' }} className="mono">{rs(w.balance_cents)}</td>
                    <td>{!w.is_active && <span className="badge neutral">inactive</span>}</td></tr>
                ))}</tbody>
              </table></div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div className="card">
              <div className="card-head"><Database size={15} /><h3 style={{ flex: 1 }}>Schema migrations</h3><span className="sub">{det.migrations.length} applied</span></div>
              <div className="card-pad" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {det.migrations.map((m) => <span key={m.id} className="badge neutral mono" title={fmtDate(m.applied_at)}>{m.id}</span>)}
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>Tenant settings</h3></div>
              <div className="table-wrap"><table className="tbl">
                <tbody>{det.settings.length === 0 ? <tr><td className="t-mut">No settings</td></tr> : det.settings.map((st) => (
                  <tr key={st.key}><td className="t-mut mono">{st.key}</td><td className="t-strong">{st.value}</td></tr>
                ))}</tbody>
              </table></div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
