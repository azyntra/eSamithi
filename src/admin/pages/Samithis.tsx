import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Ban, CircleCheck, RefreshCcw, ChevronRight, Plus, Building2, PartyPopper } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Button, StatusBadge, Skeleton, CopyChip, useToast, useConfirm, Modal } from '../components/ui'
import { enterSamithi } from '../lib/enter'

interface Row {
  id: number; slug: string; join_code: string; name_en: string; status: string
  db_name: string; min_app_version: string | null; api_url: string; server_code: string
}

interface ServerRow { code: string; api_url: string; role: string; samithi_count: number }

interface OnboardResult {
  slug: string; join_code: string; name_en: string; db_name: string; server_code?: string
  admin_username: string; admin_password: string
}

export default function Samithis(): React.ReactElement {
  const { admin } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const { confirm, node } = useConfirm()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState('')
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [result, setResult] = useState<OnboardResult | null>(null)
  const canWrite = admin?.role === 'superadmin'

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
        <div className="card-head">
          <h3 style={{ flex: 1 }}>All samithis</h3>
          <span className="sub">{rows ? `${rows.length} total` : ''}</span>
          {canWrite && <Button size="sm" onClick={() => setOnboardOpen(true)}><Plus size={14} /> Onboard samithi</Button>}
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Samithi</th><th>Join code</th><th>Server</th><th>Database</th><th>Min app</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {!rows ? (
                Array.from({ length: 2 }).map((_, i) => <tr key={i}><td colSpan={7}><Skeleton h={22} /></td></tr>)
              ) : rows.map((r) => (
                <tr key={r.slug}>
                  <td onClick={() => nav(`/samithis/${r.slug}`)} style={{ cursor: 'pointer' }}>
                    <div className="t-strong row" style={{ gap: 6 }}>{r.name_en} <ChevronRight size={14} className="t-mut" /></div>
                    <div className="t-mut">{r.slug}</div>
                  </td>
                  <td><span className="row"><span className="mono">{r.join_code}</span><CopyChip text={r.join_code} /></span></td>
                  <td><span className="badge neutral">{r.server_code}</span></td>
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

      {onboardOpen && (
        <OnboardModal
          onClose={() => setOnboardOpen(false)}
          onDone={(r) => { setOnboardOpen(false); setResult(r); load() }}
          onError={(m) => toast('error', m)}
          existingSlugs={rows?.map((r) => r.slug) || []}
        />
      )}

      {result && (
        <Modal title="Samithi onboarded" icon={<PartyPopper size={18} />} onClose={() => setResult(null)}
          footer={<Button onClick={() => setResult(null)}>Done</Button>}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 14 }}>
            <b>{result.name_en}</b> is live and reachable from the desktop &amp; mobile apps. Share the join code, and hand the admin credentials over securely — <b>the password is shown once</b>.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            <CredRow label="Join code" value={result.join_code} />
            <CredRow label="Admin username" value={result.admin_username} />
            <CredRow label="Temporary password" value={result.admin_password} />
          </div>
          <p className="t-mut" style={{ fontSize: 12.5, marginTop: 14 }}>Ask the samithi admin to sign in on the desktop app with the join code, then change this password.</p>
        </Modal>
      )}
    </>
  )
}

function CredRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="row" style={{ gap: 8, padding: '10px 13px', background: 'var(--bg-hover)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <span className="t-mut" style={{ width: 140, fontSize: 12.5 }}>{label}</span>
      <code className="mono" style={{ flex: 1, fontSize: 14 }}>{value}</code>
      <CopyChip text={value} />
    </div>
  )
}

function OnboardModal({ onClose, onDone, onError, existingSlugs }: {
  onClose: () => void; onDone: (r: OnboardResult) => void; onError: (m: string) => void; existingSlugs: string[]
}): React.ReactElement {
  const [nameEn, setNameEn] = useState('')
  const [nameSi, setNameSi] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [minApp, setMinApp] = useState('')
  const [saving, setSaving] = useState(false)
  const [servers, setServers] = useState<ServerRow[]>([])
  const [serverCode, setServerCode] = useState('')

  useEffect(() => {
    api<ServerRow[]>('/servers').then((rows) => {
      setServers(rows)
      if (rows.length > 0) setServerCode(rows[0].code)
    }).catch(() => {})
  }, [])

  // Auto-suggest a slug from the English name until the operator edits it
  const autoSlug = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20)
  const effSlug = (slugTouched ? slug : autoSlug).trim()
  const slugValid = /^[a-z0-9][a-z0-9_-]{1,19}$/.test(effSlug)
  const slugTaken = existingSlugs.includes(effSlug)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!nameEn.trim() || !slugValid || slugTaken) return
    setSaving(true)
    try {
      const r = await api<OnboardResult>('/samithis', {
        method: 'POST',
        body: JSON.stringify({
          slug: effSlug, name_en: nameEn.trim(), name_si: nameSi.trim() || undefined,
          min_app_version: minApp.trim() || undefined, server_code: serverCode || undefined
        })
      })
      onDone(r)
    } catch (e) { onError((e as Error).message); setSaving(false) }
  }

  return (
    <Modal title="Onboard a new samithi" icon={<Building2 size={18} />} onClose={saving ? () => {} : onClose}
      footer={<>
        <Button variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button loading={saving} disabled={!nameEn.trim() || !slugValid || slugTaken}
          onClick={() => (document.getElementById('onboard-form') as HTMLFormElement)?.requestSubmit()}>
          {saving ? 'Provisioning…' : 'Create samithi'}
        </Button>
      </>}>
      <form id="onboard-form" onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div className="field"><label>Display name (English)</label>
          <input className="input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} autoFocus placeholder="e.g. Kandy Welfare Society" /></div>
        <div className="field"><label>Display name (Sinhala) <span className="t-mut">— optional</span></label>
          <input className="input" value={nameSi} onChange={(e) => setNameSi(e.target.value)} placeholder="මහනුවර සුභසාධක සමිතිය" /></div>
        <div className="field"><label>Slug (URL / database identifier)</label>
          <input className="input mono" value={effSlug} autoCapitalize="off" autoCorrect="off"
            onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()) }} placeholder="kandy-welfare" />
          {effSlug && !slugValid && <span className="t-mut" style={{ fontSize: 12, color: 'var(--danger)' }}>2–20 chars: lowercase letters/digits, - or _</span>}
          {slugValid && slugTaken && <span className="t-mut" style={{ fontSize: 12, color: 'var(--danger)' }}>Slug already in use</span>}
          {slugValid && !slugTaken && <span className="t-mut" style={{ fontSize: 12 }}>Database: <span className="mono">esamithi_{effSlug}</span></span>}
        </div>
        {servers.length > 1 && (
          <div className="field"><label>Host server</label>
            <select className="select" value={serverCode} onChange={(e) => setServerCode(e.target.value)}>
              {servers.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.api_url} ({s.samithi_count} samithis)</option>)}
            </select>
          </div>
        )}
        <div className="field"><label>Minimum app version <span className="t-mut">— optional</span></label>
          <input className="input mono" value={minApp} onChange={(e) => setMinApp(e.target.value)} placeholder="e.g. 1.2.0" /></div>
        <p className="t-mut" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>
          This creates the database, runs all migrations, seeds an admin account, and publishes the samithi to the directory — no server access needed. Takes about a minute.
        </p>
      </form>
    </Modal>
  )
}
