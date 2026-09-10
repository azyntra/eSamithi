import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { toast } from 'sonner'
import { RupeeInput, rupeesToCents } from '@/components/RupeeInput'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Spinner } from '@/components/Spinner'
import { errorMessage } from '@/lib/api/errors'
import { formatCurrency } from '@/lib/format/currency'
import { useT } from '@/lib/i18n'
import type { Wallet } from '../api'
import { useTransfer } from '../queries'

export function TransferDialog({ open, onOpenChange, wallets, loading = false }: { open: boolean; onOpenChange: (o: boolean) => void; wallets: Wallet[]; loading?: boolean }) {
  const { t } = useT()
  const transfer = useTransfer()
  const active = useMemo(() => wallets.filter((w) => Number(w.is_active) === 1), [wallets])
  const [fromId, setFromId] = useState<number>(0)
  const [toId, setToId] = useState<number>(0)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setFromId(active[0]?.id ?? 0)
      setToId(active[1]?.id ?? 0)
      setAmount('')
      setError(null)
    }
  }, [open, active])
  const source = active.find((w) => w.id === fromId)

  // Picking the wallet that already sits on the other side swaps the pair
  // instead of disabling it — with two wallets a disabled option would leave
  // the officer unable to reverse the direction at all.
  const pickFrom = (id: number) => {
    if (id === toId) setToId(fromId)
    setFromId(id)
    setError(null)
  }
  const pickTo = (id: number) => {
    if (id === fromId) setFromId(toId)
    setToId(id)
    setError(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (fromId === toId) return setError(t('wform.sameWallet'))
    const cents = rupeesToCents(amount)
    if (cents <= 0) return setError(t('wform.amountGtZero'))
    if (source && cents > source.balance) return setError(t('wform.insufficientFunds', { max: formatCurrency(source.balance) }))
    try {
      await transfer.mutateAsync({ fromId, toId, amount: cents })
      toast.success(t('wform.transferSuccess'))
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err, t('wform.transferFailed')))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !transfer.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        {loading ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRightLeft className="size-5 text-primary" /> {t('wform.transferTitle')}
              </DialogTitle>
              <DialogDescription>{t('common.loading')}</DialogDescription>
            </DialogHeader>
            <Spinner className="py-6" />
          </>
        ) : active.length < 2 ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-danger">{t('wform.cannotTransfer')}</DialogTitle>
              <DialogDescription>{t('wform.needTwoWallets')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="contents">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRightLeft className="size-5 text-primary" /> {t('wform.transferTitle')}
              </DialogTitle>
              <DialogDescription>{t('wallet.operationalDesc')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="transfer-from">{t('wform.fromWallet')}</Label>
                  <NativeSelect id="transfer-from" value={fromId} onChange={(e) => pickFrom(Number(e.target.value))}>
                    {active.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatCurrency(w.balance)})
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="transfer-to">{t('wform.toWallet')}</Label>
                  <NativeSelect id="transfer-to" value={toId} onChange={(e) => pickTo(Number(e.target.value))}>
                    {active.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="transfer-amount">
                  {t('wform.amountRs')} <span className="text-danger">*</span>
                </Label>
                <RupeeInput id="transfer-amount" autoFocus value={amount} onChange={(v) => { setAmount(v); setError(null) }} aria-invalid={error ? true : undefined} />
                {source && <p className="text-xs text-subtle-foreground">{t('wallet.balanceHint', { amount: formatCurrency(source.balance) })}</p>}
                {error && (
                  <p role="alert" className="text-xs font-medium text-danger">
                    {error}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={transfer.isPending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={transfer.isPending} disabled={!amount}>
                {t('wallet.transfer')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
