import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/lib/i18n'

export function VoidDialog({ open, onOpenChange, busy, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; busy?: boolean; onConfirm: (reason: string) => void | Promise<void> }) {
  const { t } = useT()
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (!open) setReason('')
  }, [open])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (reason.trim()) void onConfirm(reason.trim())
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-danger" /> {t('void.title')}
            </DialogTitle>
            <DialogDescription>{t('void.confirmMsg')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="void-reason">
              {t('void.reasonLabel')} <span className="text-danger">*</span>
            </Label>
            <Textarea id="void-reason" autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('void.reasonPlaceholder')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={!reason.trim()} loading={busy}>
              {t('void.confirmBtn')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
