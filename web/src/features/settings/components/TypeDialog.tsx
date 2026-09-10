import { useEffect } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Field } from '@/components/form/Field'
import { RupeeInput, centsToRupees, rupeesToCents } from '@/components/RupeeInput'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { errorMessage } from '@/lib/api/errors'
import { useT, type TranslationKey } from '@/lib/i18n'
import type { ExpenseType, IncomeType } from '../api'
import { useSaveExpenseType, useSaveIncomeType } from '../queries'

// The six groups the desktop always offered. A seeded system type may use its
// own vocabulary, so its group is added to the list when editing — otherwise
// saving would silently rewrite it.
const STANDARD_GROUPS = ['Subscription', 'Fine', 'Loan', 'Investment', 'Donation', 'Rental']

const schema = z.object({
  name: z.string().trim().min(1, 'common.name').max(255),
  amount: z.string(),
  category_group: z.string()
})
type Values = z.infer<typeof schema>

interface TypeDialogProps {
  kind: 'income' | 'expense'
  // undefined = closed, null = create, object = edit
  type: IncomeType | ExpenseType | null | undefined
  onOpenChange: (open: boolean) => void
}

export function TypeDialog({ kind, type, onOpenChange }: TypeDialogProps) {
  const { t } = useT()
  const saveIncome = useSaveIncomeType()
  const saveExpense = useSaveExpenseType()
  const save = kind === 'income' ? saveIncome : saveExpense
  const open = type !== undefined
  const editing = Boolean(type)
  const isSystem = Boolean(type?.code)
  const asIncome = type && 'category_group' in type ? type : null

  const { register, control, handleSubmit, reset, watch, formState } = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: { name: '', amount: '', category_group: 'Donation' }
  })
  const msg = (k?: string) => (k ? t(k as TranslationKey) : undefined)

  useEffect(() => {
    if (!open) return
    const amount = type ? ('standard_amount' in type ? type.standard_amount : type.standard_payout) : 0
    reset({ name: type?.name ?? '', amount: amount ? centsToRupees(amount) : '', category_group: asIncome?.category_group ?? 'Donation' })
  }, [open, type, asIncome, reset])

  const group = watch('category_group')
  const groups = STANDARD_GROUPS.includes(group) ? STANDARD_GROUPS : [...STANDARD_GROUPS, group]

  const onSubmit = handleSubmit(async (v) => {
    try {
      if (kind === 'income') {
        const payload: { name: string; standard_amount: number; category_group?: string } = { name: v.name.trim(), standard_amount: rupeesToCents(v.amount) }
        // A system type keeps its group: the adaptive forms branch on it
        if (!isSystem) payload.category_group = v.category_group
        await saveIncome.mutateAsync({ id: type?.id, payload })
      } else {
        await saveExpense.mutateAsync({ id: type?.id, payload: { name: v.name.trim(), standard_payout: rupeesToCents(v.amount) } })
      }
      toast.success(editing ? t('itype.updated') : t('itype.added'))
      onOpenChange(false)
    } catch (e) {
      toast.error(errorMessage(e, t(editing ? 'itype.updateFailed' : 'itype.addFailed')))
    }
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? t('itype.editTitle') : t('itype.title')}</DialogTitle>
            <DialogDescription>{kind === 'income' ? t('settings.incomeTypesDesc') : t('settings.expenseTypesDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label={t('common.name')} required error={msg(formState.errors.name?.message)}>
              {({ id, invalid }) => <Input id={id} autoFocus aria-invalid={invalid || undefined} {...register('name')} />}
            </Field>
            <Field label={kind === 'income' ? t('settings.defaultAmount') : t('settings.standardPayout')}>
              {({ id }) => <Controller control={control} name="amount" render={({ field }) => <RupeeInput id={id} value={field.value} onChange={field.onChange} />} />}
            </Field>
            {kind === 'income' && (
              <Field label={t('settings.categoryGroup')} description={isSystem ? t('settings.systemHint') : undefined}>
                {({ id, describedBy }) => (
                  <NativeSelect id={id} disabled={isSystem} aria-describedby={describedBy} {...register('category_group')}>
                    {groups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
