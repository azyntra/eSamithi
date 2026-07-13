import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, ScanLine, Trash2, CalendarCheck, Users, CheckCircle2, XCircle } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import { showToast } from '../components/Toast'
import { useT } from '../i18n'

interface SocietyEvent {
  id: number
  type: 'meeting' | 'funeral' | 'other'
  title: string
  event_date: string
  attendee_count: number
}

interface PresentRow {
  member_id: number
  marked_at: string
  society_id: string
  full_name: string
  nic: string
}

interface AbsentRow {
  member_id: number
  society_id: string
  full_name: string
  phone: string | null
}

interface Detail {
  event: SocietyEvent
  present: PresentRow[]
  absent: AbsentRow[]
}

type Feedback = { kind: 'ok' | 'dup' | 'err'; text: string } | null

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  meeting: { bg: 'var(--primary-subtle, rgba(30,100,212,0.12))', color: 'var(--primary)' },
  funeral: { bg: 'rgba(220,38,38,0.12)', color: 'var(--danger)' },
  other: { bg: 'rgba(107,114,128,0.15)', color: 'var(--text-secondary)' }
}

// Attendance register: create an event, then scan members' membership-card
// QR codes (keyboard-wedge scanner types the society ID + Enter) to mark
// presence. The absent tab is the fine/levy follow-up list.
export default function Attendance(): React.ReactElement {
  const { t } = useT()
  const scanRef = useRef<HTMLInputElement>(null)

  const [events, setEvents] = useState<SocietyEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [view, setView] = useState<'present' | 'absent'>('present')

  const [scanValue, setScanValue] = useState('')
  const [marking, setMarking] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [formType, setFormType] = useState<'meeting' | 'funeral' | 'other'>('meeting')
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SocietyEvent | null>(null)

  const loadEvents = useCallback(async (selectId?: number): Promise<void> => {
    setLoadingEvents(true)
    try {
      const rows: SocietyEvent[] = await window.api.events.getAll()
      setEvents(rows)
      if (selectId) setSelectedId(selectId)
      else if (rows.length > 0 && selectedId === null) setSelectedId(rows[0].id)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingEvents(false)
    }
  }, [selectedId])

  const loadDetail = useCallback(async (id: number): Promise<void> => {
    setLoadingDetail(true)
    try {
      setDetail(await window.api.events.getAttendance(id))
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => { loadEvents() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedId !== null) {
      setFeedback(null)
      loadDetail(selectedId)
    } else {
      setDetail(null)
    }
  }, [selectedId, loadDetail])

  const handleScan = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const scanned = scanValue.trim()
    if (!scanned || marking || selectedId === null) return
    setMarking(true)
    try {
      const res = await window.api.events.mark(selectedId, scanned)
      if (res.already) {
        setFeedback({ kind: 'dup', text: t('att.alreadyMarked', { name: res.member.full_name }) })
      } else {
        setFeedback({ kind: 'ok', text: t('att.marked', { name: res.member.full_name }) })
        loadDetail(selectedId)
        setEvents((prev) => prev.map((ev) => ev.id === selectedId ? { ...ev, attendee_count: ev.attendee_count + 1 } : ev))
      }
    } catch {
      setFeedback({ kind: 'err', text: t('members.scanNotFound', { id: scanned }) })
    } finally {
      setScanValue('')
      setMarking(false)
      scanRef.current?.focus()
    }
  }

  const handleUnmark = async (memberId: number): Promise<void> => {
    if (selectedId === null) return
    try {
      await window.api.events.unmark(selectedId, memberId)
      loadDetail(selectedId)
      setEvents((prev) => prev.map((ev) => ev.id === selectedId ? { ...ev, attendee_count: Math.max(0, ev.attendee_count - 1) } : ev))
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
    }
  }

  const handleCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!formTitle.trim() || creating) return
    setCreating(true)
    try {
      const res = await window.api.events.create({ type: formType, title: formTitle.trim(), event_date: formDate })
      showToast('success', t('att.created'))
      setShowCreate(false)
      setFormTitle('')
      await loadEvents(res.id)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    try {
      await window.api.events.delete(deleteTarget.id)
      showToast('success', t('att.deleted'))
      if (selectedId === deleteTarget.id) setSelectedId(null)
      setDeleteTarget(null)
      loadEvents()
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
    }
  }

  const typeLabel = (type: string): string =>
    type === 'meeting' ? t('att.typeMeeting') : type === 'funeral' ? t('att.typeFuneral') : t('att.typeOther')

  return (
    <div className="page-container animation-fade-in">
      <div className="page-header gradient-header">
        <div>
          <h1 className="page-title">{t('att.title')}</h1>
          <p className="page-subtitle">{t('att.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary glassmorphic" onClick={() => setShowCreate((v) => !v)}>
            <Plus size={18} />
            {t('att.newEvent')}
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="settings-card shadow-sm" style={{ marginBottom: '16px', padding: '16px' }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '150px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>{t('att.eventType')}</label>
              <select className="form-control" value={formType} onChange={(e) => setFormType(e.target.value as any)}>
                <option value="meeting">{t('att.typeMeeting')}</option>
                <option value="funeral">{t('att.typeFuneral')}</option>
                <option value="other">{t('att.typeOther')}</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>{t('att.eventTitle')}</label>
              <input
                type="text"
                className="form-control"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={t('att.titlePlaceholder')}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>{t('common.date')}</label>
              <input type="date" className="form-control" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? t('att.creating') : t('att.create')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
              {t('common.cancel')}
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        {/* Events list */}
        <div className="settings-card shadow-sm" style={{ width: '300px', flexShrink: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.9rem' }}>
            {t('att.events')}
          </div>
          {loadingEvents ? (
            <div className="spinner-wrapper" style={{ minHeight: '120px' }}><div className="spinner"></div></div>
          ) : events.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 16px' }}>
              <CalendarCheck size={28} style={{ color: 'var(--text-secondary)', marginBottom: '8px' }} />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('att.noEvents')}</div>
            </div>
          ) : (
            <div style={{ maxHeight: '540px', overflowY: 'auto' }}>
              {events.map((ev) => {
                const style = TYPE_STYLE[ev.type] || TYPE_STYLE.other
                const selected = ev.id === selectedId
                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedId(ev.id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: selected ? 'var(--primary-subtle, rgba(30,100,212,0.08))' : 'transparent',
                      borderLeft: selected ? '3px solid var(--primary)' : '3px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.title}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span className="status-badge" style={{ background: style.bg, color: style.color, fontSize: '0.7rem' }}>
                          {typeLabel(ev.type)}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{String(ev.event_date).split('T')[0]}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Users size={12} /> {ev.attendee_count}
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn-icon"
                      title={t('att.deleteEvent')}
                      style={{ color: 'var(--danger)' }}
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(ev) }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Scan panel + lists */}
        <div className="settings-card shadow-sm" style={{ flex: 1, minWidth: 0 }}>
          {selectedId === null || !detail ? (
            <div className="empty-state" style={{ padding: '60px 20px' }}>
              {loadingDetail ? (
                <div className="spinner"></div>
              ) : (
                <>
                  <ScanLine size={32} style={{ color: 'var(--text-secondary)', marginBottom: '8px' }} />
                  <div style={{ fontWeight: 600 }}>{t('att.selectEvent')}</div>
                </>
              )}
            </div>
          ) : (
            <div style={{ padding: '16px' }}>
              {/* Scan input */}
              <form onSubmit={handleScan} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <ScanLine size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
                  <input
                    ref={scanRef}
                    type="text"
                    className="form-control"
                    style={{ paddingLeft: '36px', fontFamily: 'monospace', fontWeight: 700 }}
                    placeholder={t('att.scanPrompt')}
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={marking || !scanValue.trim()}>
                  {t('att.mark')}
                </button>
              </form>
              <div style={{ minHeight: '24px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {feedback && (
                  <>
                    {feedback.kind === 'ok' && <CheckCircle2 size={16} style={{ color: 'var(--success, #16a34a)' }} />}
                    {feedback.kind === 'dup' && <CheckCircle2 size={16} style={{ color: 'var(--warning, #d97706)' }} />}
                    {feedback.kind === 'err' && <XCircle size={16} style={{ color: 'var(--danger)' }} />}
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: feedback.kind === 'ok' ? 'var(--success, #16a34a)' : feedback.kind === 'dup' ? 'var(--warning, #d97706)' : 'var(--danger)'
                    }}>
                      {feedback.text}
                    </span>
                  </>
                )}
              </div>

              {/* Present / Absent tabs */}
              <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', margin: '8px 0 0' }}>
                {(['present', 'absent'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setView(tab)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '10px 14px',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      color: view === tab ? 'var(--primary)' : 'var(--text-secondary)',
                      borderBottom: view === tab ? '2px solid var(--primary)' : '2px solid transparent'
                    }}
                  >
                    {tab === 'present' ? t('att.present') : t('att.absent')} ({tab === 'present' ? detail.present.length : detail.absent.length})
                  </button>
                ))}
              </div>

              <div className="table-container" style={{ maxHeight: '440px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('common.societyId')}</th>
                      <th>{t('members.fullName')}</th>
                      {view === 'present' ? (
                        <>
                          <th>{t('att.time')}</th>
                          <th className="text-center">{t('common.actions')}</th>
                        </>
                      ) : (
                        <th>{t('common.phone')}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {view === 'present' ? (
                      detail.present.length === 0 ? (
                        <tr><td colSpan={4} className="empty-state" style={{ padding: '24px' }}>{t('att.noneMarked')}</td></tr>
                      ) : (
                        detail.present.map((row) => (
                          <tr key={row.member_id}>
                            <td><span className="status-badge badge-primary" style={{ fontWeight: 700, fontSize: '0.78rem' }}>{row.society_id}</span></td>
                            <td style={{ fontWeight: 600 }}>{row.full_name}</td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              {new Date(row.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="actions-cell">
                              <button
                                className="btn-icon"
                                title={t('att.unmark')}
                                style={{ color: 'var(--danger)' }}
                                onClick={() => handleUnmark(row.member_id)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )
                    ) : detail.absent.length === 0 ? (
                      <tr><td colSpan={3} className="empty-state" style={{ padding: '24px' }}>{t('att.noneAbsent')}</td></tr>
                    ) : (
                      detail.absent.map((row) => (
                        <tr key={row.member_id}>
                          <td><span className="status-badge" style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--danger)', fontWeight: 700, fontSize: '0.78rem' }}>{row.society_id}</span></td>
                          <td style={{ fontWeight: 600 }}>{row.full_name}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{row.phone || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          title={t('att.deleteEvent')}
          message={t('att.deleteEventMsg', { title: deleteTarget.title })}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
