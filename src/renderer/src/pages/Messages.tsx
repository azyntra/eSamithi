import React, { useCallback, useEffect, useState } from 'react'
import { Megaphone, CalendarDays, Flower2, Plus, Trash2, Eye, EyeOff, Inbox, FileText, Store } from 'lucide-react'
import PurukaAdmin from '../components/PurukaAdmin'
import ConfirmModal from '../components/ConfirmModal'
import { showToast } from '../components/Toast'
import { formatCurrency } from '../utils/formatters'
import { useT } from '../i18n'

interface Announcement {
  id: number
  type: 'death' | 'meeting' | 'general'
  title: string
  body: string | null
  deceased_name: string | null
  deceased_member_id: number | null
  deceased_member_name?: string | null
  funeral_date: string | null
  funeral_location: string | null
  event_date: string | null
  is_active: number
  created_at: string
}

interface MemberRequest {
  id: number
  member_id: number
  member_name: string
  member_society_id: string
  member_phone: string
  type: 'loan' | 'correction'
  amount: number | null
  purpose: string | null
  message: string | null
  status: string
  staff_note: string | null
  created_at: string
}

interface SlimMember { id: number; nic: string; full_name: string }

const EMPTY_FORM = {
  type: 'general' as Announcement['type'],
  title: '',
  body: '',
  deceased_name: '',
  deceased_member_id: '' as string,
  funeral_date: '',
  funeral_location: '',
  event_date: ''
}

