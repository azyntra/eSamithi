import { useEffect, useMemo, useState } from 'react'
import { QrCode, X } from 'lucide-react'
import { toast } from 'sonner'
import { MemberPicker } from '@/components/MemberPicker'
import { PrintPreview } from '@/components/PrintPreview'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSettings } from '@/features/settings/queries'
import { errorMessage } from '@/lib/api/errors'
import { useT } from '@/lib/i18n'
import { memberLabel } from '@/lib/members'
import { cn } from '@/lib/utils'
import { membersApi } from '../api'
import { buildCardsHtml, sheetCount, type CardMember } from '../cards'
import { useMembersSlim } from '../queries'
import type { QrCardScope } from '../types'

// The print preview for a set of cards. Building the sheet is asynchronous
// (the QR generator is loaded on demand), so callers hand over members and
// this resolves them into HTML before the preview opens.
export function useCardPrint() {
  const { t } = useT()
  const settings = useSettings()
  const [html, setHtml] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)

  const print = async (members: CardMember[]): Promise<boolean> => {
    if (members.length === 0) {
      toast.info(t('members.cardsNone'))
      return false
    }
    setBuilding(true)
    try {
      setHtml(await buildCardsHtml(members, settings.data?.society_name || 'eSamithi'))
      return true
    } catch (e) {
      toast.error(errorMessage(e))
      return false
    } finally {
      setBuilding(false)
    }
  }

  const preview = <PrintPreview open={html !== null} onOpenChange={(o) => !o && setHtml(null)} title={t('members.cardsDocTitle')} html={html} />
  return { print, building, preview }
}

// Members page → "Print QR cards": everyone, only those who have not set up
// the app (the group that actually needs paper), or a hand-picked few.
export function PrintCardsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useT()
  const slim = useMembersSlim(open)
  const cards = useCardPrint()
  const [scope, setScope] = useState<QrCardScope>('not_enrolled')
  const [chosen, setChosen] = useState<number[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setScope('not_enrolled')
      setChosen([])
    }
  }, [open])

  const byId = useMemo(() => new Map((slim.data ?? []).map((m) => [m.id, m])), [slim.data])

  const go = async () => {
    setLoading(true)
    try {
      const members = await membersApi.qrCards(scope, chosen)
      if (await cards.print(members)) {
        toast.message(t('members.cardsSummary', { count: members.length, sheets: sheetCount(members.length) }))
        onOpenChange(false)
      }
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const options: Array<{ value: QrCardScope; label: string }> = [
    { value: 'not_enrolled', label: t('members.cardsNotEnrolled') },
    { value: 'all', label: t('members.cardsAll') },
    { value: 'ids', label: t('members.cardsChosen') }
  ]

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="size-4 text-primary" /> {t('members.cardsTitle')}
            </DialogTitle>
            <DialogDescription>{t('members.cardsHint')}</DialogDescription>
          </DialogHeader>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t('members.cardsScope')}</legend>
            {options.map((o) => (
              <label key={o.value} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors', scope === o.value ? 'border-primary bg-accent' : 'border-border hover:bg-muted/60')}>
                <input type="radio" name="cards-scope" className="accent-[var(--primary)]" checked={scope === o.value} onChange={() => setScope(o.value)} />
                {o.label}
              </label>
            ))}
          </fieldset>

          {scope === 'ids' && (
            <div className="grid gap-2">
              <MemberPicker value={null} onChange={(id) => id !== null && setChosen((prev) => (prev.includes(id) ? prev : [...prev, id]))} exclude={chosen} placeholder={t('members.cardsAddMember')} ariaLabel={t('members.cardsAddMember')} allowClear={false} />
              {chosen.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('members.cardsChosenNone')}</p>
              ) : (
                <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                  {chosen.map((id) => {
                    const m = byId.get(id)
                    const name = m ? memberLabel(m, t('members.unnamed')) : `#${id}`
                    return (
                      <li key={id} className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-2.5 text-xs">
                        <span className="max-w-44 truncate">{name}</span>
                        {m?.society_id ? <span className="tnum text-muted-foreground">{m.society_id}</span> : null}
                        <button type="button" className="grid size-5 place-items-center rounded-full hover:bg-border" aria-label={t('members.cardsRemove', { name })} onClick={() => setChosen((prev) => prev.filter((x) => x !== id))}>
                          <X className="size-3" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void go()} loading={loading || cards.building} disabled={scope === 'ids' && chosen.length === 0}>
              <QrCode /> {t('members.cardsPreview')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {cards.preview}
    </>
  )
}
