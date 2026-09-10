import { useEffect } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Field } from '@/components/form/Field'
import { FormSheet } from '@/components/form/FormSheet'
import { RupeeInput, rupeesToCents } from '@/components/RupeeInput'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { errorMessage } from '@/lib/api/errors'
import { useT, type TranslationKey } from '@/lib/i18n'
import { useCreateWallet } from '../queries'

const schema = z.object({
  name: z.string().trim().min(1, 'wallet.walletName').max(255),
  wallet_type: z.enum(['Cash', 'Bank']),
  opening_balance: z.string()
})
type Values = z.infer<typeof schema>

export function WalletFormSheet({ open, onOpenChange, allowOpeningBalance }: { open: boolean; onOpenChange: (o: boolean) => void; allowOpeningBalance: boolean }) {
  const { t } = useT()
  const create = useCreateWallet()
  const { register, control, handleSubmit, reset, formState } = useForm<Values>({ resolver: zodResolver(schema) as Resolver<Values>, defaultValues: { name: '', wallet_type: 'Cash', opening_balance: '' } })
  const msg = (k?: string) => (k ? t(k as TranslationKey) : undefined)
  useEffect(() => {
    if (open) reset({ name: '', wallet_type: 'Cash', opening_balance: '' })
  }, [open, reset])

  const onSubmit = handleSubmit(async (v) => {
    try {
      await create.mutateAsync({ name: v.name.trim(), wallet_type: v.wallet_type, opening_balance: allowOpeningBalance ? rupeesToCents(v.opening_balance) : 0 })
      toast.success(t('wform.walletCreated'))
      onOpenChange(false)
    } catch (e) {
      toast.error(errorMessage(e, t('wform.walletAddFailed')))
    }
  })

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={t('wform.addWalletTitle')} dirty={formState.isDirty} submitting={create.isPending} submitLabel={t('wform.createWallet')} onSubmit={onSubmit}>
      <div className="grid gap-5">
        <Field label={t('wallet.walletName')} required error={msg(formState.errors.name?.message)}>
          {({ id, invalid }) => <Input id={id} autoFocus placeholder={t('wform.walletNamePlaceholder')} aria-invalid={invalid || undefined} {...register('name')} />}
        </Field>
        <Field label={t('wform.walletType')} required>
          {({ id }) => (
            <NativeSelect id={id} {...register('wallet_type')}>
              <option value="Cash">{t('wform.optCash')}</option>
              <option value="Bank">{t('wform.optBank')}</option>
            </NativeSelect>
          )}
        </Field>
        {allowOpeningBalance && (
          <Field label={t('wform.openingBalance')} description={t('wform.openingBalanceHint')}>
            {({ id }) => <Controller control={control} name="opening_balance" render={({ field }) => <RupeeInput id={id} tone="income" value={field.value} onChange={field.onChange} />} />}
          </Field>
        )}
      </div>
    </FormSheet>
  )
}
