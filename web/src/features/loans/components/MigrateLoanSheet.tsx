import { useEffect, type ReactNode } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Field } from '@/components/form/Field'
import { FormSheet } from '@/components/form/FormSheet'
import { MemberPicker } from '@/components/MemberPicker'
import { RupeeInput, rupeesToCents } from '@/components/RupeeInput'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useSettings } from '@/features/settings/queries'
import { errorMessage } from '@/lib/api/errors'
import { formatCurrency } from '@/lib/format/currency'
import { formatDate, todayIso } from '@/lib/format/dates'
import { useT, type TranslationKey } from '@/lib/i18n'
import { useMigrateLoan } from '../queries'
import { nextChargePreview, type Loan } from '../types'
import { ExistingLoansPanel } from './ExistingLoansPanel'

const schema = z
  .object({
    member_id: z.number().nullable(),
    original_principal: z.string(),
    principal_owed: z.string().refine((v) => rupeesToCents(v) > 0, 'lform.remainingGtZero'),
    interest_owed: z.string(),
    fines_owed: z.string(),
    date_issued: z.string(),
    as_of_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'lform.asOfDate'),
    status: z.enum(['Auto', 'Defaulted']),
    guarantor1: z.number().nullable(),
    guarantor2: z.number().nullable(),
    purpose: z.string().trim().max(255)
  })
  .superRefine((v, ctx) => {
    if (!v.member_id) ctx.addIssue({ code: 'custom', path: ['member_id'], message: 'lform.selectBorrower' })
    const owed = rupeesToCents(v.principal_owed)
    const original = rupeesToCents(v.original_principal)
    if (original > 0 && original < owed) ctx.addIssue({ code: 'custom', path: ['original_principal'], message: 'lform.originalLessThanRemaining' })
    if (v.date_issued && v.as_of_date && v.as_of_date < v.date_issued) ctx.addIssue({ code: 'custom', path: ['as_of_date'], message: 'lform.asOfBeforeIssued' })
    if (v.guarantor1 && v.guarantor2 && v.guarantor1 === v.guarantor2) ctx.addIssue({ code: 'custom', path: ['guarantor2'], message: 'lform.guarantorsDistinct' })
    if (v.member_id && (v.guarantor1 === v.member_id || v.guarantor2 === v.member_id)) ctx.addIssue({ code: 'custom', path: ['guarantor1'], message: 'lform.borrowerNotGuarantor' })
  })
type Values = z.infer<typeof schema>