export default function Messages(): React.ReactElement {
  const { t, lang } = useT()
  const [tab, setTab] = useState<'announcements' | 'requests' | 'puruka'>('announcements')

  // ── Announcements state ──
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState<SlimMember[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)

  // ── Requests state ──
  const [requests, setRequests] = useState<MemberRequest[]>([])
  const [reqLoading, setReqLoading] = useState(false)
  const [reqFilter, setReqFilter] = useState<'Pending' | ''>('Pending')
  const [reviewTarget, setReviewTarget] = useState<{ req: MemberRequest; status: 'Approved' | 'Rejected' } | null>(null)
  const [staffNote, setStaffNote] = useState('')

  const loadAnnouncements = useCallback(async (): Promise<void> => {
    try {
      setItems(await window.api.announcements.getAll())
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRequests = useCallback(async (): Promise<void> => {
    setReqLoading(true)
    try {
      setRequests(await window.api.memberRequests.getAll(reqFilter || undefined))
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setReqLoading(false)
    }
  }, [reqFilter])

  useEffect(() => { loadAnnouncements() }, [loadAnnouncements])
  useEffect(() => { if (tab === 'requests') loadRequests() }, [tab, loadRequests])
  useEffect(() => {
    // Member picker list, loaded once the death-notice form needs it
    if (showForm && form.type === 'death' && members.length === 0) {
      window.api.members.getAllSlim().then(setMembers).catch(() => {})
    }
  }, [showForm, form.type, members.length])

  const publish = async (): Promise<void> => {
    setSaving(true)
    try {
      await window.api.announcements.create({
        type: form.type,
        title: form.title,
        body: form.body || null,
        deceased_name: form.type === 'death' ? form.deceased_name : null,
        deceased_member_id: form.type === 'death' && form.deceased_member_id ? parseInt(form.deceased_member_id) : null,
        funeral_date: form.type === 'death' && form.funeral_date ? form.funeral_date : null,
        funeral_location: form.type === 'death' && form.funeral_location ? form.funeral_location : null,
        event_date: form.type === 'meeting' && form.event_date ? form.event_date : null
      })
      showToast('success', t('msg.publish') + ' ✓')
      setForm(EMPTY_FORM)
      setShowForm(false)
      loadAnnouncements()
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (a: Announcement): Promise<void> => {
    try {
      await window.api.announcements.toggle(a.id)
      loadAnnouncements()
    } catch (err: any) { showToast('error', err.message) }
  }

  const remove = async (a: Announcement): Promise<void> => {
    try {
      await window.api.announcements.delete(a.id)
      showToast('success', t('common.delete') + ' ✓')
      loadAnnouncements()
    } catch (err: any) { showToast('error', err.message) }
  }

  const review = async (): Promise<void> => {
    if (!reviewTarget) return
    try {
      await window.api.memberRequests.review(reviewTarget.req.id, {
        status: reviewTarget.status,
        staff_note: staffNote.trim() || undefined
      })
      showToast('success', reviewTarget.status === 'Approved' ? t('msg.approve') + ' ✓' : t('msg.reject') + ' ✓')
      setStaffNote('')
      loadRequests()
    } catch (err: any) { showToast('error', err.message) }
  }

  const typeMeta = (type: Announcement['type']): { icon: React.ReactNode; label: string; color: string } => {
    if (type === 'death') return { icon: <Flower2 size={15} />, label: t('msg.typeDeath'), color: 'var(--danger)' }
    if (type === 'meeting') return { icon: <CalendarDays size={15} />, label: t('msg.typeMeeting'), color: 'var(--primary)' }
    return { icon: <Megaphone size={15} />, label: t('msg.typeGeneral'), color: 'var(--success)' }
  }

  const statusLabel = (s: string): string =>
    s === 'Pending' ? t('msg.stPending') : s === 'Approved' ? t('msg.stApproved') : s === 'Rejected' ? t('msg.stRejected') : t('msg.stDone')

  const dateFmt = (d: string | null): string => (d ? new Date(d).toLocaleDateString(lang === 'si' ? 'si-LK' : 'en-GB') : '—')

  const inputStyle: React.CSSProperties = { width: '100%' }

  return (
    <div className="page-container animation-fade-in">
      <div className="page-header gradient-header">
        <div>
          <h1 className="page-title">{t('nav.messages')}</h1>
          <p className="page-subtitle">{t('msg.subtitle')}</p>
        </div>
        {tab === 'announcements' && (
          <button className="btn btn-primary glassmorphic" onClick={() => setShowForm(!showForm)}>
            <Plus size={16} /> {t('msg.newAnnouncement')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', margin: '16px 0' }}>
        {(['announcements', 'requests', 'puruka'] as const).map((tb) => {
          const icon = tb === 'announcements' ? <Megaphone size={15} style={{ verticalAlign: '-2px', marginRight: '6px' }} />
            : tb === 'requests' ? <Inbox size={15} style={{ verticalAlign: '-2px', marginRight: '6px' }} />
            : <Store size={15} style={{ verticalAlign: '-2px', marginRight: '6px' }} />
          const label = tb === 'announcements' ? t('msg.tabAnnouncements') : tb === 'requests' ? t('msg.tabRequests') : t('msg.tabPuruka')
          return (
            <button
              key={tb}
              type="button"
              onClick={() => setTab(tb)}
              style={{
                padding: '8px 16px', fontSize: '0.88rem', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer',
                color: tab === tb ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: tab === tb ? '2px solid var(--primary)' : '2px solid transparent'
              }}
            >
              {icon}
              {label}
            </button>
          )
        })}
      </div>

      {tab === 'announcements' && (
        <>
          {showForm && (
            <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div className="form-group">
                  <label>{t('common.type')}</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Announcement['type'] })} style={inputStyle}>
                    <option value="general">{t('msg.typeGeneral')}</option>
                    <option value="death">{t('msg.typeDeath')}</option>
                    <option value="meeting">{t('msg.typeMeeting')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('msg.title')} *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
                </div>

                {form.type === 'death' && (
                  <>
                    <div className="form-group">
                      <label>{t('msg.deceasedName')} *</label>
                      <input value={form.deceased_name} onChange={(e) => setForm({ ...form, deceased_name: e.target.value })} style={inputStyle} />
                    </div>
                    <div className="form-group">
                      <label>{t('msg.deceasedMember')}</label>
                      <select value={form.deceased_member_id} onChange={(e) => setForm({ ...form, deceased_member_id: e.target.value })} style={inputStyle}>
                        <option value="">—</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>{m.full_name} ({m.nic})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{t('msg.funeralDate')}</label>
                      <input type="date" value={form.funeral_date} onChange={(e) => setForm({ ...form, funeral_date: e.target.value })} style={inputStyle} />
                    </div>
                    <div className="form-group">
                      <label>{t('msg.funeralLocation')}</label>
                      <input value={form.funeral_location} onChange={(e) => setForm({ ...form, funeral_location: e.target.value })} style={inputStyle} />
                    </div>
                  </>
                )}

                {form.type === 'meeting' && (
                  <div className="form-group">
                    <label>{t('msg.eventDate')} *</label>
                    <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} style={inputStyle} />
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginTop: '10px' }}>
                <label>{t('msg.body')}</label>
                <textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} style={inputStyle} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('msg.pushHint')}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>{t('common.cancel')}</button>
                  <button className="btn btn-primary" disabled={saving || !form.title.trim()} onClick={publish}>
                    {t('msg.publish')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="spinner-wrapper" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
          ) : items.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('msg.noAnnouncements')}</div>
          ) : (
            items.map((a) => {
              const meta = typeMeta(a.type)
              return (
                <div key={a.id} className="card" style={{ padding: '16px 20px', marginBottom: '10px', opacity: a.is_active ? 1 : 0.55 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: meta.color, fontWeight: 700, fontSize: '0.78rem' }}>
                          {meta.icon} {meta.label}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dateFmt(a.created_at)}</span>
                        {!a.is_active && <span className="status-badge badge-danger">{t('msg.hidden')}</span>}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>{a.title}</div>
                      {a.type === 'death' && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {a.deceased_name}
                          {a.funeral_date ? ` · ${t('msg.funeralDate')}: ${dateFmt(a.funeral_date)}` : ''}
                          {a.funeral_location ? ` · ${a.funeral_location}` : ''}
                        </div>
                      )}
                      {a.type === 'meeting' && a.event_date && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t('msg.eventDate')}: {dateFmt(a.event_date)}</div>
                      )}
                      {a.body && <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{a.body}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px' }} title={a.is_active ? t('msg.hide') : t('msg.show')} onClick={() => toggle(a)}>
                        {a.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button className="btn btn-danger" style={{ padding: '6px 10px' }} title={t('common.delete')} onClick={() => setDeleteTarget(a)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </>
      )}

      {tab === 'requests' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <button className={`btn ${reqFilter === 'Pending' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReqFilter('Pending')}>
              {t('msg.requestsPending')}
            </button>
            <button className={`btn ${reqFilter === '' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReqFilter('')}>
              {t('msg.requestsAll')}
            </button>
          </div>

          {reqLoading ? (
            <div className="spinner-wrapper" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
          ) : requests.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('msg.noRequests')}</div>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="card" style={{ padding: '16px 20px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <FileText size={14} color="var(--primary)" />
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{r.type === 'loan' ? t('msg.reqLoan') : t('msg.reqCorrection')}</span>
                      <span className={`status-badge ${r.status === 'Pending' ? 'badge-primary' : r.status === 'Approved' ? 'badge-success' : 'badge-danger'}`}>
                        {statusLabel(r.status)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dateFmt(r.created_at)}</span>
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                      {r.member_name} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>· {r.member_society_id} · {r.member_phone}</span>
                    </div>
                    {r.type === 'loan' && (
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {t('common.amount')}: <strong style={{ color: 'var(--text-primary)' }}>{r.amount != null ? formatCurrency(r.amount) : '—'}</strong>
                        {r.purpose ? ` · ${t('msg.purpose')}: ${r.purpose}` : ''}
                      </div>
                    )}
                    {r.message && <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{r.message}</div>}
                    {r.staff_note && <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '4px' }}>{t('msg.staffNote')}: {r.staff_note}</div>}
                  </div>
                  {r.status === 'Pending' && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-primary" onClick={() => { setStaffNote(''); setReviewTarget({ req: r, status: 'Approved' }) }}>{t('msg.approve')}</button>
                      <button className="btn btn-danger" onClick={() => { setStaffNote(''); setReviewTarget({ req: r, status: 'Rejected' }) }}>{t('msg.reject')}</button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {deleteTarget && (
        <ConfirmModal
          title={t('common.delete')}
          message={t('msg.deleteConfirm')}
          danger
          onConfirm={() => remove(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {reviewTarget && (
        <ConfirmModal
          title={reviewTarget.status === 'Approved' ? t('msg.approve') : t('msg.reject')}
          confirmLabel={reviewTarget.status === 'Approved' ? t('msg.approve') : t('msg.reject')}
          danger={reviewTarget.status === 'Rejected'}
          message={
            <div>
              <div style={{ marginBottom: '10px' }}>
                {reviewTarget.req.type === 'loan' ? t('msg.reqLoan') : t('msg.reqCorrection')} — {reviewTarget.req.member_name}
                {reviewTarget.req.type === 'loan' && reviewTarget.req.amount != null && (
                  <strong> · {formatCurrency(reviewTarget.req.amount)}</strong>
                )}
              </div>
              {reviewTarget.status === 'Approved' && reviewTarget.req.type === 'loan' && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>{t('msg.approveLoanHint')}</div>
              )}
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>{t('msg.staffNote')}</label>
              <textarea rows={2} value={staffNote} onChange={(e) => setStaffNote(e.target.value)} style={{ width: '100%' }} />
            </div>
          }
          onConfirm={review}
          onClose={() => setReviewTarget(null)}
        />
      )}
      {tab === 'puruka' && <PurukaAdmin />}

    </div>
  )
}
