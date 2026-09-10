import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { HandCoins } from 'lucide-react'
import { toast } from 'sonner'
import { RupeeInput, rupeesToCents } from '@/components/RupeeInput'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { useWallets } from '@/features/wallet/queries'
import { errorMessage } from '@/lib/api/errors'
import { formatCurrency } from '@/lib/format/currency'
import { todayIso } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useRepayLoan } from '../queries'
import { balanceOf, type Loan, type PaymentMethod, type RepayResult } from '../types'

// Repayments are applied fine → interest → principal. The preview shows the
// officer that split before they commit (FR-6.4).
export function RepayLoanDialog({ loan, onOpenChange, onRepaid }: { loan: Loan | null; onOpenChange: (o: boolean) => void; onRepaid?: (r: RepayResult) => void }) {
  const { t } = useT()
  const wallets = useWallets()
  const repay = useRepayLoan(loan?.id ?? 0)
  const activeWallets = useMemo(() => (wallets.data ?? []).filter((w) => Number(w.is_active) === 1), [wallets.data])
  const [amount, setAmount] = useState('')
  const [walletId, setWalletId] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('Cash')
  const [date, setDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const open = Boolean(loan)

  useEffect(() => {
    if (open) {
      setAmount('')
      setWalletId('')
      setMethod('Cash')
      setDate(todayIso())
      setNotes('')
      setError(null)
    }
  }, [open])

  const totalOwed = loan ? balanceOf(loan) : 0
  const cents = Math.max(0, rupeesToCents(amount))
  const fines = loan ? Math.min(cents, loan.fines_owed) : 0
  const interest = loan ? Math.min(cents - fines, loan.interest_owed) : 0
  const principal = loan ? Math.min(cents - fines - interest, loan.principal_owed) : 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!loan) return
    if (!walletId) return setError(t('lform.selectReceiveWallet'))
    if (cents <= 0) return setError(t('lform.repayGtZero'))
    if (cents > totalOwed) return setError(t('lform.exceedsOutstanding', { total: formatCurrency(totalOwed) }))
    try {
      const r = await repay.mutateAsync({ amount: cents, wallet_id: Number(walletId), payment_method: method, date, notes: notes.trim() || null })
      toast.success(r.status === 'Paid' ? t('lform.fullySettled') : t('lform.repayRecorded'))
      onRepaid?.(r)
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err, t('lform.repayFailed')))
    }
  }

  const Row = ({ label, value, tone }: { label: string; value: number; tone?: boolean }) => (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tnum font-medium', tone && value > 0 && 'text-danger')}>{formatCurrency(value)}</span>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !repay.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HandCoins className="size-5 text-primary" /> {t('lform.repayTitle')}
            </DialogTitle>
            <DialogDescription>{loan?.member_name}</DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
            <Row label={t('lform.outstandingFine')} value={loan?.fines_owed ?? 0} tone />
            <Row label={t('lform.outstandingInterest')} value={loan?.interest_owed ?? 0} tone />
            <Row label={t('lform.remainingPrincipal')} value={loan?.principal_owed ?? 0} />
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
              <span>{t('lform.totalOutstanding')}</span>
              <span className="tnum text-danger">{formatCurrency(totalOwed)}</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="repay-amount">
                {t('lform.repayAmount')} <span className="text-danger">*</span>
              </Label>
              <RupeeInput id="repay-amount" autoFocus tone="income" value={amount} onChange={(v) => { setAmount(v); setError(null) }} max={totalOwed / 100} aria-invalid={error ? true : undefined} />
              <p className="text-xs text-subtle-foreground">{t('lform.maxAmountHint', { amount: formatCurrency(totalOwed) })}</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="repay-date">
                {t('common.date')} <span className="text-danger">*</span>
              </Label>
              <Input id="repay-date" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="repay-method">{t('lform.paymentMethod')}</Label>
              <NativeSelect id="repay-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                <option value="Cash">{t('lform.pmCash')}</option>
                <option value="Bank Transfer">{t('lform.pmBankTransfer')}</option>
                <option value="Cheque">{t('lform.pmCheque')}</option>
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="repay-wallet">
                {t('lform.depositToWallet')} <span className="text-danger">*</span>
              </Label>
              <NativeSelect id="repay-wallet" value={walletId} disabled={wallets.isPending} aria-busy={wallets.isPending || undefined} onChange={(e) => { setWalletId(e.target.value); setError(null) }}>
                <option value="">{wallets.isPending ? t('common.loading') : t('wform.selectWallet')}</option>
                {activeWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          {cents > 0 && (
            <div className="rounded-xl border border-dashed border-border px-4 py-3">
              <div className="mb-1 text-xs font-semibold text-primary">{t('lform.autoAllocation')}</div>
              <Row label={t('lform.appliedFine')} value={fines} />
              <Row label={t('lform.appliedInterest')} value={interest} />
              <Row label={t('lform.appliedPrincipal')} value={principal} />
              <p className="mt-1 text-xs text-subtle-foreground">{t('lform.allocationNote')}</p>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="repay-notes">{t('lform.notesRef')}</Label>
            <Input id="repay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('lform.receiptPlaceholder')} />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={repay.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={repay.isPending} disabled={cents <= 0}>
              {t('loans.recordRepayment')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
