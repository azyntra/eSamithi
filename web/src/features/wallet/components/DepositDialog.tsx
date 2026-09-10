import { useEffect, useState, type FormEvent } from 'react'
import { CirclePlus } from 'lucide-react'
import { toast } from 'sonner'
import { RupeeInput, rupeesToCents } from '@/components/RupeeInput'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/api/errors'
import { useT } from '@/lib/i18n'
import type { Wallet } from '../api'
import { useDeposit } from '../queries'

// Migration Mode only: opening-balance adjustments straight into a wallet
export function DepositDialog({ wallet, onOpenChange }: { wallet: Wallet | null; onOpenChange: (o: boolean) => void }) {
  const { t } = useT()
  const deposit = useDeposit()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (wallet) {
      setAmount('')
      setNote(t('wform.manualDeposit'))
      setError(null)
    }
  }, [wallet, t])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!wallet) return
    const cents = rupeesToCents(amount)
    if (cents <= 0) return setError(t('wform.invalidAmount'))
    try {
      await deposit.mutateAsync({ id: wallet.id, amount: cents, note: note.trim() })
      toast.success(t('wform.depositSuccess', { name: wallet.name }))
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err, t('wform.depositFailed')))
    }
  }

  return (
    <Dialog open={Boolean(wallet)} onOpenChange={(o) => !deposit.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CirclePlus className="size-5 text-primary" /> {t('wform.depositTitle', { name: wallet?.name ?? '' })}
            </DialogTitle>
            <DialogDescription>{t('wform.openingBalanceHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="deposit-amount">
                {t('wform.amountRs')} <span className="text-danger">*</span>
              </Label>
              <RupeeInput id="deposit-amount" autoFocus tone="income" value={amount} onChange={(v) => { setAmount(v); setError(null) }} aria-invalid={error ? true : undefined} />
              {error && (
                <p role="alert" className="text-xs font-medium text-danger">
                  {error}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="deposit-note">{t('wform.noteRef')}</Label>
              <Input id="deposit-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('wform.notePlaceholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={deposit.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={deposit.isPending} disabled={!amount}>
              {t('wform.confirmDeposit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
