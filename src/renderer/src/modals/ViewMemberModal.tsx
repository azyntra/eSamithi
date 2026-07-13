import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, User, IdCard, MapPin, Phone, Calendar, Briefcase, Heart, Users, Hash, Landmark, UserRound, FileText, ShieldCheck, Smartphone, HandCoins } from 'lucide-react'
import ModalOverlay from '../components/ModalOverlay'
import ConfirmModal from '../components/ConfirmModal'
import { formatCurrency } from '../utils/formatters'
import { useT } from '../i18n'
import type { MemberWithDependents } from '../types'

interface StatementData {
  income: Array<{ id: number; date: string; amount: number; status: string; payment_method: string; loan_id: number | null; type_name: string; type_code: string | null }>
  expenses: Array<{ id: number; date: string; amount: number; status: string; payment_method: string; type_name: string; type_code: string | null }>
  loans: Array<{ id: number; principal_amount: number; principal_owed: number; interest_owed: number; fines_owed: number; date_issued: string; status: string; is_migrated: number }>
  guarantees: Array<{ id: number; date_issued: string; status: string; borrower_name: string }>
}

interface ViewMemberModalProps {
  memberId: number
  onClose: () => void
  getMember: (id: number) => Promise<MemberWithDependents>
}

export default function ViewMemberModal({
  memberId,
  onClose,
  getMember
}: ViewMemberModalProps): React.ReactElement {
  const { t } = useT()
  const navigate = useNavigate()
  const [member, setMember] = useState<MemberWithDependents | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'profile' | 'statement'>('profile')
  const [statement, setStatement] = useState<StatementData | null>(null)
  const [statementLoading, setStatementLoading] = useState(false)
  // Member mobile app access controls (admin)
  const [appConfirm, setAppConfirm] = useState<'disable' | 'reset' | null>(null)
  const [appBusy, setAppBusy] = useState(false)

  const applyAppAccess = async (data: { app_enabled?: number; reset_pin?: boolean }): Promise<void> => {
    setAppBusy(true)
    try {
      await window.api.members.setAppAccess(memberId, data)
      setMember(await getMember(memberId))
    } catch (error) {
      console.error('Failed to update app access:', error)
    } finally {
      setAppBusy(false)
    }
  }

  // Lazy-load the financial statement when the tab is first opened
  useEffect(() => {
    if (activeTab !== 'statement' || statement) return
    setStatementLoading(true)
    window.api.members.getStatement(memberId)
      .then(setStatement)
      .catch((err: any) => console.error('Failed to load statement:', err))
      .finally(() => setStatementLoading(false))
  }, [activeTab, statement, memberId])

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const data = await getMember(memberId)
        setMember(data)
      } catch (error) {
        console.error('Failed to load member:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [memberId, getMember])

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal" role="dialog" aria-label={t('vmember.title')} aria-modal="true" style={{ maxWidth: '700px' }}>
        
        {/* Customized Header without the default gradient so we can build a profile header */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 16px 0', background: 'var(--bg-card)' }}>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')} style={{ background: 'var(--bg-hover)', borderRadius: '50%', padding: '6px' }}>
            <X size={20} color="var(--text-secondary)" />
          </button>
        </div>

        <div className="modal-body" style={{ paddingTop: '0' }}>
          {loading ? (
            <div className="spinner-wrapper" style={{ minHeight: '300px' }}>
              <div className="spinner"></div>
            </div>
          ) : member ? (
            <div className="profile-container animation-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Profile Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ 
                  width: '80px', height: '80px', borderRadius: '50%', 
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '2rem', fontWeight: 700,
                  boxShadow: '0 8px 16px rgba(30, 100, 212, 0.2)'
                }}>
                  {(member.full_name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.01em' }}>
                    {member.full_name || '—'}
                  </h2>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {member.nic && (
                      <span className="badge-white-soft" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)', border: 'none', padding: '4px 10px', fontSize: '0.8rem' }}>
                        <IdCard size={14} style={{ marginRight: '4px' }} /> {member.nic}
                      </span>
                    )}
                    {member.society_id && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <Hash size={14} /> {t('common.societyId')}: {member.society_id}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginLeft: 'auto', flexShrink: 0 }}
                  onClick={() => {
                    onClose()
                    navigate('/incomes', { state: { addForMember: member.id } })
                  }}
                >
                  <HandCoins size={16} />
                  {t('vmember.recordPayment')}
                </button>
              </div>

              {/* Tab Switcher */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setActiveTab('profile')}
                  style={{
                    padding: '8px 16px', fontSize: '0.88rem', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer',
                    color: activeTab === 'profile' ? 'var(--primary)' : 'var(--text-secondary)',
                    borderBottom: activeTab === 'profile' ? '2px solid var(--primary)' : '2px solid transparent'
                  }}
                >
                  <User size={15} style={{ verticalAlign: '-2px', marginRight: '6px' }} />{t('vmember.profile')}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setActiveTab('statement')}
                  style={{
                    padding: '8px 16px', fontSize: '0.88rem', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer',
                    color: activeTab === 'statement' ? 'var(--primary)' : 'var(--text-secondary)',
                    borderBottom: activeTab === 'statement' ? '2px solid var(--primary)' : '2px solid transparent'
                  }}
                >
                  <FileText size={15} style={{ verticalAlign: '-2px', marginRight: '6px' }} />{t('vmember.financialStatement')}
                </button>
              </div>

              {activeTab === 'statement' && (
                statementLoading || !statement ? (
                  <div className="spinner-wrapper" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Loans */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px' }}>{t('vmember.loans', { count: statement.loans.length })}</h4>
                      {statement.loans.length === 0 ? (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('vmember.noLoans')}</div>
                      ) : (
                        statement.loans.map(l => (
                          <div key={l.id} style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                                {formatCurrency(l.principal_amount)} {t('vmember.loanSuffix')}
                                <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> · {l.date_issued ? new Date(l.date_issued).toLocaleDateString('en-GB') : '—'}</span>
                              </div>
                              {(l.status === 'Active' || l.status === 'Overdue') && (
                                <div style={{ fontSize: '0.76rem', color: 'var(--danger)', fontWeight: 600 }}>
                                  {t('vmember.outstanding')}: {formatCurrency(l.principal_owed + l.interest_owed + l.fines_owed)}
                                </div>
                              )}
                            </div>
                            <span className={`status-badge ${l.status === 'Paid' ? 'badge-success' : l.status === 'Active' ? 'badge-primary' : 'badge-danger'}`}>{l.status}</span>
                          </div>
                        ))
                      )}
                      {statement.guarantees.length > 0 && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldCheck size={14} color="var(--primary)" />
                          {t('vmember.guaranteeing', { count: statement.guarantees.length })}{' '}
                          {statement.guarantees.map(g => g.borrower_name).join(', ')}
                        </div>
                      )}
                    </div>

                    {/* Payments made (income) */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px' }}>{t('vmember.paymentsMade', { count: statement.income.length })}</h4>
                      {statement.income.length === 0 ? (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('vmember.noPayments')}</div>
                      ) : (
                        <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                          <table className="data-table">
                            <thead>
                              <tr><th>{t('common.date')}</th><th>{t('common.type')}</th><th className="text-right">{t('common.amount')}</th><th className="text-center">{t('common.status')}</th></tr>
                            </thead>
                            <tbody>
                              {statement.income.map(r => (
                                <tr key={r.id} style={r.status === 'Void' ? { opacity: 0.45, textDecoration: 'line-through' } : {}}>
                                  <td>{new Date(r.date).toLocaleDateString()}</td>
                                  <td>{r.type_name}</td>
                                  <td className="text-right" style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(r.amount)}</td>
                                  <td className="text-center"><span className={`status-badge ${r.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{r.status}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Benefits received (expenses) */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px' }}>{t('vmember.benefitsReceived', { count: statement.expenses.length })}</h4>
                      {statement.expenses.length === 0 ? (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('vmember.noBenefits')}</div>
                      ) : (
                        <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                          <table className="data-table">
                            <thead>
                              <tr><th>{t('common.date')}</th><th>{t('common.type')}</th><th className="text-right">{t('common.amount')}</th><th className="text-center">{t('common.status')}</th></tr>
                            </thead>
                            <tbody>
                              {statement.expenses.map(r => (
                                <tr key={r.id} style={r.status === 'Void' ? { opacity: 0.45, textDecoration: 'line-through' } : {}}>
                                  <td>{new Date(r.date).toLocaleDateString()}</td>
                                  <td>{r.type_name}</td>
                                  <td className="text-right" style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatCurrency(r.amount)}</td>
                                  <td className="text-center"><span className={`status-badge ${r.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{r.status}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}

              {activeTab === 'profile' && (<>
              {/* Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>

                {/* Personal Information */}
                <div style={{ background: 'var(--bg-page)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={16} color="var(--primary)" /> {t('vmember.personalDetails')}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('mform.dob')}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{formatDate(member.date_of_birth)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('mform.gender')}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{member.gender || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('mform.maritalStatus')}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{member.marital_status || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Contact & Occupation */}
                <div style={{ background: 'var(--bg-page)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Briefcase size={16} color="var(--primary)" /> {t('vmember.contactWork')}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <Phone size={16} color="var(--text-muted)" style={{ marginTop: '2px' }} />
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{member.phone || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <Briefcase size={16} color="var(--text-muted)" style={{ marginTop: '2px' }} />
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{member.occupation || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <MapPin size={16} color="var(--text-muted)" style={{ marginTop: '2px' }} />
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>{member.address || '—'}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Family Information & Banking */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                
                {/* Family Information */}
                <div style={{ background: 'var(--bg-page)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserRound size={16} color="var(--primary)" /> {t('mform.familyInfo')}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('mform.fatherName')}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{member.father_name || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('mform.motherName')}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{member.mother_name || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('vmember.fatherInLaw')}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{member.father_in_law_name || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('vmember.motherInLaw')}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{member.mother_in_law_name || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Banking & Membership */}
                <div style={{ background: 'var(--bg-page)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Landmark size={16} color="var(--primary)" /> {t('vmember.bankingMembership')}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('vmember.bank')}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{member.bank_name || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('vmember.accountHolder')}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{member.bank_account_holder_name || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('vmember.accountNumber')}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'monospace' }}>{member.bank_account_number || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('vmember.dateJoined')}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{formatDate(member.date_of_joining)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('common.status')}</span>
                      <span className="status-badge badge-success">{t('vmember.activeMember')}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Member Mobile App access (admin controls) */}
              <div style={{ background: 'var(--bg-page)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Smartphone size={16} color="var(--primary)" /> {t('vmember.appSection')}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('vmember.appAccess')}</span>
                      <span className={`status-badge ${member.app_enabled == null || Number(member.app_enabled) === 1 ? 'badge-success' : 'badge-danger'}`}>
                        {member.app_enabled == null || Number(member.app_enabled) === 1 ? t('vmember.appEnabled') : t('vmember.appDisabled')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('vmember.appPin')}</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {member.pin_set_at ? t('vmember.appPinSet', { date: formatDate(member.pin_set_at) }) : t('vmember.appPinNotSet')}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {member.app_enabled == null || Number(member.app_enabled) === 1 ? (
                      <button type="button" className="btn btn-secondary" disabled={appBusy} onClick={() => setAppConfirm('disable')}>
                        {t('vmember.appDisableBtn')}
                      </button>
                    ) : (
                      <button type="button" className="btn btn-primary" disabled={appBusy} onClick={() => applyAppAccess({ app_enabled: 1 })}>
                        {t('vmember.appEnableBtn')}
                      </button>
                    )}
                    {member.pin_set_at && (
                      <button type="button" className="btn btn-danger" disabled={appBusy} onClick={() => setAppConfirm('reset')}>
                        {t('vmember.appResetPin')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Dependents Section */}
              <div style={{ background: 'var(--bg-page)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} color="var(--primary)" /> {t('vmember.registeredDependentsCount', { count: member.dependents.length })}
                </h4>
                
                {member.dependents.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                    {member.dependents.map((dep) => (
                      <div key={dep.id} style={{ background: 'var(--bg-white)', padding: '14px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Heart size={14} color="var(--danger)" />
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{dep.name || '—'}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-hover)', padding: '4px 8px', borderRadius: '100px', textTransform: 'capitalize' }}>
                            {dep.relationship || '—'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {dep.date_of_birth && (
                            <span><strong>{t('vmember.dobShort')}:</strong> {formatDate(dep.date_of_birth)}</span>
                          )}
                          {dep.nic && (
                            <span><strong>{t('members.nic')}:</strong> {dep.nic}</span>
                          )}
                          {dep.age != null && (
                            <span><strong>{t('mform.age')}:</strong> {dep.age}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '80px', background: 'var(--bg-white)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {t('vmember.noDependentsReg')}
                  </div>
                )}
              </div>
              </>)}

            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--danger)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <IdCard size={48} opacity={0.5} />
              <p style={{ fontWeight: 600 }}>{t('vmember.loadFailed')}</p>
            </div>
          )}
        </div>

        {appConfirm && (
          <ConfirmModal
            title={t('vmember.appSection')}
            message={appConfirm === 'disable' ? t('vmember.appDisableConfirm') : t('vmember.appResetConfirm')}
            danger
            onConfirm={() => applyAppAccess(appConfirm === 'disable' ? { app_enabled: 0 } : { reset_pin: true })}
            onClose={() => setAppConfirm(null)}
          />
        )}
      </div>
    </ModalOverlay>
  )
}
