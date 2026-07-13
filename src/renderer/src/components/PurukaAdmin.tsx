import React, { useCallback, useEffect, useState } from 'react'
import { Flag, Plus, RotateCcw, Ban } from 'lucide-react'
import ConfirmModal from './ConfirmModal'
import { showToast } from './Toast'
import { formatCurrency } from '../utils/formatters'
import { useT } from '../i18n'

interface PurukaPostRow {
  id: number
  title: string
  price: number | null
  negotiable: number
  location: string | null
  status: string
  report_count: number
  created_at: string
  expires_at: string
  category_label: string
  category_id: number
  seller_name: string
  seller_society_id: string
  seller_phone: string | null
  report_reasons: string | null
}

interface PurukaCategory {
  id: number
  code: string
  label_en: string
  label_si: string
  is_active: number
  sort_order: number
}

const EMPTY_CAT = { code: '', label_en: '', label_si: '' }

// Staff view for the Puruka community exchange: all posts with filters,
// takedown/restore, and category management. Posts expire on a fixed default
// (server-side); no admin-facing retention config.
export default function PurukaAdmin(): React.ReactElement {
  const { t, lang } = useT()

  const [posts, setPosts] = useState<PurukaPostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [reportedOnly, setReportedOnly] = useState(false)
  const [status, setStatus] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [deactivateTarget, setDeactivateTarget] = useState<PurukaPostRow | null>(null)

  const [categories, setCategories] = useState<PurukaCategory[]>([])
  const [showCatForm, setShowCatForm] = useState(false)
  const [catForm, setCatForm] = useState(EMPTY_CAT)
  const [catSaving, setCatSaving] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const params: { status?: string; category?: number; q?: string; reported?: string } = {}
      if (reportedOnly) params.reported = '1'
      if (status) params.status = status
      if (categoryId) params.category = Number(categoryId)
      if (search.trim()) params.q = search.trim()
      setPosts(await window.api.puruka.getAll(params))
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setLoading(false)
    }
  }, [reportedOnly, status, categoryId, search])

  const loadCategories = useCallback(async (): Promise<void> => {
    try {
      setCategories(await window.api.puruka.getCategories())
    } catch (err: any) {
      showToast('error', err.message)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, search])
  useEffect(() => { loadCategories() }, [loadCategories])

  const handleDeactivate = async (): Promise<void> => {
    if (!deactivateTarget) return
    try {
      await window.api.puruka.deactivate(deactivateTarget.id)
      showToast('success', t('msg.pkDeactivated'))
      setDeactivateTarget(null)
      load()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleReactivate = async (id: number): Promise<void> => {
    try {
      await window.api.puruka.reactivate(id)
      showToast('success', t('msg.pkReactivated'))
      load()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleCreateCategory = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setCatSaving(true)
    try {
      await window.api.puruka.createCategory(catForm)
      showToast('success', t('msg.pkCatAdded'))
      setCatForm(EMPTY_CAT)
      setShowCatForm(false)
      loadCategories()
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setCatSaving(false)
    }
  }

  const toggleCategory = async (cat: PurukaCategory): Promise<void> => {
    try {
      await window.api.puruka.updateCategory(cat.id, { is_active: cat.is_active !== 1 })
      loadCategories()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const dateFmt = (d: string | null): string =>
    d ? new Date(d).toLocaleDateString(lang === 'si' ? 'si-LK' : 'en-GB') : '—'

  const statusStyle = (s: string): React.CSSProperties => {
    const map: Record<string, [string, string]> = {
      Active: ['rgba(22,163,74,0.12)', 'var(--success, #16a34a)'],
      Sold: ['rgba(107,114,128,0.15)', 'var(--text-secondary)'],
      Inactive: ['rgba(217,119,6,0.12)', 'var(--warning, #d97706)'],
      Removed: ['rgba(220,38,38,0.12)', 'var(--danger)'],
      Deleted: ['rgba(220,38,38,0.12)', 'var(--danger)']
    }
    const [bg, color] = map[s] ?? map.Sold
    return { background: bg, color, fontWeight: 700, fontSize: '0.72rem' }
  }

  return (
    <>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
        <input
          type="text"
          className="form-control"
          style={{ width: '220px' }}
          placeholder={t('msg.pkSearchPh')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="form-control" style={{ width: '150px' }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('msg.pkAllStatuses')}</option>
          {['Active', 'Sold', 'Inactive', 'Removed', 'Deleted'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-control" style={{ width: '180px' }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">{t('msg.pkAllCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{lang === 'si' ? c.label_si : c.label_en}</option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
          <input type="checkbox" checked={reportedOnly} onChange={(e) => setReportedOnly(e.target.checked)} />
          <Flag size={14} style={{ color: 'var(--danger)' }} /> {t('msg.pkReportedOnly')}
        </label>
      </div>

      {/* Posts table */}
      <div className="settings-card shadow-sm" style={{ marginBottom: '20px' }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('msg.title')}</th>
                <th>{t('msg.pkCategory')}</th>
                <th>{t('msg.pkSeller')}</th>
                <th>{t('common.amount')}</th>
                <th>{t('common.status')}</th>
                <th>{t('msg.pkReports')}</th>
                <th>{t('msg.pkExpires')}</th>
                <th className="text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}><div className="spinner-wrapper"><div className="spinner"></div></div></td></tr>
              ) : posts.length === 0 ? (
                <tr><td colSpan={8} className="empty-state" style={{ padding: '24px' }}>{t('msg.pkNoPosts')}</td></tr>
              ) : (
                posts.map((post) => (
                  <tr key={post.id} style={post.report_count > 0 ? { background: 'rgba(220,38,38,0.04)' } : undefined}>
                    <td style={{ fontWeight: 600, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.title}
                      {post.location && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{post.location}</div>}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{post.category_label}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{post.seller_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{post.seller_society_id}{post.seller_phone ? ` · ${post.seller_phone}` : ''}</div>
                    </td>
                    <td style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      {post.price !== null ? formatCurrency(post.price) : t('msg.pkNegotiable')}
                    </td>
                    <td><span className="status-badge" style={statusStyle(post.status)}>{post.status}</span></td>
                    <td>
                      {post.report_count > 0 ? (
                        <span title={post.report_reasons ?? ''} style={{ color: 'var(--danger)', fontWeight: 700, cursor: 'help' }}>
                          <Flag size={13} style={{ verticalAlign: '-2px', marginRight: '3px' }} />{post.report_count}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{dateFmt(post.expires_at)}</td>
                    <td className="actions-cell">
                      {post.status === 'Removed' ? (
                        <button className="btn-icon" title={t('msg.pkReactivate')} onClick={() => handleReactivate(post.id)} style={{ color: 'var(--success, #16a34a)' }}>
                          <RotateCcw size={15} />
                        </button>
                      ) : post.status !== 'Deleted' ? (
                        <button className="btn-icon" title={t('msg.pkDeactivate')} onClick={() => setDeactivateTarget(post)} style={{ color: 'var(--danger)' }}>
                          <Ban size={15} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="settings-card shadow-sm" style={{ flex: 1, minWidth: '340px' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('msg.pkCategories')}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowCatForm(!showCatForm)}>
              <Plus size={14} /> {t('msg.pkAddCategory')}
            </button>
          </div>
          {showCatForm && (
            <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <input className="form-control" style={{ width: '110px' }} placeholder="code" value={catForm.code}
                onChange={(e) => setCatForm({ ...catForm, code: e.target.value.toLowerCase() })} required />
              <input className="form-control" style={{ flex: 1, minWidth: '120px' }} placeholder="English label" value={catForm.label_en}
                onChange={(e) => setCatForm({ ...catForm, label_en: e.target.value })} required />
              <input className="form-control" style={{ flex: 1, minWidth: '120px' }} placeholder="සිංහල ලේබලය" value={catForm.label_si}
                onChange={(e) => setCatForm({ ...catForm, label_si: e.target.value })} required />
              <button type="submit" className="btn btn-primary btn-sm" disabled={catSaving}>{t('common.save')}</button>
            </form>
          )}
          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {categories.map((cat) => (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', borderBottom: '1px solid var(--border)' }}>
                <code style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', width: '86px' }}>{cat.code}</code>
                <span style={{ flex: 1, fontSize: '0.86rem', fontWeight: 600, opacity: cat.is_active ? 1 : 0.45 }}>
                  {cat.label_en} · {cat.label_si}
                </span>
                <button
                  className={`btn btn-sm ${cat.is_active ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => toggleCategory(cat)}
                >
                  {cat.is_active ? t('msg.pkDisable') : t('msg.pkEnable')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {deactivateTarget && (
        <ConfirmModal
          title={t('msg.pkDeactivate')}
          message={t('msg.pkDeactivateMsg', { title: deactivateTarget.title })}
          confirmLabel={t('msg.pkDeactivate')}
          danger
          onConfirm={handleDeactivate}
          onClose={() => setDeactivateTarget(null)}
        />
      )}
    </>
  )
}
