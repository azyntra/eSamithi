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
import { useIncomeTypes } from '@/features/settings/queries'
import { useAssets, useWallets } from '@/features/wallet/queries'
import { errorMessage } from '@/lib/api/errors'
import { todayIso } from '@/lib/format/dates'
import { useT, type TranslationKey } from '@/lib/i18n'
import { useCreateIncome } from '../queries'
import { SOURCE_KEY } from '../receipts'
import { ASSET_SOURCES, BUILDING_SOURCES, HIDDEN_INCOME_CODES, MEMBER_INCOME_CODES, ONE_TIME_INCOME_CODES, type IncomePayload, type IncomeTransaction } from '../types'

const schema = z
  .object({
    income_type_id: z.string().min(1, 'iform.selectTypeFirst'),
    payer_type: z.enum(['Member', 'Guest']),
    member_id: z.number().nullable(),
    guest_name: z.string().trim().max(255),
    fine_reason: z.string().trim().max(255),
    income_source: z.string(),
    asset_id: z.string(),
    amount: z.string().refine((v) => rupeesToCents(v) > 0, 'wform.amountGtZero'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'common.date'),
    payment_method: z.enum(['Cash', 'Bank Transfer', 'Cheque']),
    wallet_id: z.string().min(1, 'common.pleaseWallet'),
    notes: z.string().trim().max(1000),
    code: z.string() // derived: the selected type's code (kept in the form for validation)
  })
  .superRefine((v, ctx) => {
    const isMemberType = MEMBER_INCOME_CODES.includes(v.code)
    const isOther = v.code === 'other_income'
    const isGeneric = v.code === ''
    const memberRequired = isMemberType || ((isOther || isGeneric) && v.payer_type === 'Member')
    if (memberRequired && !v.member_id) ctx.addIssue({ code: 'custom', path: ['member_id'], message: 'common.pleaseMember' })
    if ((isOther || isGeneric) && v.payer_type === 'Guest' && !v.guest_name) ctx.addIssue({ code: 'custom', path: ['guest_name'], message: 'iform.enterPayerName' })
    if (v.code === 'fine' && !v.fine_reason) ctx.addIssue({ code: 'custom', path: ['fine_reason'], message: 'iform.enterFineReason' })
    if (v.code === 'asset_income' && !v.asset_id) ctx.addIssue({ code: 'custom', path: ['asset_id'], message: 'iform.selectAssetIncome' })
    if (isOther && !v.notes) ctx.addIssue({ code: 'custom', path: ['notes'], message: 'iform.enterDescIncome' })
  })
type Values = z.infer<typeof schema>

interface IncomeFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMemberId?: number | null
  onCreated?: (tx: IncomeTransaction) => void
}

