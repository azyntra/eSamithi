import { useEffect, useMemo, useRef } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Field } from '@/components/form/Field'
import { FormSheet } from '@/components/form/FormSheet'
import { MemberPicker } from '@/components/MemberPicker'
import { RupeeInput, centsToRupees, rupeesToCents } from '@/components/RupeeInput'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useMembersSlim } from '@/features/members/queries'
import { useExpenseTypes } from '@/features/settings/queries'
import { useWallets } from '@/features/wallet/queries'
import { errorMessage } from '@/lib/api/errors'
import { formatCurrency } from '@/lib/format/currency'
import { todayIso } from '@/lib/format/dates'
import { useT, type TranslationKey } from '@/lib/i18n'
import { useCreateExpense } from '../queries'
import { SOURCE_KEY } from '../receipts'
import { BILL_CATEGORIES, MEMBER_BENEFIT_CODES, type ExpensePayload, type ExpenseTransaction } from '../types'

const schema = z
  .object({
    expense_type_id: z.string().min(1, 'eform.selectTypeFirst'),
    recipient_type: z.enum(['Member', 'Vendor']),
    member_id: z.number().nullable(),
    vendor_name: z.string().trim().max(255),
    bill_category: z.string(),
    amount: z.string().refine((v) => rupeesToCents(v) > 0, 'wform.amountGtZero'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'common.date'),
    payment_method: z.enum(['Cash', 'Bank Transfer', 'Cheque']),
    wallet_id: z.string().min(1, 'common.pleaseWallet'),
    voucher_no: z.string().trim().max(100),
    notes: z.string().trim().max(1000),
    code: z.string()
  })
  .superRefine((v, ctx) => {
    const isBenefit = MEMBER_BENEFIT_CODES.includes(v.code)
    const isBills = v.code === 'bills_operational'
    const isOther = v.code === 'other_expense'
    const isGeneric = v.code === ''
    const memberRequired = isBenefit || ((isOther || isGeneric) && v.recipient_type === 'Member')
    if (memberRequired && !v.member_id) ctx.addIssue({ code: 'custom', path: ['member_id'], message: 'common.pleaseMember' })
    if (isBills && !v.vendor_name) ctx.addIssue({ code: 'custom', path: ['vendor_name'], message: 'eform.enterPayeeBills' })
    if ((isOther || isGeneric) && v.recipient_type === 'Vendor' && !v.vendor_name) ctx.addIssue({ code: 'custom', path: ['vendor_name'], message: 'eform.enterPayeeName' })
    if (isOther && !v.notes) ctx.addIssue({ code: 'custom', path: ['notes'], message: 'eform.enterDescExpense' })
  })
type Values = z.infer<typeof schema>

