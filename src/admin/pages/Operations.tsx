import React, { useCallback, useEffect, useState } from 'react'
import { Activity, Server, RefreshCcw, Database, ShieldAlert, Save, Wrench, Smartphone } from 'lucide-react'
import { api, timeAgo } from '../api'
import { useAuth } from '../auth'
import { Button, Skeleton, useToast } from '../components/ui'

interface ServerHealth {
  code: string; role: string; api_url: string; up: boolean; status: string
  api_version: string | null; tenants: Record<string, string>; error?: string
}
interface Health { servers: ServerHealth[]; last_backup_at: string | null; checked_at: string }
interface Settings { maintenance_active: boolean; maintenance_message: string; global_min_app_version: string }

function tenantColor(s: string): string {
  return s === 'ok' ? 'var(--success)' : s === 'suspended' ? 'var(--warning)' : 'var(--danger)'
}

export default function Operations(): React.ReactElement {
  const { admin } = useAuth()
  const toast = useToast()
  const canWrite = admin?.role === 'superadmin'
  const [health, setHealth] = useState<Health | null>(null)
  const [checking, setChecking] = useState(false)
  const [s, setS] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)

  const loadHealth = useCallback(async () => setHealth(await api<Health>('/ops/health')), [])
  const loadSettings = useCallback(async () => setS(await api<Settings>('/ops/settings')), [])
  useEffect(() => { loadHealth().catch((e) => toast('error', (e as Error).message)); loadSettings().catch(() => {}) }, [loadHealth, loadSettings, toast])

  const recheck = async (): Promise<void> => {
    setChecking(true)
    try { await loadHealth() } catch (e) { toast('error', (e as Error).message) } finally { setChecking(false) }
  }

  const saveSettings = async (): Promise<void> => {
    if (!s) return
    setSaving(true)
    try {
      await api('/ops/settings', { method: 'PUT', body: JSON.stringify(s) })
      toast('success', 'Platform controls updated')
    } catch (e) { toast('error', (e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <span className="t-mut">{health ? `Checked ${timeAgo(health.checked_at)}` : 'Checking health…'}</span>
        <Button variant="ghost" style={{ marginLeft: 'auto' }} loading={checking} onClick={recheck}>{!checking && <RefreshCcw size={14} />} Re-check</Button>
      </div>

      {/* Server + tenant health (FR-8.1/8.2) */}
      <div style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
        {!health ? <div className="card card-pad"><Skeleton h={80} /></div>
          : health.servers.map((sv) => (
            <div key={sv.code} className="card card-pad">
              <div className="row" style={{ gap: 12 }}>
                <span className="tile-ico" style={{ background: sv.up ? 'var(--success-light)' : 'var(--danger-light)', color: sv.up ? 'var(--success)' : 'var(--danger)' }}><Server size={18} /></span>
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="t-strong">{sv.code}</span>
                    <span className="badge neutral">{sv.role}</span>
                    <span className={`badge ${sv.up ? 'active' : 'suspended'}`}><span className="dot" style={{ background: 'currentColor' }} /> {sv.status}</span>
                    {sv.api_version && <span className="t-mut mono" style={{ fontSize: 12 }}>API v{sv.api_version}</span>}
                  </div>
                  <div className="t-mut mono" style={{ fontSize: 12, marginTop: 3 }}>{sv.api_url}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                <span className="t-mut row" style={{ gap: 5, fontSize: 12.5 }}><Database size={13} /> Tenant DBs:</span>
                {Object.keys(sv.tenants).length === 0 ? <span className="t-mut" style={{ fontSize: 12.5 }}>{sv.error || 'unavailable'}</span>
                  : Object.entries(sv.tenants).map(([slug, st]) => (
                    <span key={slug} className="badge neutral" style={{ fontSize: 12 }}>
                      <span className="dot" style={{ background: tenantColor(st) }} /> {slug}
                    </span>
                  ))}
              </div>
            </div>
          ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Backup heartbeat (FR-8.1) */}
        <div className="card card-pad">
          <div className="row" style={{ gap: 10 }}>
            <span className="tile-ico" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}><Activity size={17} /></span>
            <div><div className="t-mut" style={{ fontSize: 12.5 }}>Last backup</div>
              <div className="t-strong" style={{ fontSize: 16 }}>{health?.last_backup_at ? timeAgo(health.last_backup_at) : 'not reported'}</div></div>
          </div>
          <p className="t-mut" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>Nightly per-tenant dumps run on the server (01:30). The heartbeat appears once the backup job records it.</p>
        </div>

        {/* Platform controls: maintenance banner + global min app (FR-7.2, FR-8.5) */}
        <div className="card">
          <div className="card-head"><Wrench size={15} /><h3>Platform controls</h3></div>
          <div className="card-pad" style={{ display: 'grid', gap: 13 }}>
            {!s ? <Skeleton h={120} /> : <>
              <label className="row" style={{ gap: 9, cursor: canWrite ? 'pointer' : 'default' }}>
                <input type="checkbox" checked={s.maintenance_active} disabled={!canWrite}
                  onChange={(e) => setS({ ...s, maintenance_active: e.target.checked })} />
                <ShieldAlert size={14} /> <span>Show maintenance banner in all apps</span>
              </label>
              <div className="field"><label>Maintenance message</label>
                <textarea className="input" style={{ minHeight: 64, resize: 'vertical' }} value={s.maintenance_message} disabled={!canWrite}
                  onChange={(e) => setS({ ...s, maintenance_message: e.target.value })} maxLength={500} placeholder="e.g. Scheduled maintenance 10–11 PM. Some features may be unavailable." /></div>
              <div className="field"><label className="row" style={{ gap: 6 }}><Smartphone size={13} /> Global minimum app version</label>
                <input className="input mono" value={s.global_min_app_version} disabled={!canWrite}
                  onChange={(e) => setS({ ...s, global_min_app_version: e.target.value })} placeholder="e.g. 1.2.0" />
                <span className="t-mut" style={{ fontSize: 12 }}>Older clients across every samithi are prompted to upgrade. Per-samithi overrides still apply if stricter.</span>
              </div>
              {canWrite && <Button loading={saving} onClick={saveSettings}>{!saving && <Save size={14} />} Save controls</Button>}
            </>}
          </div>
        </div>
      </div>
    </>
  )
}