export function IncomeFormSheet({ open, onOpenChange, initialMemberId = null, onCreated }: IncomeFormSheetProps) {
  const { t } = useT()
  const types = useIncomeTypes()
  const wallets = useWallets()
  const assets = useAssets()
  const members = useMembersSlim()
  const create = useCreateIncome()
  const today = todayIso()

  const activeTypes = useMemo(() => (types.data ?? []).filter((it) => Number(it.is_active) === 1 && !HIDDEN_INCOME_CODES.includes(it.code || '')), [types.data])
  const activeWallets = useMemo(() => (wallets.data ?? []).filter((w) => Number(w.is_active) === 1), [wallets.data])

  const defaults = (): Values => ({
    income_type_id: '', payer_type: 'Member', member_id: initialMemberId, guest_name: '', fine_reason: '', income_source: '', asset_id: '',
    amount: '', date: today, payment_method: 'Cash', wallet_id: '', notes: '', code: ''
  })
  const form = useForm<Values>({ resolver: zodResolver(schema) as Resolver<Values>, defaultValues: defaults(), mode: 'onSubmit' })
  const { register, control, handleSubmit, watch, setValue, reset, formState } = form
  const { errors, isDirty } = formState
  const msg = (k?: string) => (k ? t(k as TranslationKey) : undefined)

  useEffect(() => {
    if (open) reset(defaults())
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const typeId = watch('income_type_id')
  const selectedType = activeTypes.find((it) => String(it.id) === typeId)
  const code = selectedType?.code || ''
  const isMemberType = MEMBER_INCOME_CODES.includes(code)
  const isFine = code === 'fine'
  const isFuneralFood = code === 'funeral_food_collection'
  const isBankInterest = code === 'bank_interest'
  const isBuilding = code === 'building_income'
  const isAsset = code === 'asset_income'
  const isOther = code === 'other_income'
  const isGeneric = code === '' && selectedType !== undefined
  const payerType = watch('payer_type')
  const memberRequired = isMemberType || ((isOther || isGeneric) && payerType === 'Member')

  // The type drives the rest of the form: reset adaptive fields on change (desktop parity)
  const lastType = useRef<string>('')
  useEffect(() => {
    if (typeId === lastType.current) return
    lastType.current = typeId
    if (!typeId) return
    setValue('code', code)
    setValue('amount', selectedType && selectedType.standard_amount > 0 ? centsToRupees(selectedType.standard_amount) : '')
    setValue('member_id', initialMemberId)
    setValue('guest_name', '')
    setValue('asset_id', '')
    setValue('fine_reason', '')
    setValue('income_source', isBuilding ? BUILDING_SOURCES[0] : isAsset ? ASSET_SOURCES[0] : '')
    setValue('payer_type', isMemberType || isGeneric ? 'Member' : 'Guest')
  }, [typeId, code, selectedType, isBuilding, isAsset, isMemberType, isGeneric, initialMemberId, setValue])

  const onSubmit = handleSubmit(async (v) => {
    const effectivePayerType: 'Member' | 'Guest' = memberRequired ? 'Member' : 'Guest'
    const guest = v.guest_name.trim() || (v.income_source ? v.income_source : selectedType?.name || 'External')
    const notes = v.income_source && !isAsset ? `${v.income_source}${v.notes.trim() ? ` — ${v.notes.trim()}` : ''}` : v.notes.trim()
    const payload: IncomePayload = {
      date: v.date,
      payer_type: effectivePayerType,
      member_id: effectivePayerType === 'Member' ? v.member_id : null,
      guest_name: effectivePayerType === 'Guest' ? guest : null,
      income_type_id: Number(v.income_type_id),
      amount: rupeesToCents(v.amount),
      fine_reason: isFine ? v.fine_reason.trim() : null,
      payment_method: v.payment_method,
      wallet_id: Number(v.wallet_id),
      asset_id: isAsset && v.asset_id ? Number(v.asset_id) : null,
      notes: notes || null
    }
    try {
      const r = await create.mutateAsync(payload)
      const member = payload.member_id ? (members.data ?? []).find((m) => m.id === payload.member_id) : null
      const wallet = activeWallets.find((w) => w.id === payload.wallet_id)
      onCreated?.({
        id: r.id,
        date: payload.date,
        payer_type: payload.payer_type,
        member_id: payload.member_id,
        guest_name: payload.guest_name,
        income_type_id: payload.income_type_id,
        amount: payload.amount,
        principal_part: 0,
        interest_part: 0,
        months_covered: null,
        fine_reason: payload.fine_reason,
        payment_method: payload.payment_method,
        wallet_id: payload.wallet_id,
        asset_id: payload.asset_id,
        loan_id: null,
        notes: payload.notes,
        status: 'Active',
        void_reason: null,
        created_at: new Date().toISOString(),
        wallet_name: wallet?.name,
        income_type_name: selectedType?.name,
        income_type_code: selectedType?.code ?? null,
        payer_name: member?.full_name ?? payload.guest_name ?? undefined,
        member_nic: member?.nic ?? null
      })
      onOpenChange(false)
    } catch (e) {
      toast.error(errorMessage(e, t('iform.recordFailed')))
    }
  })

  const src = (s: string) => (SOURCE_KEY[s] ? t(SOURCE_KEY[s]!) : s)

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={t('iform.title')} description={t('ledger.incomeSubtitle')} dirty={isDirty} submitting={create.isPending} submitLabel={create.isPending ? t('lform.recording') : t('iform.title')} onSubmit={onSubmit}>
      <div className="grid gap-5">
        <Field label={t('iform.incomeType')} required error={msg(errors.income_type_id?.message)} description={ONE_TIME_INCOME_CODES.includes(code) ? t('iform.oneTimeNote', { name: selectedType?.name || '' }) : isFuneralFood ? t('iform.funeralFoodNote') : undefined}>
          {({ id, invalid }) => (
            <NativeSelect id={id} autoFocus disabled={types.isPending} aria-busy={types.isPending || undefined} aria-invalid={invalid || undefined} {...register('income_type_id')}>
              <option value="">{t('iform.selectIncomeType')}</option>
              {activeTypes.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        {typeId && (
          <>
            {(isOther || isGeneric) && (
              <Field label={t('iform.payerType')} required>
                {({ id }) => (
                  <NativeSelect id={id} {...register('payer_type')}>
                    <option value="Member">{t('iform.registeredMember')}</option>
                    <option value="Guest">{t('iform.guestExternal')}</option>
                  </NativeSelect>
                )}
              </Field>
            )}
            {memberRequired && (
              <Field label={t('common.member')} required error={msg(errors.member_id?.message)}>
                {({ id, invalid }) => <Controller control={control} name="member_id" render={({ field }) => <MemberPicker id={id} value={field.value} onChange={field.onChange} invalid={invalid} />} />}
              </Field>
            )}
            {(isOther || isGeneric) && payerType === 'Guest' && (
              <Field label={t('iform.payerName')} required error={msg(errors.guest_name?.message)}>
                {({ id, invalid }) => <Input id={id} placeholder={t('iform.payerNamePlaceholder')} aria-invalid={invalid || undefined} {...register('guest_name')} />}
              </Field>
            )}
            {(isFuneralFood || isBankInterest || isBuilding) && (
              <Field label={<>{t('iform.receivedFrom')} <span className="font-normal text-muted-foreground">{t('iform.optional')}</span></>}>
                {({ id }) => <Input id={id} placeholder={isBankInterest ? t('iform.phBankInterest') : isBuilding ? t('iform.phBuilding') : t('iform.phFuneralFood')} {...register('guest_name')} />}
              </Field>
            )}
            {isFine && (
              <Field label={t('iform.reasonForFine')} required error={msg(errors.fine_reason?.message)}>
                {({ id, invalid }) => <Input id={id} placeholder={t('iform.fineReasonPlaceholder')} aria-invalid={invalid || undefined} {...register('fine_reason')} />}
              </Field>
            )}
            {isBuilding && (
              <Field label={t('iform.buildingSource')} required>
                {({ id }) => (
                  <NativeSelect id={id} {...register('income_source')}>
                    {BUILDING_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {src(s)}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            )}
            {isAsset && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('iform.assetSource')} required>
                  {({ id }) => (
                    <NativeSelect id={id} {...register('income_source')}>
                      {ASSET_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {src(s)}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </Field>
                <Field label={t('iform.asset')} required error={msg(errors.asset_id?.message)}>
                  {({ id, invalid }) => (
                    <NativeSelect id={id} aria-invalid={invalid || undefined} {...register('asset_id')}>
                      <option value="">{t('iform.selectAssetOpt')}</option>
                      {(assets.data ?? []).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </Field>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('wform.amountRs')} required error={msg(errors.amount?.message)}>
                {({ id, invalid }) => <Controller control={control} name="amount" render={({ field }) => <RupeeInput id={id} tone="income" value={field.value} onChange={field.onChange} aria-invalid={invalid || undefined} />} />}
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
              <Field label={t('lform.depositToWallet')} required error={msg(errors.wallet_id?.message)}>
                {({ id, invalid }) => (
                  <NativeSelect id={id} aria-invalid={invalid || undefined} {...register('wallet_id')}>
                    <option value="">{t('wform.selectWallet')}</option>
                    {activeWallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            </div>
            <Field label={isOther ? t('iform.description') : t('lform.notesRef')} required={isOther} error={msg(errors.notes?.message)}>
              {({ id, invalid }) => <Input id={id} placeholder={isOther ? t('iform.descPlaceholder') : t('iform.notesPlaceholder')} aria-invalid={invalid || undefined} {...register('notes')} />}
            </Field>
          </>
        )}
      </div>
    </FormSheet>
  )
}
