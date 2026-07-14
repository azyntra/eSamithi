import React, { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, LogIn, Users, Wallet, Landmark, PiggyBank, Smartphone, Lock, ShieldAlert, Database, WifiOff, UserPlus, KeyRound, Trash2, ShieldCheck, Shield, Unlock } from 'lucide-react'
import { api, rs, fmtDate, timeAgo } from '../api'
import { useAuth } from '../auth'
import { Button, StatusBadge, Skeleton, EmptyState, useToast, Modal, useConfirm, CopyChip } from '../components/ui'
import { enterSamithi } from '../lib/enter'

interface StaffUser { id: number; username: string; full_name: string; role: string; is_active: number; last_login_at: string | null }
interface LockedMember { id: number; society_id: string; full_name: string | null; pin_locked_until: string; failed_pin_attempts: number }

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
    staff: StaffUser[]
    locked_members: LockedMember[]
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
  const { admin } = useAuth()
  const toast = useToast()
  const { confirm, node: confirmNode } = useConfirm()
  const [d, setD] = useState<Detail | null>(null)
  const [entering, setEntering] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [tempPw, setTempPw] = useState<{ who: string; pw: string } | null>(null)

  const canWrite = admin?.role === 'superadmin'
  const load = useCallback(async () => setD(await api<Detail>(`/samithis/${slug}`)), [slug])
  useEffect(() => { load().catch((e) => toast('error', (e as Error).message)) }, [load, toast])

  const enter = async (): Promise<void> => {
    setEntering(true)
    try { await enterSamithi(d!.samithi.slug, d!.samithi.name_en, admin!.email) }
    catch (e) { toast('error', (e as Error).message); setEntering(false) }
  }

  // ── Staff-user & PIN mutations (FR-4.2 / FR-4.3) ──
  const run = async (key: string, fn: () => Promise<void>): Promise<void> => {
    setBusy(key)
    try { await fn(); await load() }
    catch (e) { toast('error', (e as Error).message) }
    finally { setBusy(null) }
  }

  const resetPassword = (u: StaffUser): Promise<void> => run(`rp-${u.id}`, async () => {
    const r = await api<{ temp_password: string }>(`/samithis/${slug}/users/${u.id}/reset-password`, { method: 'POST' })
    setTempPw({ who: u.username, pw: r.temp_password })
  })

  const toggleRole = (u: StaffUser): Promise<void> => run(`role-${u.id}`, async () => {
    const role = u.role === 'admin' ? 'user' : 'admin'
    await api(`/samithis/${slug}/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ role }) })
    toast('success', `${u.username} is now ${role}`)
  })

  const toggleActive = async (u: StaffUser): Promise<void> => {
    if (u.is_active) {
      const ok = await confirm({ title: 'Disable staff login', danger: true, confirmLabel: 'Disable',
        message: <>Disable <b>{u.username}</b>? They will be signed out and unable to log in until re-enabled.</> })
      if (!ok) return
    }
    return run(`act-${u.id}`, async () => {
      await api(`/samithis/${slug}/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: u.is_active ? 0 : 1 }) })
      toast('success', `${u.username} ${u.is_active ? 'disabled' : 'enabled'}`)
    })
  }

  const removeUser = async (u: StaffUser): Promise<void> => {
    const ok = await confirm({ title: 'Delete staff user', danger: true, confirmLabel: 'Delete',
      message: <>Permanently delete <b>{u.username}</b> ({u.full_name})? This cannot be undone.</> })
    if (!ok) return
    return run(`del-${u.id}`, async () => {
      await api(`/samithis/${slug}/users/${u.id}`, { method: 'DELETE' })
      toast('success', `${u.username} deleted`)
    })
  }

  const unlockPin = (m: LockedMember): Promise<void> => run(`pin-${m.id}`, async () => {
    await api(`/samithis/${slug}/members/${m.id}/unlock-pin`, { method: 'POST' })
    toast('success', `PIN unlocked for ${m.full_name || m.society_id}`)
  })

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

          {/* Locked PINs — unlock inline (FR-4.3) */}
          {det.locked_members.length > 0 && (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="card-head"><Lock size={15} color="var(--warning)" /><h3 style={{ flex: 1 }}>Locked mobile PINs</h3><span className="sub">{det.locked_members.length}</span></div>
              <div className="table-wrap"><table className="tbl">
                <thead><tr><th>Member</th><th>Society ID</th><th>Locked until</th><th>Attempts</th><th></th></tr></thead>
                <tbody>{det.locked_members.map((m) => (
                  <tr key={m.id}>
                    <td className="t-strong">{m.full_name || '—'}</td>
                    <td className="t-mut mono">{m.society_id}</td>
                    <td className="t-mut">{fmtDate(m.pin_locked_until)}</td>
                    <td>{m.failed_pin_attempts}</td>
                    <td style={{ textAlign: 'right' }}>
                      {canWrite && <Button size="sm" variant="ghost" loading={busy === `pin-${m.id}`} onClick={() => unlockPin(m)}><Unlock size={13} /> Unlock</Button>}
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
            <div className="card">
              <div className="card-head">
                <h3 style={{ flex: 1 }}>Staff users</h3>
                {canWrite && <Button size="sm" variant="ghost" onClick={() => setAddOpen(true)}><UserPlus size={14} /> Add user</Button>}
              </div>
              <div className="table-wrap"><table className="tbl">
                <thead><tr><th>User</th><th>Role</th><th>Last login</th><th></th></tr></thead>
                <tbody>{det.staff.map((u) => (
                  <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.55 }}>
                    <td>
                      <div className="t-strong">{u.full_name}</div>
                      <div className="t-mut mono" style={{ fontSize: 12 }}>{u.username}{!u.is_active && ' · disabled'}</div>
                    </td>
                    <td><span className={`badge ${u.role === 'admin' ? 'active' : 'neutral'}`}>{u.role === 'admin' ? <ShieldCheck size={11} /> : <Shield size={11} />} {u.role}</span></td>
                    <td className="t-mut">{timeAgo(u.last_login_at)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {canWrite && <>
                        <button className="btn-icon" title="Reset password" disabled={busy === `rp-${u.id}`} onClick={() => resetPassword(u)}><KeyRound size={14} /></button>
                        <button className="btn-icon" title={u.role === 'admin' ? 'Make staff (user)' : 'Make admin'} disabled={busy === `role-${u.id}`} onClick={() => toggleRole(u)}>{u.role === 'admin' ? <Shield size={14} /> : <ShieldCheck size={14} />}</button>
                        <button className="btn-icon" title={u.is_active ? 'Disable login' : 'Enable login'} disabled={busy === `act-${u.id}`} onClick={() => toggleActive(u)}>{u.is_active ? <Lock size={14} /> : <Unlock size={14} />}</button>
                        <button className="btn-icon" title="Delete" disabled={busy === `del-${u.id}`} onClick={() => removeUser(u)}><Trash2 size={14} color="var(--danger)" /></button>
                      </>}
                    </td>
                  </tr>
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

      {addOpen && <AddUserModal slug={slug!} onClose={() => setAddOpen(false)} onCreated={(who, pw) => { setAddOpen(false); setTempPw({ who, pw }); load() }} onError={(m) => toast('error', m)} />}

      {tempPw && (
        <Modal title="Temporary password" icon={<KeyRound size={18} />} onClose={() => setTempPw(null)}
          footer={<Button onClick={() => setTempPw(null)}>Done</Button>}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Share this one-time password with <b>{tempPw.who}</b> over a secure channel. It is shown <b>once</b> — it cannot be retrieved again.
          </p>
          <div className="row" style={{ gap: 8, padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <code className="mono" style={{ flex: 1, fontSize: 16, letterSpacing: 0.5 }}>{tempPw.pw}</code>
            <CopyChip text={tempPw.pw} />
          </div>
          <p className="t-mut" style={{ fontSize: 12.5, marginTop: 12 }}>Ask them to change it after signing in.</p>
        </Modal>
      )}

      {confirmNode}
    </>
  )
}

function AddUserModal({ slug, onClose, onCreated, onError }: {
  slug: string; onClose: () => void; onCreated: (who: string, pw: string) => void; onError: (m: string) => void
}): React.ReactElement {
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('user')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!username.trim() || !fullName.trim()) return
    setSaving(true)
    try {
      const r = await api<{ temp_password: string }>(`/samithis/${slug}/users`, {
        method: 'POST', body: JSON.stringify({ username: username.trim(), full_name: fullName.trim(), role })
      })
      onCreated(username.trim(), r.temp_password)
    } catch (e) { onError((e as Error).message); setSaving(false) }
  }

  return (
    <Modal title="Add staff user" icon={<UserPlus size={18} />} onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={saving} onClick={() => (document.getElementById('add-user-form') as HTMLFormElement)?.requestSubmit()}>Create user</Button>
      </>}>
      <form id="add-user-form" onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div className="field"><label>Full name</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus placeholder="e.g. Nimal Perera" /></div>
        <div className="field"><label>Username</label><input className="input mono" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. nimal" autoCapitalize="off" autoCorrect="off" /></div>
        <div className="field"><label>Role</label>
          <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">Staff (user)</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        <p className="t-mut" style={{ fontSize: 12.5, margin: 0 }}>A one-time temporary password will be generated and shown once after creation.</p>
      </form>
    </Modal>
  )
}
