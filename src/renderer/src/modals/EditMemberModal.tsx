import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { showToast } from '../components/Toast'
import ModalOverlay from '../components/ModalOverlay'
import { SUPPORTED_BANKS } from '../constants/banks'
import { useT } from '../i18n'
import type { MemberFormData, MemberWithDependents, DependentInput, FormErrors } from '../types'

interface EditMemberModalProps {
  memberId: number
  onClose: () => void
  onUpdated: () => void
  getMember: (id: number) => Promise<MemberWithDependents>
  updateMember: (id: number, data: MemberFormData) => Promise<{ success: boolean }>
  checkUnique: (field: string, value: string, excludeId?: number) => Promise<boolean>
}

const calculateAge = (dob: string): string => {
  if (!dob) return ''
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age >= 0 ? String(age) : ''
}

export default function EditMemberModal({
  memberId,
  onClose,
  onUpdated,
  getMember,
  updateMember,
  checkUnique
}: EditMemberModalProps): React.ReactElement {
  const { t } = useT()
  const [form, setForm] = useState<MemberFormData | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load existing member data
  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const member = await getMember(memberId)
        setForm({
          society_id: member.society_id || '',
          nic: member.nic || '',
          full_name: member.full_name || '',
          date_of_birth: member.date_of_birth ? new Date(member.date_of_birth).toISOString().split('T')[0] : '',
          gender: member.gender || 'Male',
          marital_status: member.marital_status || 'Single',
          occupation: member.occupation || '',
          address: member.address || '',
          phone: member.phone || '',
          date_of_joining: member.date_of_joining ? new Date(member.date_of_joining).toISOString().split('T')[0] : '',
          father_name: member.father_name || '',
          mother_name: member.mother_name || '',
          father_in_law_name: member.father_in_law_name || '',
          mother_in_law_name: member.mother_in_law_name || '',
          bank_name: member.bank_name || '',
          bank_account_holder_name: member.bank_account_holder_name || '',
          bank_account_number: member.bank_account_number || '',
          dependents: member.dependents.map((d) => ({
            name: d.name || '',
            relationship: d.relationship || '',
            date_of_birth: d.date_of_birth ? new Date(d.date_of_birth).toISOString().split('T')[0] : '',
            nic: d.nic || '',
            age: d.age != null ? String(d.age) : ''
          }))
        })
      } catch (error) {
        console.error('Failed to load member:', error)
        showToast('error', t('mform.loadFailed'))
        onClose()
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [memberId, getMember, onClose])

  if (loading || !form) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="modal" role="dialog" aria-label={t('mform.editTitle')} aria-modal="true">
          <div className="modal-body" style={{ textAlign: 'center', padding: '60px' }}>
            {t('mform.loadingMember')}
          </div>
        </div>
      </ModalOverlay>
    )
  }

  const updateField = (field: keyof MemberFormData, value: string): void => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const addDependent = (): void => {
    setForm((prev) =>
      prev ? { ...prev, dependents: [...prev.dependents, { name: '', relationship: '', date_of_birth: '', nic: '', age: '' }] } : prev
    )
  }

  const updateDependent = (index: number, field: keyof DependentInput, value: string): void => {
    setForm((prev) => {
      if (!prev) return prev
      const deps = [...prev.dependents]
      deps[index] = { ...deps[index], [field]: value }
      // Auto-calculate age when date_of_birth changes
      if (field === 'date_of_birth') {
        deps[index].age = calculateAge(value)
      }
      return { ...prev, dependents: deps }
    })
    const errorKey = `dep_${index}_${field}`
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[errorKey]
        return next
      })
    }
  }

  const removeDependent = (index: number): void => {
    setForm((prev) =>
      prev ? { ...prev, dependents: prev.dependents.filter((_, i) => i !== index) } : prev
    )
  }

  const validate = async (): Promise<boolean> => {
    const newErrors: FormErrors = {}

    // Uniqueness checks — only if values are non-empty, exclude current member
    if (form.society_id.trim()) {
      const isUnique = await checkUnique('society_id', form.society_id.trim(), memberId)
      if (!isUnique) newErrors.society_id = t('mform.societyIdExists')
    }

    if (form.nic.trim()) {
      const isUnique = await checkUnique('nic', form.nic.trim(), memberId)
      if (!isUnique) newErrors.nic = t('mform.nicExists')
    }

    // Phone validation — only if provided
    if (form.phone.trim() && !/^\d{10}$/.test(form.phone.trim())) {
      newErrors.phone = t('mform.phoneInvalid')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setSubmitting(true)

    const isValid = await validate()
    if (!isValid) {
      setSubmitting(false)
      return
    }

    try {
      await updateMember(memberId, {
        ...form,
        society_id: form.society_id.trim(),
        nic: form.nic.trim(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim()
      })
      showToast('success', t('mform.updatedSuccess'))
      onUpdated()
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : t('mform.updateFailed')
      showToast('error', message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal" role="dialog" aria-label={t('mform.editTitle')} aria-modal="true">
        <div className="modal-header gradient-header">
          <h3>{t('mform.editTitle')}</h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.close')}>
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">

              <div className="form-group">
                <label htmlFor="edit_society_id">{t('mform.societyIdNumber')}</label>
                <input
                  id="edit_society_id"
                  type="text"
                  className={`form-control ${errors.society_id ? 'has-error' : ''}`}
                  value={form.society_id}
                  onChange={(e) => updateField('society_id', e.target.value)}
                />
                {errors.society_id && <span className="error-message">{errors.society_id}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="edit_nic">{t('mform.nicLabel')}</label>
                <input
                  id="edit_nic"
                  type="text"
                  className={`form-control ${errors.nic ? 'has-error' : ''}`}
                  value={form.nic}
                  onChange={(e) => updateField('nic', e.target.value)}
                />
                {errors.nic && <span className="error-message">{errors.nic}</span>}
              </div>

              <div className="form-group full-width">
                <label htmlFor="edit_full_name">{t('members.fullName')}</label>
                <input
                  id="edit_full_name"
                  type="text"
                  className={`form-control ${errors.full_name ? 'has-error' : ''}`}
                  value={form.full_name}
                  onChange={(e) => updateField('full_name', e.target.value)}
                />
                {errors.full_name && <span className="error-message">{errors.full_name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="edit_date_of_birth">{t('mform.dob')}</label>
                <input
                  id="edit_date_of_birth"
                  type="date" max={new Date().toISOString().split('T')[0]}
                  className={`form-control ${errors.date_of_birth ? 'has-error' : ''}`}
                  value={form.date_of_birth}
                  onChange={(e) => updateField('date_of_birth', e.target.value)}
                />
                {errors.date_of_birth && (
                  <span className="error-message">{errors.date_of_birth}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="edit_gender">{t('mform.gender')}</label>
                <select
                  id="edit_gender"
                  className="form-control"
                  value={form.gender}
                  onChange={(e) => updateField('gender', e.target.value)}
                >
                  <option value="Male">{t('mform.male')}</option>
                  <option value="Female">{t('mform.female')}</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit_marital_status">{t('mform.maritalStatus')}</label>
                <select
                  id="edit_marital_status"
                  className="form-control"
                  value={form.marital_status}
                  onChange={(e) => updateField('marital_status', e.target.value)}
                >
                  <option value="Single">{t('mform.single')}</option>
                  <option value="Married">{t('mform.married')}</option>
                  <option value="Widowed">{t('mform.widowed')}</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit_occupation">{t('mform.jobOccupation')}</label>
                <input
                  id="edit_occupation"
                  type="text"
                  className="form-control"
                  value={form.occupation}
                  onChange={(e) => updateField('occupation', e.target.value)}
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="edit_address">{t('members.address')}</label>
                <textarea
                  id="edit_address"
                  className="form-control"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit_phone">{t('mform.phoneNumber')}</label>
                <input
                  id="edit_phone"
                  type="text"
                  className={`form-control ${errors.phone ? 'has-error' : ''}`}
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  maxLength={10}
                />
                {errors.phone && <span className="error-message">{errors.phone}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="edit_date_of_joining">{t('mform.doj')}</label>
                <input
                  id="edit_date_of_joining"
                  type="date" max={new Date().toISOString().split('T')[0]}
                  className={`form-control ${errors.date_of_joining ? 'has-error' : ''}`}
                  value={form.date_of_joining}
                  onChange={(e) => updateField('date_of_joining', e.target.value)}
                />
                {errors.date_of_joining && (
                  <span className="error-message">{errors.date_of_joining}</span>
                )}
              </div>

              {/* ── Family Information Section ── */}
              <div className="full-width" style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                  {t('mform.familyInfo')}
                </h4>
              </div>

              <div className="form-group">
                <label htmlFor="edit_father_name">{t('mform.fatherName')}</label>
                <input
                  id="edit_father_name"
                  type="text"
                  className="form-control"
                  value={form.father_name}
                  onChange={(e) => updateField('father_name', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit_mother_name">{t('mform.motherName')}</label>
                <input
                  id="edit_mother_name"
                  type="text"
                  className="form-control"
                  value={form.mother_name}
                  onChange={(e) => updateField('mother_name', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit_father_in_law_name">{t('mform.fatherInLaw')}</label>
                <input
                  id="edit_father_in_law_name"
                  type="text"
                  className="form-control"
                  value={form.father_in_law_name}
                  onChange={(e) => updateField('father_in_law_name', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit_mother_in_law_name">{t('mform.motherInLaw')}</label>
                <input
                  id="edit_mother_in_law_name"
                  type="text"
                  className="form-control"
                  value={form.mother_in_law_name}
                  onChange={(e) => updateField('mother_in_law_name', e.target.value)}
                />
              </div>

              {/* ── Banking Information Section ── */}
              <div className="full-width" style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                  {t('mform.bankingInfo')}
                </h4>
              </div>

              <div className="form-group">
                <label htmlFor="edit_bank_name">{t('mform.bankName')}</label>
                <select
                  id="edit_bank_name"
                  className="form-control"
                  value={form.bank_name}
                  onChange={(e) => updateField('bank_name', e.target.value)}
                >
                  <option value="">{t('mform.selectBank')}</option>
                  {SUPPORTED_BANKS.map((bank) => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                  {form.bank_name && !SUPPORTED_BANKS.includes(form.bank_name) && (
                    <option value={form.bank_name}>{form.bank_name}</option>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit_bank_account_holder_name">{t('mform.accountHolder')}</label>
                <input
                  id="edit_bank_account_holder_name"
                  type="text"
                  className="form-control"
                  value={form.bank_account_holder_name}
                  onChange={(e) => updateField('bank_account_holder_name', e.target.value)}
                  placeholder={t('mform.accountHolderHint')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit_bank_account_number">{t('mform.accountNumber')}</label>
                <input
                  id="edit_bank_account_number"
                  type="text"
                  className="form-control"
                  value={form.bank_account_number}
                  onChange={(e) => updateField('bank_account_number', e.target.value)}
                />
              </div>

              {/* ── Dependents Section ── */}
              <div className="dependents-section" style={{ gridColumn: '1 / -1', background: 'var(--bg-page)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', marginTop: '8px' }}>
                <div className="dependents-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{t('mform.registeredDependents')}</h4>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addDependent} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} />
                    Add Dependent
                  </button>
                </div>

                {form.dependents.length === 0 && (
                  <p
                    style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}
                  >
                    {t('vmember.noDependentsReg')}.
                  </p>
                )}

                {form.dependents.map((dep, index) => (
                  <div key={index} className="dependent-row" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-white)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '12px', position: 'relative' }}>
                    <button
                      type="button"
                      className="icon-btn text-danger"
                      style={{ position: 'absolute', top: '8px', right: '8px' }}
                      onClick={() => removeDependent(index)}
                      title={t('mform.removeDependentTitle')}
                      aria-label={t('mform.removeDependent', { index: index + 1 })}
                    >
                      <Trash2 size={20} />
                    </button>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label htmlFor={`edit_dep_name_${index}`}>{t('members.fullName')}</label>
                        <input
                          id={`edit_dep_name_${index}`}
                          type="text"
                          className={`form-control ${errors[`dep_${index}_name`] ? 'has-error' : ''}`}
                          value={dep.name}
                          onChange={(e) => updateDependent(index, 'name', e.target.value)}
                          placeholder={t('members.fullName')}
                        />
                        {errors[`dep_${index}_name`] && (
                          <span className="error-message" style={{ display: 'block', marginTop: '4px' }}>{errors[`dep_${index}_name`]}</span>
                        )}
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label htmlFor={`edit_dep_rel_${index}`}>{t('mform.relationship')}</label>
                        <input
                          id={`edit_dep_rel_${index}`}
                          type="text"
                          className={`form-control ${errors[`dep_${index}_relationship`] ? 'has-error' : ''}`}
                          value={dep.relationship}
                          onChange={(e) => updateDependent(index, 'relationship', e.target.value)}
                          placeholder={t('mform.relationshipHint')}
                        />
                        {errors[`dep_${index}_relationship`] && (
                          <span className="error-message" style={{ display: 'block', marginTop: '4px' }}>
                            {errors[`dep_${index}_relationship`]}
                          </span>
                        )}
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label htmlFor={`edit_dep_dob_${index}`}>{t('mform.dob')}</label>
                        <input
                          id={`edit_dep_dob_${index}`}
                          type="date" max={new Date().toISOString().split('T')[0]}
                          className="form-control"
                          value={dep.date_of_birth}
                          onChange={(e) => updateDependent(index, 'date_of_birth', e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label htmlFor={`edit_dep_nic_${index}`}>{t('members.nic')}</label>
                        <input
                          id={`edit_dep_nic_${index}`}
                          type="text"
                          className="form-control"
                          value={dep.nic}
                          onChange={(e) => updateDependent(index, 'nic', e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label htmlFor={`edit_dep_age_${index}`}>{t('mform.age')}</label>
                        <input
                          id={`edit_dep_age_${index}`}
                          type="number"
                          className="form-control"
                          value={dep.age}
                          onChange={(e) => updateDependent(index, 'age', e.target.value)}
                          readOnly={!!dep.date_of_birth}
                          style={{ background: dep.date_of_birth ? 'var(--bg-hover)' : undefined }}
                          title={dep.date_of_birth ? t('mform.ageAuto') : t('mform.ageManual')}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('common.updating') : t('mform.updateMember')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
