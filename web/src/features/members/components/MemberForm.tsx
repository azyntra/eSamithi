import { useEffect, useState } from 'react'
import { useFieldArray, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Field, FormSection } from '@/components/form/Field'
import { FormSheet } from '@/components/form/FormSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api/errors'
import { SUPPORTED_BANKS } from '@/lib/constants/banks'
import { calculateAge, toDateInput, todayIso } from '@/lib/format/dates'
import { useT, type TranslationKey } from '@/lib/i18n'
import { membersApi } from '../api'
import { useCreateMember, useMember, useUpdateMember } from '../queries'
import { emptyDependent, emptyMemberForm, memberSchema, type MemberFormParsed, type MemberFormValues } from '../schema'
import type { MemberPayload, MemberWithDependents } from '../types'

interface MemberFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberId?: number | null // undefined/null = create
  onSaved?: (id: number) => void
}

function toFormValues(m: MemberWithDependents): MemberFormValues {
  return {
    society_id: m.society_id || '',
    nic: m.nic || '',
    full_name: m.full_name || '',
    date_of_birth: toDateInput(m.date_of_birth),
    gender: m.gender === 'Female' ? 'Female' : 'Male',
    marital_status: m.marital_status === 'Married' ? 'Married' : m.marital_status === 'Widowed' ? 'Widowed' : 'Single',
    occupation: m.occupation || '',
    address: m.address || '',
    phone: m.phone || '',
    date_of_joining: toDateInput(m.date_of_joining),
    father_name: m.father_name || '',
    mother_name: m.mother_name || '',
    father_in_law_name: m.father_in_law_name || '',
    mother_in_law_name: m.mother_in_law_name || '',
    bank_name: m.bank_name || '',
    bank_account_holder_name: m.bank_account_holder_name || '',
    bank_account_number: m.bank_account_number || '',
    dependents: (m.dependents || []).map((d) => ({
      name: d.name || '',
      relationship: d.relationship || '',
      date_of_birth: toDateInput(d.date_of_birth),
      nic: d.nic || '',
      age: d.age != null ? String(d.age) : ''
    }))
  }
}

function toPayload(v: MemberFormParsed): MemberPayload {
  return { ...v, society_id: v.society_id.trim(), nic: v.nic.trim(), full_name: v.full_name.trim(), phone: v.phone.trim() }
}

