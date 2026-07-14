import React, { useCallback, useEffect, useState } from 'react'
import { Megaphone, Send, Bell, CheckCircle2, XCircle } from 'lucide-react'
import { api, timeAgo } from '../api'
import { useAuth } from '../auth'
import { Button, Skeleton, EmptyState, useToast, useConfirm } from '../components/ui'

interface Samithi { slug: string; name_en: string; status: string }
interface Result { slug: string; ok: boolean; pushed?: number; error?: string }
interface Broadcast {
  id: number; title: string; body: string | null; push: number
  targets: string[] | string; results: Result[]; created_at: string; sent_by: string | null
}

export default function Broadcasts(): React.ReactElement {
  const { admin } = useAuth()
  const toast = useToast()
  const { confirm, node } = useConfirm()
  const canWrite = admin?.role === 'superadmin'
  const [samithis, setSamithis] = useState<Samithi[]>([])
  const [history, setHistory] = useState<Broadcast[] | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [push, setPush] = useState(true)
  const [scope, setScope] = useState<'all' | 'some'>('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  const loadHistory = useCallback(async () => setHistory(await api<Broadcast[]>('/broadcasts')), [])
  useEffect(() => {
    api<Samithi[]>('/samithis').then((r) => setSamithis(r.filter((s) => s.status === 'active'))).catch(() => {})
    loadHistory().catch((e) => toast('error', (e as Error).message))
  }, [loadHistory, toast])

  const toggle = (slug: string): void => setPicked((p) => { const n = new Set(p); n.has(slug) ? n.delete(slug) : n.add(slug); return n })

  const send = async (): Promise<void> => {
    if (!title.trim()) return
    const targetSlugs = scope === 'all' ? samithis.map((s) => s.slug) : [...picked]
    if (targetSlugs.length === 0) { toast('error', 'Select at least one samithi'); return }
    const ok = await confirm({
      title: 'Send broadcast?', confirmLabel: 'Send now',
      message: <>This posts an announcement{push ? ' and sends a push notification' : ''} to <b>{scope === 'all' ? `all ${targetSlugs.length} active samithis` : `${targetSlugs.length} selected samithi(s)`}</b>. It appears in each society's app immediately.</>
    })
    if (!ok) return
    setSending(true)
    try {
      const r = await api<{ delivered: number; failed: number }>('/broadcasts', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), body: body.trim() || null, push, target: scope === 'all' ? 'all' : targetSlugs })
      })
      toast(r.failed ? 'info' : 'success', `Delivered to ${r.delivered} samithi(s)${r.failed ? `, ${r.failed} failed` : ''}`)
      setTitle(''); setBody(''); setPicked(new Set()); setScope('all')
      await loadHistory()
    } catch (e) { toast('error', (e as Error).message) }
    finally { setSending(false) }
  }

  return (
    <>
      {node}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><Megaphone size={16} /><h3>Compose broadcast</h3></div>
          <div className="card-pad" style={{ display: 'grid', gap: 13 }}>
            {!canWrite && <div className="badge warn">Auditor accounts cannot send broadcasts</div>}
            <div className="field"><label>Title</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Scheduled maintenance tonight" disabled={!canWrite} /></div>
            <div className="field"><label>Message <span className="t-mut">— optional</span></label>
              <textarea className="input" style={{ minHeight: 90, resize: 'vertical' }} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Details shown in the announcement…" disabled={!canWrite} /></div>
            <label className="row" style={{ gap: 9, cursor: 'pointer' }}>
              <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} disabled={!canWrite} />
              <Bell size={14} /> <span>Also send a push notification to members' phones</span>
            </label>
            <div className="field"><label>Send to</label>
              <div className="row" style={{ gap: 8 }}>
                <label className="row" style={{ gap: 6, cursor: 'pointer' }}><input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} disabled={!canWrite} /> All active ({samithis.length})</label>
                <label className="row" style={{ gap: 6, cursor: 'pointer' }}><input type="radio" checked={scope === 'some'} onChange={() => setScope('some')} disabled={!canWrite} /> Selected</label>
              </div>
            </div>
            {scope === 'some' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                {samithis.map((s) => (
                  <button key={s.slug} type="button" onClick={() => toggle(s.slug)}
                    className={`badge ${picked.has(s.slug) ? 'active' : 'neutral'}`} style={{ cursor: 'pointer', border: 'none' }}>
                    {picked.has(s.slug) && <CheckCircle2 size={11} />} {s.name_en}
                  </button>
                ))}
              </div>
            )}
            <Button loading={sending} onClick={send} disabled={!canWrite || !title.trim()}>{!sending && <Send size={14} />} Send broadcast</Button>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3 style={{ flex: 1 }}>Recent broadcasts</h3><span className="sub">{history ? history.length : ''}</span></div>
          {!history ? <div className="card-pad"><Skeleton h={60} /></div>
            : history.length === 0 ? <EmptyState title="No broadcasts yet" hint="Sent broadcasts and their delivery results appear here." />
              : (
                <div style={{ maxHeight: 560, overflowY: 'auto' }}>
                  {history.map((b) => {
                    const results = Array.isArray(b.results) ? b.results : []
                    const ok = results.filter((r) => r.ok).length
                    const failed = results.length - ok
                    return (
                      <div key={b.id} style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
                        <div className="row" style={{ gap: 8 }}>
                          <span className="t-strong" style={{ flex: 1 }}>{b.title}</span>
                          {b.push ? <span className="badge neutral"><Bell size={10} /> push</span> : null}
                          <span className="t-mut" style={{ fontSize: 12 }}>{timeAgo(b.created_at)}</span>
                        </div>
                        {b.body && <div className="t-mut" style={{ fontSize: 13, marginTop: 3 }}>{b.body}</div>}
                        <div className="row" style={{ gap: 10, marginTop: 6, fontSize: 12.5 }}>
                          <span className="row" style={{ gap: 4, color: 'var(--success)' }}><CheckCircle2 size={12} /> {ok} delivered</span>
                          {failed > 0 && <span className="row" style={{ gap: 4, color: 'var(--danger)' }}><XCircle size={12} /> {failed} failed</span>}
                          <span className="t-mut">{Array.isArray(b.targets) ? `${b.targets.length} targeted` : 'all samithis'}{b.sent_by ? ` · ${b.sent_by}` : ''}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
        </div>
      </div>
    </>
  )
}
