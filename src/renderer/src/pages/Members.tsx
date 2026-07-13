import React, { useState } from 'react'
import { Plus, Search, Eye, Pencil, Trash2, Users, ScanLine } from 'lucide-react'
import { useMembers } from '../hooks/useMembers'
import AddMemberModal from '../modals/AddMemberModal'
import ScanCardModal from '../modals/ScanCardModal'
import ViewMemberModal from '../modals/ViewMemberModal'
import EditMemberModal from '../modals/EditMemberModal'
import DeleteConfirmModal from '../modals/DeleteConfirmModal'
import { useT } from '../i18n'
import type { Member } from '../types'

const LIMIT = 15

export default function Members(): React.ReactElement {
  const { t } = useT()
  const { state, setPage, setSearch, refresh, getMember, createMember, updateMember, deleteMember, checkUnique } =
    useMembers()

  const [showAddModal, setShowAddModal] = useState(false)
  const [showScanModal, setShowScanModal] = useState(false)
  const [viewMemberId, setViewMemberId] = useState<number | null>(null)
  const [editMemberId, setEditMemberId] = useState<number | null>(null)
  const [deleteMemberTarget, setDeleteMemberTarget] = useState<Member | null>(null)

  const totalPages = Math.ceil(state.total / LIMIT)
  const startIndex = (state.page - 1) * LIMIT + 1
  const endIndex = Math.min(state.page * LIMIT, state.total)

  return (
    <div className="page-container animation-fade-in">
      <div className="page-header gradient-header">
        <div>
          <h1 className="page-title">{t('members.title')}</h1>
          <p className="page-subtitle">{t('members.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button
            id="btn-scan-card"
            className="btn btn-secondary glassmorphic"
            onClick={() => setShowScanModal(true)}
          >
            <ScanLine size={18} />
            {t('members.scanCard')}
          </button>
          <button
            id="btn-add-member"
            className="btn btn-primary glassmorphic"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={18} />
            {t('members.add')}
          </button>
        </div>
      </div>

      <div className="settings-card shadow-sm">
        <div className="settings-list-header">
          <div className="search-container" style={{ position: 'relative', width: '360px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              id="search-members"
              type="text"
              placeholder={t('members.searchPlaceholder')}
              className="form-control"
              style={{ paddingLeft: '36px' }}
              value={state.search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t('members.totalMembers')}</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)' }}>{state.total}</div>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.societyId')}</th>
                <th>{t('members.fullName')}</th>
                <th>{t('members.nic')}</th>
                <th>{t('members.address')}</th>
                <th>{t('members.occupation')}</th>
                <th className="text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {state.loading ? (
                <tr>
                  <td colSpan={6}>
                    <div className="spinner-wrapper">
                      <div className="spinner"></div>
                    </div>
                  </td>
                </tr>
              ) : state.members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    <Users size={32} style={{ color: 'var(--text-secondary)', marginBottom: '8px' }} />
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{t('members.noneFound')}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {state.search ? t('members.tryAdjusting') : t('members.clickAddFirst')}
                    </div>
                  </td>
                </tr>
              ) : (
                state.members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <span className="status-badge badge-primary" style={{ fontWeight: 700, fontSize: '0.78rem' }}>{member.society_id}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{member.full_name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{member.nic}</td>
                    <td style={{ color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.address || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{member.occupation || '—'}</td>
                    <td className="actions-cell">
                      <button
                        className="btn-icon"
                        title={t('members.viewDetails')}
                        onClick={() => setViewMemberId(member.id)}
                        aria-label={`View ${member.full_name}`}
                        style={{ color: 'var(--primary)' }}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="btn-icon"
                        title={t('members.edit')}
                        onClick={() => setEditMemberId(member.id)}
                        aria-label={`Edit ${member.full_name}`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="btn-icon"
                        title={t('members.delete')}
                        onClick={() => setDeleteMemberTarget(member)}
                        aria-label={`Delete ${member.full_name}`}
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {state.total > 0 && (
          <div className="table-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {t('members.showing', { start: startIndex, end: endIndex, total: state.total })}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={state.page <= 1}
                onClick={() => setPage(state.page - 1)}
              >
                {t('common.previous')}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={state.page >= totalPages}
                onClick={() => setPage(state.page + 1)}
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showScanModal && (
        <ScanCardModal
          onClose={() => setShowScanModal(false)}
          onFound={(id) => setViewMemberId(id)}
        />
      )}

      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onCreated={refresh}
          createMember={createMember}
          checkUnique={checkUnique}
        />
      )}

      {viewMemberId !== null && (
        <ViewMemberModal
          memberId={viewMemberId}
          onClose={() => setViewMemberId(null)}
          getMember={getMember}
        />
      )}

      {editMemberId !== null && (
        <EditMemberModal
          memberId={editMemberId}
          onClose={() => setEditMemberId(null)}
          onUpdated={refresh}
          getMember={getMember}
          updateMember={updateMember}
          checkUnique={checkUnique}
        />
      )}

      {deleteMemberTarget !== null && (
        <DeleteConfirmModal
          member={deleteMemberTarget}
          onClose={() => setDeleteMemberTarget(null)}
          onDeleted={refresh}
          deleteMember={deleteMember}
        />
      )}
    </div>
  )
}
