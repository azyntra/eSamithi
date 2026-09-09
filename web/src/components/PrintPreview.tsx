import { useEffect, useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useT } from '@/lib/i18n'
import { printDocument, printHtml } from '@/lib/print/print'

interface PrintPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  html: string | null // receipt body html
}

// Receipt / voucher preview in a sandboxed iframe; Enter or the button prints.
export function PrintPreview({ open, onOpenChange, title, html }: PrintPreviewProps) {
  const { t, lang } = useT()
  const [printing, setPrinting] = useState(false)
  const doc = useMemo(() => (html ? printDocument(html, title, lang) : ''), [html, title, lang])

  const print = async () => {
    if (!doc) return
    setPrinting(true)
    try {
      await printHtml(doc)
    } finally {
      setPrinting(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        void print()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-3 p-0 sm:max-w-[560px]">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="size-4 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription>{t('print.previewHint')}</DialogDescription>
        </DialogHeader>
        <div className="mx-5 min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-navy-100">
          {doc && <iframe title={title} sandbox="allow-same-origin" srcDoc={doc} className="h-[60vh] w-full bg-white" />}
        </div>
        <DialogFooter className="border-t border-border px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          <Button onClick={() => void print()} loading={printing} autoFocus>
            <Printer /> {t('common.print')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
