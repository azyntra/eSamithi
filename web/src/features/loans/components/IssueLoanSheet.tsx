import { useEffect, useMemo, type ReactNode } from 'react'
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
import { useWallets } from '@/features/wallet/queries'
import { errorMessage } from '@/lib/api/errors'
import { formatRupees } from '@/lib/format/currency'
import { todayIso } from '@/lib/format/dates'
import { useT, type TranslationKey } from '@/lib/i18n'
import { useIssueLoan } from '../queries'
import { headroomOf, type Loan } from '../types'
import { ExistingLoansPanel } from './ExistingLoansPanel'

const schema = z
  .object({
    member_id: z.number().nullable(),
    date_issued: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'lform.dateIssued'),
    principal: z.string().refine((v) => rupeesToCents(v) > 0, 'lform.principalGtZero'),
    wallet_id: z.string().min(1, 'wform.selectWallet'),
    purpose: z.string().trim().min(1, 'lform.purposeOfLoan').max(255),
    guarantor1: z.number().nullable(),
    guarantor2: z.number().nullable()
  })
  .superRefine((v, ctx) => {
    if (!v.member_id) ctx.addIssue({ code: 'custom', path: ['member_id'], message: 'lform.selectBorrower' })
    if (!v.guarantor1) ctx.addIssue({ code: 'custom', path: ['guarantor1'], message: 'lform.twoGuarantors' })
    if (!v.guarantor2) ctx.addIssue({ code: 'custom', path: ['guarantor2'], message: 'lform.twoGuarantors' })
    if (v.guarantor1 && v.guarantor2 && v.guarantor1 === v.guarantor2) ctx.addIssue({ code: 'custom', path: ['guarantor2'], message: 'lform.guarantorsDifferent' })
    if (v.member_id && (v.guarantor1 === v.member_id || v.guarantor2 === v.member_id)) ctx.addIssue({ code: 'custom', path: ['guarantor1'], message: 'lform.ownGuarantor' })
  })
type Values = z.infer<typeof schema>

