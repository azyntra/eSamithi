import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  // When set, the user must type this exact text before the action enables
  // (loan / member deletion — requirements §4.9)
  typeToConfirm?: string
  typeToConfirmLabel?: string
  busy?: boolean
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel, danger = false, typeToConfirm, typeToConfirmLabel, busy = false, onConfirm }: ConfirmDialogProps) {
  const { t } = useT()
  const [typed, setTyped] = useState('')
  useEffect(() => {
    if (!open) setTyped('')
  }, [open])
  const armed = !typeToConfirm || typed.trim() === typeToConfirm

  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', danger ? 'bg-danger-soft text-danger' : 'bg-accent text-primary')}>
              <AlertTriangle className="size-5" />
            </span>
            <div className="min-w-0">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              {description ? <AlertDialogDescription className="mt-1">{description}</AlertDialogDescription> : null}
            </div>
          </div>
        </AlertDialogHeader>
        {typeToConfirm && (
          <div className="grid gap-1.5">
            <Label htmlFor="confirm-typed">{typeToConfirmLabel ?? t('confirm.typeToConfirm', { text: typeToConfirm })}</Label>
            <Input id="confirm-typed" autoFocus autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} className="font-mono" />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel ?? t('common.cancel')}</AlertDialogCancel>
          <Button variant={danger ? 'destructive' : 'default'} disabled={!armed} loading={busy} onClick={() => void onConfirm()}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
