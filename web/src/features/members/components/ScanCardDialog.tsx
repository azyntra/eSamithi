import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useT } from '@/lib/i18n'
import { membersApi } from '../api'
import { fold } from '@/lib/members'

// Keyboard-wedge scanners type the society ID and press Enter. Exact match
// wins; a single fuzzy hit is accepted so partial IDs still work.
export function ScanCardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useT()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValue('')
      setNotFound(null)
      window.setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const scanned = value.trim()
    if (!scanned || searching) return
    setSearching(true)
    setNotFound(null)
    try {
      const result = await membersApi.list({ search: scanned, page: 1, limit: 10 })
      const exact = result.members.find((m) => fold(m.society_id) === fold(scanned))
      const match = exact ?? (result.members.length === 1 ? result.members[0] : undefined)
      if (match) {
        onOpenChange(false)
        void navigate({ to: '/members/$memberId', params: { memberId: match.id }, search: { tab: undefined } })
      } else {
        setNotFound(scanned)
        inputRef.current?.select()
      }
    } catch {
      setNotFound(scanned)
      inputRef.current?.select()
    } finally {
      setSearching(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="contents">
          <DialogHeader className="items-center text-center sm:text-center">
            <span className="grid size-14 place-items-center rounded-full bg-accent text-primary">
              <ScanLine className="size-7" />
            </span>
            <DialogTitle>{t('members.scanTitle')}</DialogTitle>
            <DialogDescription>{t('members.scanHint')}</DialogDescription>
          </DialogHeader>
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setNotFound(null)
            }}
            onBlur={() => open && inputRef.current?.focus()}
            placeholder={t('common.societyId')}
            autoComplete="off"
            spellCheck={false}
            className="h-11 text-center font-mono text-lg font-bold"
            aria-label={t('common.societyId')}
          />
          <p className="min-h-5 text-center text-sm" aria-live="polite">
            {searching ? <span className="text-muted-foreground">{t('members.scanning')}</span> : notFound ? <span className="font-medium text-danger">{t('members.scanNotFound', { id: notFound })}</span> : null}
          </p>
          <DialogFooter className="sm:justify-center">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