export function MemberFormSheet({ open, onOpenChange, memberId, onSaved }: MemberFormSheetProps) {
  const { t } = useT()
  const editing = Boolean(memberId)
  const existing = useMember(memberId ?? 0, open && editing)
  const create = useCreateMember()
  const update = useUpdateMember(memberId ?? 0)
  const [checking, setChecking] = useState<'society_id' | 'nic' | null>(null)
  const today = todayIso()

  const form = useForm<MemberFormValues, unknown, MemberFormParsed>({
    resolver: zodResolver(memberSchema) as Resolver<MemberFormValues, unknown, MemberFormParsed>,
    defaultValues: emptyMemberForm,
    mode: 'onBlur'
  })
  const { register, control, handleSubmit, reset, setValue, setError, clearErrors, getValues, watch, formState } = form
  const { errors, isDirty, isSubmitting } = formState
  const dependents = useFieldArray({ control, name: 'dependents' })

  // Load the member into the form when editing; reset when the sheet opens for a new one
  useEffect(() => {
    if (!open) return
    if (editing && existing.data) reset(toFormValues(existing.data))
    if (!editing) reset(emptyMemberForm)
  }, [open, editing, existing.data, reset])

  const msg = (key: string | undefined) => (key ? t(key as TranslationKey) : undefined)

  const checkUnique = async (field: 'society_id' | 'nic'): Promise<boolean> => {
    const value = getValues(field)?.trim()
    if (!value) return true
    setChecking(field)
    try {
      const unique = await membersApi.checkUnique(field, value, editing ? memberId! : undefined)
      if (!unique) setError(field, { type: 'unique', message: field === 'society_id' ? 'mform.societyIdExists' : 'mform.nicExists' })
      else if (errors[field]?.type === 'unique') clearErrors(field)
      return unique
    } catch {
      return true // network hiccup: the server rejects duplicates anyway
    } finally {
      setChecking(null)
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    const [a, b] = await Promise.all([checkUnique('society_id'), checkUnique('nic')])
    if (!a || !b) return
    try {
      if (editing) {
        await update.mutateAsync(toPayload(values))
        toast.success(t('mform.updatedSuccess'))
        onSaved?.(memberId!)
      } else {
        const r = await create.mutateAsync(toPayload(values))
        toast.success(t('mform.addedSuccess'))
        onSaved?.(r.id)
      }
      onOpenChange(false)
    } catch (e) {
      toast.error(errorMessage(e, t(editing ? 'mform.updateFailed' : 'mform.addFailed')))
    }
  })

  const depDob = watch('dependents')

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('mform.editTitle') : t('members.add')}
      description={editing && existing.data ? existing.data.full_name || existing.data.society_id : t('members.subtitle')}
      dirty={isDirty}
      submitting={isSubmitting || create.isPending || update.isPending}
      submitLabel={editing ? t('mform.updateMember') : t('mform.saveMember')}
      onSubmit={onSubmit}
      wide
    >
      {editing && existing.isPending ? (
        <p className="text-sm text-muted-foreground">{t('mform.loadingMember')}</p>
      ) : (
        <div className="grid gap-7">
          <FormSection title={t('members.identity')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('mform.societyIdNumber')} error={msg(errors.society_id?.message)} description={checking === 'society_id' ? t('members.uniqueChecking') : undefined}>
                {({ id, invalid }) => <Input id={id} autoFocus={!editing} className="font-mono" aria-invalid={invalid || undefined} {...register('society_id', { onBlur: () => void checkUnique('society_id') })} />}
              </Field>
              <Field label={t('mform.nicLabel')} error={msg(errors.nic?.message)} description={checking === 'nic' ? t('members.uniqueChecking') : undefined}>
                {({ id, invalid }) => <Input id={id} className="font-mono" autoCapitalize="characters" aria-invalid={invalid || undefined} {...register('nic', { onBlur: () => void checkUnique('nic') })} />}
              </Field>
              <Field label={t('members.fullName')} className="sm:col-span-2" error={msg(errors.full_name?.message)}>
                {({ id, invalid }) => <Input id={id} aria-invalid={invalid || undefined} {...register('full_name')} />}
              </Field>
              <Field label={t('mform.dob')} error={msg(errors.date_of_birth?.message)}>
                {({ id }) => <Input id={id} type="date" max={today} {...register('date_of_birth')} />}
              </Field>
              <Field label={t('mform.gender')}>
                {({ id }) => (
                  <NativeSelect id={id} {...register('gender')}>
                    <option value="Male">{t('mform.male')}</option>
                    <option value="Female">{t('mform.female')}</option>
                  </NativeSelect>
                )}
              </Field>
              <Field label={t('mform.maritalStatus')}>
                {({ id }) => (
                  <NativeSelect id={id} {...register('marital_status')}>
                    <option value="Single">{t('mform.single')}</option>
                    <option value="Married">{t('mform.married')}</option>
                    <option value="Widowed">{t('mform.widowed')}</option>
                  </NativeSelect>
                )}
              </Field>
              <Field label={t('mform.jobOccupation')}>{({ id }) => <Input id={id} {...register('occupation')} />}</Field>
              <Field label={t('members.address')} className="sm:col-span-2">
                {({ id }) => <Textarea id={id} rows={2} {...register('address')} />}
              </Field>
              <Field label={t('mform.phoneNumber')} error={msg(errors.phone?.message)}>
                {({ id, invalid }) => <Input id={id} inputMode="numeric" maxLength={10} className="tnum" aria-invalid={invalid || undefined} {...register('phone')} />}
              </Field>
              <Field label={t('mform.doj')}>{({ id }) => <Input id={id} type="date" max={today} {...register('date_of_joining')} />}</Field>
            </div>
          </FormSection>

          <FormSection title={t('mform.familyInfo')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('mform.fatherName')}>{({ id }) => <Input id={id} {...register('father_name')} />}</Field>
              <Field label={t('mform.motherName')}>{({ id }) => <Input id={id} {...register('mother_name')} />}</Field>
              <Field label={t('mform.fatherInLaw')}>{({ id }) => <Input id={id} {...register('father_in_law_name')} />}</Field>
              <Field label={t('mform.motherInLaw')}>{({ id }) => <Input id={id} {...register('mother_in_law_name')} />}</Field>
            </div>
          </FormSection>

          <FormSection title={t('mform.bankingInfo')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('mform.bankName')}>
                {({ id }) => (
                  <NativeSelect id={id} {...register('bank_name')}>
                    <option value="">{t('mform.selectBank')}</option>
                    {SUPPORTED_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field label={t('mform.accountHolder')} description={t('mform.accountHolderHint')}>
                {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} {...register('bank_account_holder_name')} />}
              </Field>
              <Field label={t('mform.accountNumber')}>{({ id }) => <Input id={id} className="tnum font-mono" {...register('bank_account_number')} />}</Field>
            </div>
          </FormSection>

          <FormSection title={t('mform.dependents')}>
            {dependents.fields.length === 0 && <p className="text-sm text-muted-foreground italic">{t('mform.noDependents')}</p>}
            <div className="grid gap-3">
              {dependents.fields.map((f, index) => (
                <div key={f.id} className="relative grid gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:grid-cols-2">
                  <Button type="button" variant="ghost" size="icon-sm" className="absolute top-2 right-2 text-danger hover:bg-danger-soft" aria-label={t('mform.removeDependent', { index: index + 1 })} onClick={() => dependents.remove(index)}>
                    <Trash2 />
                  </Button>
                  <Field label={t('members.fullName')}>{({ id }) => <Input id={id} {...register(`dependents.${index}.name` as const)} />}</Field>
                  <Field label={t('mform.relationship')}>{({ id }) => <Input id={id} placeholder={t('mform.relationshipHint')} {...register(`dependents.${index}.relationship` as const)} />}</Field>
                  <Field label={t('mform.dob')}>
                    {({ id }) => (
                      <Input
                        id={id}
                        type="date"
                        max={today}
                        {...register(`dependents.${index}.date_of_birth` as const, {
                          onChange: (e) => setValue(`dependents.${index}.age`, calculateAge(e.target.value), { shouldDirty: true })
                        })}
                      />
                    )}
                  </Field>
                  <Field label={t('members.nic')}>{({ id }) => <Input id={id} className="font-mono" {...register(`dependents.${index}.nic` as const)} />}</Field>
                  <Field label={t('mform.age')} description={depDob?.[index]?.date_of_birth ? t('mform.ageAuto') : t('mform.ageManual')} error={msg(errors.dependents?.[index]?.age?.message)}>
                    {({ id, describedBy }) => <Input id={id} inputMode="numeric" maxLength={3} className="tnum" readOnly={Boolean(depDob?.[index]?.date_of_birth)} aria-describedby={describedBy} {...register(`dependents.${index}.age` as const)} />}
                  </Field>
                </div>
              ))}
            </div>
            <div>
              <Button type="button" variant="secondary" size="sm" onClick={() => dependents.append({ ...emptyDependent })}>
                <Plus /> {t('mform.addDependent')}
              </Button>
            </div>
          </FormSection>
        </div>
      )}
    </FormSheet>
  )
}