export function ExpenseFormSheet({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated?: (tx: ExpenseTransaction) => void }) {
  const { t } = useT()
  const types = useExpenseTypes()
  const wallets = useWallets()
  const members = useMembersSlim()
  const create = useCreateExpense()
  const today = todayIso()
  const activeTypes = useMemo(() => (types.data ?? []).filter((et) => Number(et.is_active) === 1), [types.data])
  const activeWallets = useMemo(() => (wallets.data ?? []).filter((w) => Number(w.is_active) === 1), [wallets.data])

  const defaults = (): Values => ({ expense_type_id: '', recipient_type: 'Vendor', member_id: null, vendor_name: '', bill_category: '', amount: '', date: today, payment_method: 'Cash', wallet_id: '', voucher_no: '', notes: '', code: '' })
  const form = useForm<Values>({ resolver: zodResolver(schema) as Resolver<Values>, defaultValues: defaults(), mode: 'onSubmit' })
  const { register, control, handleSubmit, watch, setValue, setError, reset, formState } = form
  const { errors, isDirty } = formState
  const msg = (k?: string) => (k ? t(k as TranslationKey) : undefined)

  useEffect(() => {
    if (open) reset(defaults())
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const typeId = watch('expense_type_id')
  const selectedType = activeTypes.find((et) => String(et.id) === typeId)
  const code = selectedType?.code || ''
  const isBenefit = MEMBER_BENEFIT_CODES.includes(code)
  const isBills = code === 'bills_operational'
  const isOther = code === 'other_expense'
  const isGeneric = code === '' && selectedType !== undefined
  const recipientType = watch('recipient_type')
  const memberRequired = isBenefit || ((isOther || isGeneric) && recipientType === 'Member')
  const walletId = watch('wallet_id')
  const selectedWallet = activeWallets.find((w) => String(w.id) === walletId)

  const lastType = useRef<string>('')
  useEffect(() => {
    if (typeId === lastType.current) return
    lastType.current = typeId
    if (!typeId) return
    setValue('code', code)
    setValue('amount', selectedType && selectedType.standard_payout > 0 ? centsToRupees(selectedType.standard_payout) : '')
    setValue('member_id', null)
    setValue('vendor_name', '')
    setValue('bill_category', isBills ? BILL_CATEGORIES[0] : '')
    setValue('recipient_type', isBenefit ? 'Member' : 'Vendor')
  }, [typeId, code, selectedType, isBills, isBenefit, setValue])

  const onSubmit = handleSubmit(async (v) => {
    const amount = rupeesToCents(v.amount)
    if (selectedWallet && amount > selectedWallet.balance) {
      setError('amount', { type: 'funds', message: 'lform.insufficientWallet' })
      return
    }
    const payload: ExpensePayload = {
      date: v.date,
      recipient_type: memberRequired ? 'Member' : 'Vendor',
      member_id: memberRequired ? v.member_id : null,
      vendor_name: memberRequired ? null : v.vendor_name.trim(),
      expense_type_id: Number(v.expense_type_id),
      amount,
      payment_method: v.payment_method,
      wallet_id: Number(v.wallet_id),
      voucher_no: v.voucher_no.trim() || null,
      notes: v.bill_category ? `${v.bill_category}${v.notes.trim() ? ` — ${v.notes.trim()}` : ''}` : v.notes.trim() || null
    }
    try {
      const r = await create.mutateAsync(payload)
      const member = payload.member_id ? (members.data ?? []).find((m) => m.id === payload.member_id) : null
      onCreated?.({
        id: r.id,
        date: payload.date,
        recipient_type: payload.recipient_type,
        member_id: payload.member_id,
        vendor_name: payload.vendor_name,
        expense_type_id: payload.expense_type_id,
        amount: payload.amount,
        quantity: 1,
        unit_price: 0,
        death_reference: null,
        payment_method: payload.payment_method,
        wallet_id: payload.wallet_id,
        voucher_no: payload.voucher_no,
        notes: payload.notes,
        status: 'Active',
        void_reason: null,
        created_at: new Date().toISOString(),
        wallet_name: selectedWallet?.name,
        expense_type_name: selectedType?.name,
        expense_type_code: selectedType?.code ?? null,
        recipient_name: member?.full_name ?? payload.vendor_name ?? undefined,
        member_nic: member?.nic ?? null
      })
      onOpenChange(false)
    } catch (e) {
      toast.error(errorMessage(e, t('eform.recordFailed')))
    }
  })

  const src = (s: string) => (SOURCE_KEY[s] ? t(SOURCE_KEY[s]!) : s)

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={t('eform.title')} description={t('ledger.expenseSubtitle')} dirty={isDirty} submitting={create.isPending} submitLabel={create.isPending ? t('lform.recording') : t('eform.title')} onSubmit={onSubmit}>
      <div className="grid gap-5">
        <Field label={t('eform.expenseType')} required error={msg(errors.expense_type_id?.message)} description={isBenefit && selectedType && selectedType.standard_payout > 0 ? t('eform.defaultPrefilled') : undefined}>
          {({ id, invalid }) => (
            <NativeSelect id={id} autoFocus disabled={types.isPending} aria-busy={types.isPending || undefined} aria-invalid={invalid || undefined} {...register('expense_type_id')}>
              <option value="">{t('eform.selectExpenseType')}</option>
              {activeTypes.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        {typeId && (
          <>
            {(isOther || isGeneric) && (
              <Field label={t('eform.recipientType')} required>
                {({ id }) => (
                  <NativeSelect id={id} {...register('recipient_type')}>
                    <option value="Vendor">{t('eform.vendorServiceOther')}</option>
                    <option value="Member">{t('iform.registeredMember')}</option>
                  </NativeSelect>
                )}
              </Field>
            )}
            {memberRequired && (
              <Field label={t('common.member')} required error={msg(errors.member_id?.message)}>
                {({ id, invalid }) => <Controller control={control} name="member_id" render={({ field }) => <MemberPicker id={id} value={field.value} onChange={field.onChange} invalid={invalid} />} />}
              </Field>
            )}
            {isBills && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('eform.billCategory')} required>
                  {({ id }) => (
                    <NativeSelect id={id} {...register('bill_category')}>
                      {BILL_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {src(c)}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </Field>
                <Field label={t('eform.payee')} required error={msg(errors.vendor_name?.message)}>
                  {({ id, invalid }) => <Input id={id} placeholder={t('eform.payeePlaceholderBills')} aria-invalid={invalid || undefined} {...register('vendor_name')} />}
                </Field>
              </div>
            )}
            {(isOther || isGeneric) && recipientType === 'Vendor' && (
              <Field label={t('eform.payeeRecipientName')} required error={msg(errors.vendor_name?.message)}>
                {({ id, invalid }) => <Input id={id} placeholder={t('eform.payeePlaceholderOther')} aria-invalid={invalid || undefined} {...register('vendor_name')} />}
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('wform.amountRs')} required error={msg(errors.amount?.message)} description={selectedWallet ? `${t('ledger.wallet')}: ${formatCurrency(selectedWallet.balance)}` : undefined}>
                {({ id, invalid }) => <Controller control={control} name="amount" render={({ field }) => <RupeeInput id={id} tone="expense" value={field.value} onChange={field.onChange} aria-invalid={invalid || undefined} />} />}
              </Field>
              <Field label={t('common.date')} required error={msg(errors.date?.message)}>
                {({ id }) => <Input id={id} type="date" max={today} {...register('date')} />}
              </Field>
              <Field label={t('lform.paymentMethod')} required>
                {({ id }) => (
                  <NativeSelect id={id} {...register('payment_method')}>
                    <option value="Cash">{t('lform.pmCash')}</option>
                    <option value="Bank Transfer">{t('lform.pmBankTransfer')}</option>
                    <option value="Cheque">{t('lform.pmCheque')}</option>
                  </NativeSelect>
                )}
              </Field>
              <Field label={t('eform.deductFromWallet')} required error={msg(errors.wallet_id?.message)}>
                {({ id, invalid }) => (
                  <NativeSelect id={id} aria-invalid={invalid || undefined} {...register('wallet_id')}>
                    <option value="">{t('wform.selectWallet')}</option>
                    {activeWallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} · {formatCurrency(w.balance)}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field label={t('eform.voucherNumber')}>{({ id }) => <Input id={id} placeholder={t('eform.voucherPlaceholder')} className="font-mono" {...register('voucher_no')} />}</Field>
              <Field label={isOther ? t('iform.description') : t('lform.notesRef')} required={isOther} error={msg(errors.notes?.message)}>
                {({ id, invalid }) => <Input id={id} placeholder={isOther ? t('eform.descPlaceholder') : t('eform.notesPlaceholder')} aria-invalid={invalid || undefined} {...register('notes')} />}
              </Field>
            </div>
          </>
        )}
      </div>
    </FormSheet>
  )
}