// Migration Mode: records where a paper loan stands today. No wallet is
// touched and no history is recreated; the "balances as of" date is where
// interest resumes, so no part-month is forgiven or double-charged.
export function MigrateLoanSheet({ open, onOpenChange, loans, headerSlot, onMigrated }: { open: boolean; onOpenChange: (o: boolean) => void; loans: Loan[]; headerSlot?: ReactNode; onMigrated?: (id: number) => void }) {
  const { t, lang } = useT()
  const settings = useSettings()
  const migrate = useMigrateLoan()
  const today = todayIso()
  const interestRate = Number(settings.data?.monthly_interest_rate) || 0

  const defaults = (): Values => ({ member_id: null, original_principal: '', principal_owed: '', interest_owed: '', fines_owed: '', date_issued: '', as_of_date: today, status: 'Auto', guarantor1: null, guarantor2: null, purpose: '' })
  const { control, register, handleSubmit, watch, reset, formState } = useForm<Values>({ resolver: zodResolver(schema) as Resolver<Values>, defaultValues: defaults() })
  const msg = (k?: string) => (k ? t(k as TranslationKey) : undefined)
  useEffect(() => {
    if (open) reset(defaults())
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const memberId = watch('member_id')
  const g1 = watch('guarantor1')
  const g2 = watch('guarantor2')
  const dateIssued = watch('date_issued')
  const preview = nextChargePreview(watch('as_of_date'), rupeesToCents(watch('principal_owed')), interestRate)

  const onSubmit = handleSubmit(async (v) => {
    const owed = rupeesToCents(v.principal_owed)
    const original = rupeesToCents(v.original_principal)
    try {
      const r = await migrate.mutateAsync({
        member_id: v.member_id!,
        principal_amount: original || owed,
        principal_owed: owed,
        interest_owed: rupeesToCents(v.interest_owed),
        fines_owed: rupeesToCents(v.fines_owed),
        date_issued: v.date_issued || null,
        as_of_date: v.as_of_date || null,
        ...(v.status === 'Defaulted' ? { status: 'Defaulted' as const } : {}),
        guarantor_ids: [v.guarantor1, v.guarantor2].filter((x): x is number => Boolean(x)),
        purpose: v.purpose.trim() || null
      })
      toast.success(t('lform.migrateSuccess'))
      onMigrated?.(r.id)
      onOpenChange(false)
    } catch (e) {
      toast.error(errorMessage(e, t('lform.migrateFailed')))
    }
  })

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={t('lform.migrateTitle')} description={t('loans.kindExistingHint')} dirty={formState.isDirty} submitting={migrate.isPending} submitLabel={t('loans.addExisting')} onSubmit={onSubmit} wide>
      <div className="grid gap-5">
        {headerSlot}
        <p className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          {t('lform.migrateInfoPre')} <strong className="text-foreground">{t('lform.migrateInfoStrong')}</strong> {t('lform.migrateInfoPost')}
        </p>

        <Field label={t('lform.borrower')} required error={msg(formState.errors.member_id?.message)}>
          {({ id, invalid }) => <Controller control={control} name="member_id" render={({ field }) => <MemberPicker id={id} value={field.value} onChange={field.onChange} invalid={invalid} />} />}
        </Field>

        <ExistingLoansPanel loans={loans} memberId={memberId} maxLoanLimit={0} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('lform.originalPrincipalRs')} error={msg(formState.errors.original_principal?.message)}>
            {({ id, invalid }) => <Controller control={control} name="original_principal" render={({ field }) => <RupeeInput id={id} value={field.value} onChange={field.onChange} placeholder={t('lform.originalPrincipalPlaceholder')} aria-invalid={invalid || undefined} />} />}
          </Field>
          <Field label={t('lform.remainingPrincipalRs')} required error={msg(formState.errors.principal_owed?.message)}>
            {({ id, invalid }) => <Controller control={control} name="principal_owed" render={({ field }) => <RupeeInput id={id} value={field.value} onChange={field.onChange} aria-invalid={invalid || undefined} />} />}
          </Field>
          <Field label={t('lform.outstandingInterestRs')}>
            {({ id }) => <Controller control={control} name="interest_owed" render={({ field }) => <RupeeInput id={id} value={field.value} onChange={field.onChange} />} />}
          </Field>
          <Field label={t('lform.outstandingFineRs')}>
            {({ id }) => <Controller control={control} name="fines_owed" render={({ field }) => <RupeeInput id={id} value={field.value} onChange={field.onChange} />} />}
          </Field>
          <Field label={t('lform.originalIssueDate')}>{({ id }) => <Input id={id} type="date" max={today} {...register('date_issued')} />}</Field>
          <Field label={t('lform.asOfDate')} required error={msg(formState.errors.as_of_date?.message)} description={t('lform.asOfHint')}>
            {({ id, describedBy }) => <Input id={id} type="date" max={today} min={dateIssued || undefined} aria-describedby={describedBy} {...register('as_of_date')} />}
          </Field>
        </div>

        {preview && (
          <p className="rounded-lg bg-accent px-4 py-2.5 text-sm text-accent-foreground">
            {t('lform.nextChargePreview', { amount: formatCurrency(preview.amount), date: formatDate(preview.date, lang) })}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('lform.guarantor1')} error={msg(formState.errors.guarantor1?.message)}>
            {({ id, invalid }) => <Controller control={control} name="guarantor1" render={({ field }) => <MemberPicker id={id} value={field.value} onChange={field.onChange} invalid={invalid} placeholder={t('lform.guarantorOptional')} exclude={[memberId, g2].filter((x): x is number => Boolean(x))} />} />}
          </Field>
          <Field label={t('lform.guarantor2')} error={msg(formState.errors.guarantor2?.message)}>
            {({ id, invalid }) => <Controller control={control} name="guarantor2" render={({ field }) => <MemberPicker id={id} value={field.value} onChange={field.onChange} invalid={invalid} placeholder={t('lform.guarantorOptional')} exclude={[memberId, g1].filter((x): x is number => Boolean(x))} />} />}
          </Field>
          <Field label={t('lform.loanStatus')}>
            {({ id }) => (
              <NativeSelect id={id} {...register('status')}>
                <option value="Auto">{t('lform.statusAuto')}</option>
                <option value="Defaulted">{t('rcpt.stDefaulted')}</option>
              </NativeSelect>
            )}
          </Field>
          <Field label={t('lform.notesLabel')}>{({ id }) => <Input id={id} placeholder={t('lform.migrateNotesPlaceholder')} {...register('purpose')} />}</Field>
        </div>
      </div>
    </FormSheet>
  )
}
