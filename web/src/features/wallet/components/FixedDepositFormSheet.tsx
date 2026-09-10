import { useEffect, useMemo } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Field, FormSection } from '@/components/form/Field'
import { FormSheet } from '@/components/form/FormSheet'
import { RupeeInput, rupeesToCents } from '@/components/RupeeInput'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api/errors'
import { formatCurrency } from '@/lib/format/currency'
import { todayIso } from '@/lib/format/dates'
import { useT, type TranslationKey } from '@/lib/i18n'
import type { Wallet } from '../api'
import { addMonths } from '../fd'
import { useCreateFixedDeposit } from '../queries'

const schema = z.object({
  fd_number: z.string().trim().min(1, 'wform.fdNumberRef').max(100),
  bank_name: z.string().trim().min(1, 'mform.bankName').max(255),
  principal: z.string().refine((v) => rupeesToCents(v) > 0, 'wform.invalidPrincipal'),
  interest_rate: z.string().refine((v) => v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0, 'wform.interestRate'),
  term_months: z.string().refine((v) => /^\d+$/.test(v) && Number(v) > 0, 'wform.termMonths'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'wform.startDate'),
  maturity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'wform.maturityDateCalc'),
  linked_wallet_id: z.string(),
  fund_from_wallet: z.boolean(),
  notes: z.string().trim().max(1000)
})
type Values = z.infer<typeof schema>

export function FixedDepositFormSheet({ open, onOpenChange, wallets, migrationMode, walletsLoading = false }: { open: boolean; onOpenChange: (o: boolean) => void; wallets: Wallet[]; migrationMode: boolean; walletsLoading?: boolean }) {
  const { t } = useT()
  const create = useCreateFixedDeposit()
  const active = useMemo(() => wallets.filter((w) => Number(w.is_active) === 1), [wallets])
  const defaults = (): Values => ({ fd_number: '', bank_name: '', principal: '', interest_rate: '', term_months: '', start_date: todayIso(), maturity_date: '', linked_wallet_id: '', fund_from_wallet: !migrationMode, notes: '' })
  const { register, control, handleSubmit, reset, watch, setValue, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) as Resolver<Values>, defaultValues: defaults() })
  const msg = (k?: string) => (k ? t(k as TranslationKey) : undefined)
  useEffect(() => {
    if (open) reset(defaults())
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const startDate = watch('start_date')
  const term = watch('term_months')
  const linked = watch('linked_wallet_id')
  const fund = watch('fund_from_wallet')
  // Maturity follows start + term until the user edits it by hand
  useEffect(() => {
    if (startDate && /^\d+$/.test(term)) setValue('maturity_date', addMonths(startDate, Number(term)), { shouldDirty: true })
  }, [startDate, term, setValue])
  const selectedWallet = active.find((w) => String(w.id) === linked)
  const willFund = fund && !migrationMode && Boolean(linked)

  const onSubmit = handleSubmit(async (v) => {
    const principal = rupeesToCents(v.principal)
    if (!migrationMode && v.fund_from_wallet && !v.linked_wallet_id) return setError('linked_wallet_id', { type: 'required', message: 'wform.selectFundWallet' })
    if (willFund && selectedWallet && principal > selectedWallet.balance) return setError('principal', { type: 'funds', message: 'wform.fdInsufficient' })
    try {
      await create.mutateAsync({
        fd_number: v.fd_number.trim(),
        bank_name: v.bank_name.trim(),
        principal,
        interest_rate: Number(v.interest_rate),
        term_months: Number(v.term_months),
        start_date: v.start_date,
        maturity_date: v.maturity_date,
        notes: v.notes.trim(),
        linked_wallet_id: v.linked_wallet_id ? Number(v.linked_wallet_id) : null,
        fund_from_wallet: willFund
      })
      toast.success(t('wform.fdRegistered'))
      onOpenChange(false)
    } catch (e) {
      toast.error(errorMessage(e, t('wform.fdSaveFailed')))
    }
  })

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={t('wform.fdTitle')} description={t('wallet.investmentDesc')} dirty={formState.isDirty} submitting={create.isPending} submitLabel={t('wform.registerInvestment')} onSubmit={onSubmit}>
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('wform.fdNumberRef')} required error={msg(formState.errors.fd_number?.message)}>
            {({ id, invalid }) => <Input id={id} autoFocus placeholder={t('wform.fdNumberPlaceholder')} className="font-mono" aria-invalid={invalid || undefined} {...register('fd_number')} />}
          </Field>
          <Field label={t('mform.bankName')} required error={msg(formState.errors.bank_name?.message)}>
            {({ id, invalid }) => <Input id={id} placeholder={t('wform.bankPlaceholder')} aria-invalid={invalid || undefined} {...register('bank_name')} />}
          </Field>
          <Field label={t('wform.principalAmount')} required error={msg(formState.errors.principal?.message)}>
            {({ id, invalid }) => <Controller control={control} name="principal" render={({ field }) => <RupeeInput id={id} value={field.value} onChange={field.onChange} aria-invalid={invalid || undefined} />} />}
          </Field>
          <Field label={t('wform.interestRate')} required error={msg(formState.errors.interest_rate?.message)}>
            {({ id, invalid }) => <Input id={id} type="number" step="0.1" min="0" inputMode="decimal" placeholder={t('wform.ratePlaceholder')} className="tnum" aria-invalid={invalid || undefined} {...register('interest_rate')} />}
          </Field>
          <Field label={t('wform.termMonths')} required error={msg(formState.errors.term_months?.message)}>
            {({ id, invalid }) => <Input id={id} type="number" min="1" step="1" inputMode="numeric" placeholder={t('wform.termPlaceholder')} className="tnum" aria-invalid={invalid || undefined} {...register('term_months')} />}
          </Field>
          <Field label={t('wform.startDate')} required error={msg(formState.errors.start_date?.message)}>
            {({ id }) => <Input id={id} type="date" {...register('start_date')} />}
          </Field>
          <Field label={t('wform.maturityDateCalc')} required error={msg(formState.errors.maturity_date?.message)} className="sm:col-span-2">
            {({ id }) => <Input id={id} type="date" {...register('maturity_date')} />}
          </Field>
        </div>

        <FormSection title={t('wform.linkedWallet')}>
          <Field label={t('wform.linkedWallet')} required={!migrationMode} error={msg(formState.errors.linked_wallet_id?.message)} description={migrationMode ? t('wform.fdMigrationHint') : t('wform.fdWithdrawHint')}>
            {({ id, invalid }) => (
              <NativeSelect id={id} disabled={walletsLoading} aria-busy={walletsLoading || undefined} aria-invalid={invalid || undefined} {...register('linked_wallet_id')}>
                <option value="">{walletsLoading ? t('common.loading') : migrationMode ? t('wform.optNoneFd') : t('wform.selectWallet')}</option>
                {active.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({formatCurrency(w.balance)})
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          {!migrationMode && (
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-primary" {...register('fund_from_wallet')} />
              <span>{t('wform.fdDeductLabel')}</span>
            </label>
          )}
        </FormSection>

        <Field label={t('wform.additionalNotes')}>{({ id }) => <Textarea id={id} rows={2} placeholder={t('wform.notesPlaceholder')} {...register('notes')} />}</Field>
      </div>
    </FormSheet>
  )
}
