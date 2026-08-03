import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, ScanLine, Trash2, CalendarCheck, Users, CheckCircle2, XCircle, Search, UserMinus, UserPlus, Undo2 } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import { showToast } from '../components/Toast'
import { useT } from '../i18n'

type Mode = 'present' | 'absent'

interface SocietyEvent {
  id: number
  type: 'meeting' | 'funeral' | 'other'
  title: string
  event_date: string
  attendance_mode: Mode
  attendee_count: number
}

// One shape for both lists. marked_at is null for the members the mode
// derives (never individually marked) — that is also what makes a row
// "markable" rather than "removable".
interface AttRow {
  member_id: number
  society_id: string
  full_name: string
  nic?: string | null
  phone: string | null
  marked_at: string | null
}

interface Detail {
  event: SocietyEvent
  present: AttRow[]
  absent: AttRow[]
}

type Feedback = { kind: 'ok' | 'dup' | 'err'; text: string } | null

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  meeting: { bg: 'var(--primary-subtle, rgba(30,100,212,0.12))', color: 'var(--primary)' },
  funeral: { bg: 'rgba(220,38,38,0.12)', color: 'var(--danger)' },
  other: { bg: 'rgba(107,114,128,0.15)', color: 'var(--text-secondary)' }
}

// Attendance register: create an event, then record who attended. Two methods,
// chosen per event: mark the members who came (scan their membership-card QR
// codes), or — for a well-attended meeting — mark only the absentees and let
// everyone else count as present.
export default function Attendance(): React.ReactElement {
  const { t } = useT()
  const scanRef = useRef<HTMLInputElement>(null)

  const [events, setEvents] = useState<SocietyEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [view, setView] = useState<'present' | 'absent'>('present')
  const [search, setSearch] = useState('')

  const [scanValue, setScanValue] = useState('')
  const [marking, setMarking] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [pendingMode, setPendingMode] = useState<Mode | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [formType, setFormType] = useState<'meeting' | 'funeral' | 'other'>('meeting')
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formMode, setFormMode] = useState<Mode>('present')
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SocietyEvent | null>(null)

  // In 'absent' mode the marked members are the absentees, so marking someone
  // lowers the present count instead of raising it.
  const mode: Mode = detail?.event.attendance_mode === 'absent' ? 'absent' : 'present'
  const byAbsence = mode === 'absent'
  const markedCount = detail ? (byAbsence ? detail.absent.length : detail.present.length) : 0

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
      setSearch('')
      loadDetail(selectedId)
    } else {
      setDetail(null)
    }
  }, [selectedId, loadDetail])

  const bumpCount = (delta: number): void =>
    setEvents((prev) => prev.map((ev) =>
      ev.id === selectedId ? { ...ev, attendee_count: Math.max(0, ev.attendee_count + delta) } : ev))

  const handleScan = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const scanned = scanValue.trim()
    if (!scanned || marking || selectedId === null) return
    setMarking(true)
    try {
      const res = await window.api.events.mark(selectedId, scanned)
      const name = res.member.full_name
      if (res.already) {
        setFeedback({ kind: 'dup', text: byAbsence ? t('att.alreadyAbsent', { name }) : t('att.alreadyMarked', { name }) })
      } else {
        setFeedback({ kind: 'ok', text: byAbsence ? t('att.markedAbsent', { name }) : t('att.marked', { name }) })
        loadDetail(selectedId)
        bumpCount(byAbsence ? -1 : 1)
      }
    } catch {
      setFeedback({ kind: 'err', text: t('members.scanNotFound', { id: scanned }) })
    } finally {
      setScanValue('')
      setMarking(false)
      scanRef.current?.focus()
    }
  }

  // Picking a name off the derived list — an absentee is not there to scan
  // their own card, and it saves scanning a latecomer in present mode.
  const handleMarkRow = async (row: AttRow): Promise<void> => {
    if (selectedId === null) return
    try {
      await window.api.events.markById(selectedId, row.member_id)
      loadDetail(selectedId)
      bumpCount(byAbsence ? -1 : 1)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
    }
  }

  const handleUnmark = async (memberId: number): Promise<void> => {
    if (selectedId === null) return
    try {
      await window.api.events.unmark(selectedId, memberId)
      loadDetail(selectedId)
      bumpCount(byAbsence ? 1 : -1)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
    }
  }

  const handleSwitchMode = async (): Promise<void> => {
    if (selectedId === null || !pendingMode) return
    try {
      await window.api.events.setMode(selectedId, pendingMode)
      showToast('success', t('att.modeChanged'))
      setPendingMode(null)
      setFeedback(null)
      await loadDetail(selectedId)
      await loadEvents(selectedId)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
      setPendingMode(null)
    }
  }

  const handleCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!formTitle.trim() || creating) return
    setCreating(true)
    try {
      const res = await window.api.events.create({
        type: formType,
        title: formTitle.trim(),
        event_date: formDate,
        attendance_mode: formMode
      })
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

  const modeLabel = (m: Mode): string => (m === 'absent' ? t('att.modeAbsent') : t('att.modePresent'))

  const rows = detail ? (view === 'present' ? detail.present : detail.absent) : []
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        String(r.society_id ?? '').toLowerCase().includes(q) ||
        String(r.nic ?? '').toLowerCase().includes(q)
    )
  }, [rows, search])

  // The tab holding individually-marked members is editable (remove the mark);
  // the derived tab lets you move a member across.
  const markedView = byAbsence ? view === 'absent' : view === 'present'

  const emptyText = (): string => {
    if (search.trim()) return t('att.noMatches')
    if (view === 'present') return byAbsence ? t('att.allAbsent') : t('att.noneMarked')
    return byAbsence ? t('att.noneAbsentMarked') : t('att.noneAbsent')
  }

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
            <div style={{ minWidth: '190px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>{t('att.mode')}</label>
              <select className="form-control" value={formMode} onChange={(e) => setFormMode(e.target.value as Mode)}>
                <option value="present">{t('att.modePresent')}</option>
                <option value="absent">{t('att.modeAbsent')}</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? t('att.creating') : t('att.create')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
              {t('common.cancel')}
            </button>
          </form>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            {formMode === 'absent' ? t('att.modeAbsentHint') : t('att.modePresentHint')}
          </div>
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
                        <span
                          style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}
                          title={t('att.present')}
                        >
                          <Users size={12} /> {ev.attendee_count}
                        </span>
                        {ev.attendance_mode === 'absent' && (
                          <span className="status-badge" style={{ background: 'rgba(217,119,6,0.12)', color: 'var(--warning, #d97706)', fontSize: '0.68rem' }}>
                            {t('att.modeAbsent')}
                          </span>
                        )}
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
              {/* How this event is being recorded */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t('att.mode')}</span>
                <select
                  className="form-control"
                  style={{ width: 'auto', minWidth: '190px' }}
                  value={mode}
                  onChange={(e) => setPendingMode(e.target.value as Mode)}
                >
                  <option value="present">{t('att.modePresent')}</option>
                  <option value="absent">{t('att.modeAbsent')}</option>
                </select>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {byAbsence ? t('att.modeAbsentHint') : t('att.modePresentHint')}
                </span>
              </div>

              {/* Scan / type a society ID */}
              <form onSubmit={handleScan} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <ScanLine size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: byAbsence ? 'var(--warning, #d97706)' : 'var(--primary)' }} />
                  <input
                    ref={scanRef}
                    type="text"
                    className="form-control"
                    style={{ paddingLeft: '36px', fontFamily: 'monospace', fontWeight: 700 }}
                    placeholder={byAbsence ? t('att.scanPromptAbsent') : t('att.scanPrompt')}
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={marking || !scanValue.trim()}>
                  {byAbsence ? t('att.markAbsent') : t('att.mark')}
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
              <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', margin: '8px 0 0', alignItems: 'center' }}>
                {(['present', 'absent'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setView(tab); setSearch('') }}
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
                <div style={{ position: 'relative', marginLeft: 'auto', paddingBottom: '4px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    className="form-control"
                    style={{ paddingLeft: '30px', width: '240px', height: '32px', fontSize: '0.82rem' }}
                    placeholder={t('att.searchMembers')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="table-container" style={{ maxHeight: '440px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('common.societyId')}</th>
                      <th>{t('members.fullName')}</th>
                      <th>{markedView ? t('att.time') : t('common.phone')}</th>
                      <th className="text-center">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.length === 0 ? (
                      <tr><td colSpan={4} className="empty-state" style={{ padding: '24px' }}>{emptyText()}</td></tr>
                    ) : (
                      visibleRows.map((row) => (
                        <tr key={row.member_id}>
                          <td>
                            <span
                              className={view === 'present' ? 'status-badge badge-primary' : 'status-badge'}
                              style={view === 'present'
                                ? { fontWeight: 700, fontSize: '0.78rem' }
                                : { background: 'rgba(220,38,38,0.1)', color: 'var(--danger)', fontWeight: 700, fontSize: '0.78rem' }}
                            >
                              {row.society_id}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{row.full_name}</td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            {markedView
                              ? row.marked_at
                                ? new Date(row.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '—'
                              : row.phone || '—'}
                          </td>
                          <td className="actions-cell">
                            {markedView ? (
                              <button
                                className="btn-icon"
                                title={byAbsence ? t('att.undoAbsent') : t('att.unmark')}
                                style={{ color: 'var(--danger)' }}
                                onClick={() => handleUnmark(row.member_id)}
                              >
                                {byAbsence ? <Undo2 size={15} /> : <Trash2 size={15} />}
                              </button>
                            ) : (
                              <button
                                className="btn-icon"
                                title={byAbsence ? t('att.markAbsent') : t('att.mark')}
                                style={{ color: byAbsence ? 'var(--danger)' : 'var(--success, #16a34a)' }}
                                onClick={() => handleMarkRow(row)}
                              >
                                {byAbsence ? <UserMinus size={15} /> : <UserPlus size={15} />}
                              </button>
                            )}
                          </td>
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

      {pendingMode && detail && (
        <ConfirmModal
          title={t('att.switchMode')}
          message={markedCount > 0
            ? t('att.switchModeMsg', { title: detail.event.title, mode: modeLabel(pendingMode), count: markedCount })
            : t('att.switchModeEmpty', { title: detail.event.title, mode: modeLabel(pendingMode) })}
          confirmLabel={t('att.switchMode')}
          danger={markedCount > 0}
          onConfirm={handleSwitchMode}
          onClose={() => setPendingMode(null)}
        />
      )}

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