export function IssueLoanSheet({ open, onOpenChange, loans, headerSlot, onIssued }: { open: boolean; onOpenChange: (o: boolean) => void; loans: Loan[]; headerSlot?: ReactNode; onIssued?: (id: number) => void }) {
  const { t } = useT()
  const settings = useSettings()
  const wallets = useWallets()
  const issue = useIssueLoan()
  const today = todayIso()
  const activeWallets = useMemo(() => (wallets.data ?? []).filter((w) => Number(w.is_active) === 1), [wallets.data])
  // "0" is a valid setting that disables the cap; only a missing one falls back
  const maxLoanLimit = Number(settings.data?.max_loan_limit ?? 100000) || 0

  const defaults = (): Values => ({ member_id: null, date_issued: today, principal: '', wallet_id: '', purpose: '', guarantor1: null, guarantor2: null })
  const { control, register, handleSubmit, watch, reset, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) as Resolver<Values>, defaultValues: defaults() })
  const msg = (k?: string) => (k ? t(k as TranslationKey) : undefined)
  useEffect(() => {
    if (open) reset(defaults())
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const memberId = watch('member_id')
  const g1 = watch('guarantor1')
  const g2 = watch('guarantor2')
  const walletId = watch('wallet_id')
  const headroom = headroomOf(loans, memberId, maxLoanLimit)
  const noHeadroom = headroom !== null && headroom <= 0 && Boolean(memberId)
  const selectedWallet = activeWallets.find((w) => String(w.id) === walletId)

  const onSubmit = handleSubmit(async (v) => {
    const principal = rupeesToCents(v.principal)
    if (headroom !== null && principal > headroom) return setError('principal', { type: 'headroom', message: t('lform.headroomExceeded', { max: formatRupees(Math.max(headroom, 0)) }) })
    if (selectedWallet && principal > selectedWallet.balance) return setError('wallet_id', { type: 'funds', message: 'lform.insufficientWallet' })
    try {
      const r = await issue.mutateAsync({
        member_id: v.member_id!,
        principal_amount: principal,
        purpose: v.purpose.trim(),
        date_issued: v.date_issued,
        disbursement_wallet_id: Number(v.wallet_id),
        guarantor_ids: [v.guarantor1!, v.guarantor2!]
      })
      toast.success(t('lform.issued'))
      onIssued?.(r.id)
      onOpenChange(false)
    } catch (e) {
      toast.error(errorMessage(e, t('lform.issueFailed')))
    }
  })

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={t('lform.issueTitle')} description={t('loans.kindNewHint')} dirty={formState.isDirty} submitting={issue.isPending} submitLabel={t('lform.issueDisburse')} onSubmit={onSubmit} wide>
      <div className="grid gap-5">
        {headerSlot}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('lform.applicantMember')} required error={msg(formState.errors.member_id?.message)}>
            {({ id, invalid }) => <Controller control={control} name="member_id" render={({ field }) => <MemberPicker id={id} value={field.value} onChange={field.onChange} invalid={invalid} exclude={[g1, g2].filter((x): x is number => Boolean(x))} />} />}
          </Field>
          <Field label={t('lform.dateIssued')} required error={msg(formState.errors.date_issued?.message)}>
            {({ id }) => <Input id={id} type="date" max={today} {...register('date_issued')} />}
          </Field>
        </div>

        <ExistingLoansPanel loans={loans} memberId={memberId} maxLoanLimit={maxLoanLimit} showHeadroom />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('wform.principalAmount')}
            required
            error={msg(formState.errors.principal?.message)}
            description={headroom !== null ? t('lform.maxLimitHint', { max: formatRupees(Math.max(headroom, 0)) }) : undefined}
          >
            {({ id, invalid, describedBy }) => <Controller control={control} name="principal" render={({ field }) => <RupeeInput id={id} value={field.value} onChange={field.onChange} max={headroom !== null ? Math.max(headroom, 0) / 100 : undefined} aria-describedby={describedBy} aria-invalid={invalid || undefined} />} />}
          </Field>
          <Field label={t('lform.disbursementWallet')} required error={msg(formState.errors.wallet_id?.message)}>
            {({ id, invalid }) => (
              <NativeSelect id={id} disabled={wallets.isPending} aria-busy={wallets.isPending || undefined} aria-invalid={invalid || undefined} {...register('wallet_id')}>
                <option value="">{wallets.isPending ? t('common.loading') : t('wform.selectWallet')}</option>
                {activeWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
        </div>

        <Field label={t('lform.purposeOfLoan')} required error={msg(formState.errors.purpose?.message)}>
          {({ id, invalid }) => <Input id={id} placeholder={t('lform.purposePlaceholder')} aria-invalid={invalid || undefined} {...register('purpose')} />}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('lform.guarantor1')} required error={msg(formState.errors.guarantor1?.message)}>
            {({ id, invalid }) => <Controller control={control} name="guarantor1" render={({ field }) => <MemberPicker id={id} value={field.value} onChange={field.onChange} invalid={invalid} placeholder={t('lform.selectGuarantor1')} exclude={[memberId, g2].filter((x): x is number => Boolean(x))} />} />}
          </Field>
          <Field label={t('lform.guarantor2')} required error={msg(formState.errors.guarantor2?.message)}>
            {({ id, invalid }) => <Controller control={control} name="guarantor2" render={({ field }) => <MemberPicker id={id} value={field.value} onChange={field.onChange} invalid={invalid} placeholder={t('lform.selectGuarantor2')} exclude={[memberId, g1].filter((x): x is number => Boolean(x))} />} />}
          </Field>
        </div>
        <p className="text-xs text-subtle-foreground">{t('lform.guarantorNote')}</p>
        {noHeadroom && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{t('lform.noHeadroom', { max: formatRupees(maxLoanLimit) })}</p>}
      </div>
    </FormSheet>
  )
}
