import React, { useState, useRef } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { showToast } from '../components/Toast'
import ModalOverlay from '../components/ModalOverlay'
import { SUPPORTED_BANKS } from '../constants/banks'
import { useT } from '../i18n'
import type { MemberFormData, DependentInput, FormErrors } from '../types'

interface AddMemberModalProps {
  onClose: () => void
  onCreated: () => void
  createMember: (data: MemberFormData) => Promise<{ success: boolean; id: number }>
  checkUnique: (field: string, value: string, excludeId?: number) => Promise<boolean>
}

const emptyForm: MemberFormData = {
  society_id: '',
  nic: '',
  full_name: '',
  date_of_birth: '',
  gender: 'Male',
  marital_status: 'Single',
  occupation: '',
  address: '',
  phone: '',
  date_of_joining: '',
  father_name: '',
  mother_name: '',
  father_in_law_name: '',
  mother_in_law_name: '',
  bank_name: '',
  bank_account_holder_name: '',
  bank_account_number: '',
  dependents: []
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

export default function AddMemberModal({
  onClose,
  onCreated,
  createMember,
  checkUnique
}: AddMemberModalProps): React.ReactElement {
  const { t } = useT()
  const [form, setForm] = useState<MemberFormData>({ ...emptyForm })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const firstInputRef = useRef<HTMLInputElement>(null)

  const updateField = (field: keyof MemberFormData, value: string): void => {
    setForm((prev) => ({ ...prev, [field]: value }))
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const addDependent = (): void => {
    setForm((prev) => ({
      ...prev,
      dependents: [...prev.dependents, { name: '', relationship: '', date_of_birth: '', nic: '', age: '' }]
    }))
  }

  const updateDependent = (index: number, field: keyof DependentInput, value: string): void => {
    setForm((prev) => {
      const deps = [...prev.dependents]
      deps[index] = { ...deps[index], [field]: value }
      // Auto-calculate age when date_of_birth changes
      if (field === 'date_of_birth') {
        deps[index].age = calculateAge(value)
      }
      return { ...prev, dependents: deps }
    })
    // Clear dependent errors
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
    setForm((prev) => ({
      ...prev,
      dependents: prev.dependents.filter((_, i) => i !== index)
    }))
  }

  const validate = async (): Promise<boolean> => {
    const newErrors: FormErrors = {}

    // Uniqueness checks — only if values are non-empty
    if (form.society_id.trim()) {
      const isUnique = await checkUnique('society_id', form.society_id.trim())
      if (!isUnique) newErrors.society_id = t('mform.societyIdExists')
    }

    if (form.nic.trim()) {
      const isUnique = await checkUnique('nic', form.nic.trim())
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
      await createMember({
        ...form,
        society_id: form.society_id.trim(),
        nic: form.nic.trim(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim()
      })
      showToast('success', t('mform.addedSuccess'))
      onCreated()
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : t('mform.addFailed')
      showToast('error', message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal" role="dialog" aria-label={t('members.add')} aria-modal="true">
        <div className="modal-header gradient-header">
          <h3>{t('members.add')}</h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.close')}>
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">

              {/* Society ID */}
              <div className="form-group">
                <label htmlFor="society_id">{t('mform.societyIdNumber')}</label>
                <input
                  ref={firstInputRef}
                  id="society_id"
                  type="text"
                  className={errors.society_id ? 'has-error' : ''}
                  value={form.society_id}
                  onChange={(e) => updateField('society_id', e.target.value)}
                />
                {errors.society_id && <span className="error-message">{errors.society_id}</span>}
              </div>

              {/* NIC */}
              <div className="form-group">
                <label htmlFor="nic">{t('mform.nicLabel')}</label>
                <input
                  id="nic"
                  type="text"
                  className={errors.nic ? 'has-error' : ''}
                  value={form.nic}
                  onChange={(e) => updateField('nic', e.target.value)}
                />
                {errors.nic && <span className="error-message">{errors.nic}</span>}
              </div>

              {/* Full Name */}
              <div className="form-group full-width">
                <label htmlFor="full_name">{t('members.fullName')}</label>
                <input
                  id="full_name"
                  type="text"
                  className={errors.full_name ? 'has-error' : ''}
                  value={form.full_name}
                  onChange={(e) => updateField('full_name', e.target.value)}
                />
                {errors.full_name && <span className="error-message">{errors.full_name}</span>}
              </div>

              {/* Date of Birth */}
              <div className="form-group">
                <label htmlFor="date_of_birth">{t('mform.dob')}</label>
                <input
                  id="date_of_birth"
                  type="date" max={new Date().toISOString().split('T')[0]}
                  className={errors.date_of_birth ? 'has-error' : ''}
                  value={form.date_of_birth}
                  onChange={(e) => updateField('date_of_birth', e.target.value)}
                />
                {errors.date_of_birth && (
                  <span className="error-message">{errors.date_of_birth}</span>
                )}
              </div>

              {/* Gender */}
              <div className="form-group">
                <label htmlFor="gender">{t('mform.gender')}</label>
                <select
                  id="gender"
                  value={form.gender}
                  onChange={(e) => updateField('gender', e.target.value)}
                >
                  <option value="Male">{t('mform.male')}</option>
                  <option value="Female">{t('mform.female')}</option>
                </select>
              </div>

              {/* Marital Status */}
              <div className="form-group">
                <label htmlFor="marital_status">{t('mform.maritalStatus')}</label>
                <select
                  id="marital_status"
                  value={form.marital_status}
                  onChange={(e) => updateField('marital_status', e.target.value)}
                >
                  <option value="Single">{t('mform.single')}</option>
                  <option value="Married">{t('mform.married')}</option>
                  <option value="Widowed">{t('mform.widowed')}</option>
                </select>
              </div>

              {/* Occupation */}
              <div className="form-group">
                <label htmlFor="occupation">{t('mform.jobOccupation')}</label>
                <input
                  id="occupation"
                  type="text"
                  value={form.occupation}
                  onChange={(e) => updateField('occupation', e.target.value)}
                />
              </div>

              {/* Address */}
              <div className="form-group full-width">
                <label htmlFor="address">{t('members.address')}</label>
                <textarea
                  id="address"
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                />
              </div>

              {/* Phone */}
              <div className="form-group">
                <label htmlFor="phone">{t('mform.phoneNumber')}</label>
                <input
                  id="phone"
                  type="text"
                  className={errors.phone ? 'has-error' : ''}
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  maxLength={10}
                />
                {errors.phone && <span className="error-message">{errors.phone}</span>}
              </div>

              {/* Date of Joining */}
              <div className="form-group">
                <label htmlFor="date_of_joining">{t('mform.doj')}</label>
                <input
                  id="date_of_joining"
                  type="date" max={new Date().toISOString().split('T')[0]}
                  className={errors.date_of_joining ? 'has-error' : ''}
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
                <label htmlFor="father_name">{t('mform.fatherName')}</label>
                <input
                  id="father_name"
                  type="text"
                  value={form.father_name}
                  onChange={(e) => updateField('father_name', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="mother_name">{t('mform.motherName')}</label>
                <input
                  id="mother_name"
                  type="text"
                  value={form.mother_name}
                  onChange={(e) => updateField('mother_name', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="father_in_law_name">{t('mform.fatherInLaw')}</label>
                <input
                  id="father_in_law_name"
                  type="text"
                  value={form.father_in_law_name}
                  onChange={(e) => updateField('father_in_law_name', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="mother_in_law_name">{t('mform.motherInLaw')}</label>
                <input
                  id="mother_in_law_name"
                  type="text"
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
                <label htmlFor="bank_name">{t('mform.bankName')}</label>
                <select
                  id="bank_name"
                  value={form.bank_name}
                  onChange={(e) => updateField('bank_name', e.target.value)}
                >
                  <option value="">{t('mform.selectBank')}</option>
                  {SUPPORTED_BANKS.map((bank) => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="bank_account_holder_name">{t('mform.accountHolder')}</label>
                <input
                  id="bank_account_holder_name"
                  type="text"
                  value={form.bank_account_holder_name}
                  onChange={(e) => updateField('bank_account_holder_name', e.target.value)}
                  placeholder={t('mform.accountHolderHint')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="bank_account_number">{t('mform.accountNumber')}</label>
                <input
                  id="bank_account_number"
                  type="text"
                  value={form.bank_account_number}
                  onChange={(e) => updateField('bank_account_number', e.target.value)}
                />
              </div>

              {/* ── Dependents Section ── */}
              <div className="dependents-section">
                <div className="dependents-header">
                  <h4>{t('mform.dependents')}</h4>
                  <button type="button" className="btn btn-secondary" onClick={addDependent}>
                    <Plus size={16} />
                    {t('mform.addDependent')}
                  </button>
                </div>

                {form.dependents.length === 0 && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {t('mform.noDependents')}
                  </p>
                )}

                {form.dependents.map((dep, index) => (
                  <div key={index} className="dependent-row" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-page)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '12px', position: 'relative' }}>
                    <button
                      type="button"
                      className="btn-icon danger"
                      onClick={() => removeDependent(index)}
                      aria-label={t('mform.removeDependent', { index: index + 1 })}
                      style={{ position: 'absolute', top: '8px', right: '8px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label htmlFor={`dep_name_${index}`}>{t('members.fullName')}</label>
                        <input
                          id={`dep_name_${index}`}
                          type="text"
                          className={errors[`dep_${index}_name`] ? 'has-error' : ''}
                          value={dep.name}
                          onChange={(e) => updateDependent(index, 'name', e.target.value)}
                        />
                        {errors[`dep_${index}_name`] && (
                          <span className="error-message">{errors[`dep_${index}_name`]}</span>
                        )}
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label htmlFor={`dep_rel_${index}`}>{t('mform.relationship')}</label>
                        <input
                          id={`dep_rel_${index}`}
                          type="text"
                          className={errors[`dep_${index}_relationship`] ? 'has-error' : ''}
                          value={dep.relationship}
                          onChange={(e) => updateDependent(index, 'relationship', e.target.value)}
                          placeholder={t('mform.relationshipHint')}
                        />
                        {errors[`dep_${index}_relationship`] && (
                          <span className="error-message">
                            {errors[`dep_${index}_relationship`]}
                          </span>
                        )}
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label htmlFor={`dep_dob_${index}`}>{t('mform.dob')}</label>
                        <input
                          id={`dep_dob_${index}`}
                          type="date" max={new Date().toISOString().split('T')[0]}
                          value={dep.date_of_birth}
                          onChange={(e) => updateDependent(index, 'date_of_birth', e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label htmlFor={`dep_nic_${index}`}>{t('members.nic')}</label>
                        <input
                          id={`dep_nic_${index}`}
                          type="text"
                          value={dep.nic}
                          onChange={(e) => updateDependent(index, 'nic', e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label htmlFor={`dep_age_${index}`}>{t('mform.age')}</label>
                        <input
                          id={`dep_age_${index}`}
                          type="number"
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
              {submitting ? t('common.saving') : t('mform.saveMember')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
