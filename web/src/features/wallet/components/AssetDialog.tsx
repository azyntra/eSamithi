import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Box } from 'lucide-react'
import { toast } from 'sonner'
import { Field } from '@/components/form/Field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api/errors'
import { useT, type TranslationKey } from '@/lib/i18n'
import type { PhysicalAsset } from '../api'
import { useSaveAsset } from '../queries'

const schema = z.object({
  name: z.string().trim().min(1, 'wallet.assetName').max(255),
  quantity: z.string().refine((v) => /^\d+$/.test(v), 'wform.totalQuantity'),
  description: z.string().trim().max(1000)
})
type Values = z.infer<typeof schema>

// `asset` undefined = closed, null = create, object = edit
export function AssetDialog({ asset, onOpenChange }: { asset: PhysicalAsset | null | undefined; onOpenChange: (o: boolean) => void }) {
  const { t } = useT()
  const save = useSaveAsset()
  const open = asset !== undefined
  const editing = Boolean(asset)
  const { register, handleSubmit, reset, formState } = useForm<Values>({ resolver: zodResolver(schema) as Resolver<Values>, defaultValues: { name: '', quantity: '1', description: '' } })
  const msg = (k?: string) => (k ? t(k as TranslationKey) : undefined)
  useEffect(() => {
    if (open) reset({ name: asset?.name ?? '', quantity: asset ? String(asset.quantity) : '1', description: asset?.description ?? '' })
  }, [open, asset, reset])

  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ id: asset?.id, payload: { name: v.name.trim(), quantity: Number(v.quantity), description: v.description.trim() } })
      toast.success(editing ? t('wform.assetUpdated') : t('wform.assetRegistered'))
      onOpenChange(false)
    } catch (e) {
      toast.error(errorMessage(e, t('wform.assetSaveFailed')))
    }
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Box className="size-5 text-primary" /> {editing ? t('wform.editAssetTitle') : t('wform.registerAssetTitle')}
            </DialogTitle>
            <DialogDescription>{t('wallet.inventoryDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label={t('wallet.assetName')} required error={msg(formState.errors.name?.message)}>
              {({ id, invalid }) => <Input id={id} autoFocus placeholder={t('wform.assetNamePlaceholder')} aria-invalid={invalid || undefined} {...register('name')} />}
            </Field>
            <Field label={t('wform.totalQuantity')} required error={msg(formState.errors.quantity?.message)}>
              {({ id, invalid }) => <Input id={id} type="number" min="0" step="1" inputMode="numeric" className="tnum" aria-invalid={invalid || undefined} {...register('quantity')} />}
            </Field>
            <Field label={t('wallet.descriptionCondition')}>{({ id }) => <Textarea id={id} rows={3} placeholder={t('wform.assetDescPlaceholder')} {...register('description')} />}</Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {editing ? t('wform.saveChanges') : t('wform.registerAsset')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
