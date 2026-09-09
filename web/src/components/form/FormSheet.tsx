import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface FormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  dirty?: boolean
  submitting?: boolean
  submitLabel: ReactNode
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  children: ReactNode
  footerStart?: ReactNode
  wide?: boolean
}

// Form container: Sheet on desktop, full-height panel on phones, sticky
// footer, and a discard guard when the form is dirty (requirements FR-2.8).
export function FormSheet({ open, onOpenChange, title, description, dirty = false, submitting = false, submitLabel, onSubmit, children, footerStart, wide = false }: FormSheetProps) {
  const { t } = useT()
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const requestClose = (next: boolean) => {
    if (next) return onOpenChange(true)
    if (submitting) return
    if (dirty) setConfirmDiscard(true)
    else onOpenChange(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent side="right" className={cn('flex w-full flex-col gap-0 p-0', wide ? 'sm:max-w-3xl' : 'sm:max-w-xl')} onInteractOutside={(e) => { if (dirty || submitting) e.preventDefault() }}>
          <form onSubmit={onSubmit} className="flex h-full flex-col" noValidate>
            <SheetHeader className="border-b border-border">
              <SheetTitle className="text-lg">{title}</SheetTitle>
              {description ? <SheetDescription>{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
            </SheetHeader>
            <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5">{children}</div>
            <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-5 py-3">
              <div>{footerStart}</div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => requestClose(false)} disabled={submitting}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={submitting}>
                  {submitLabel}
                </Button>
              </div>
            </div>
          </form>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={t('form.discardTitle')}
        description={t('form.discardBody')}
        confirmLabel={t('form.discard')}
        cancelLabel={t('form.keepEditing')}
        danger
        onConfirm={() => {
          setConfirmDiscard(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}
