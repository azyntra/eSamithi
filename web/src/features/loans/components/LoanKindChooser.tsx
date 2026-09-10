import { Archive, Plus } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export type LoanKind = 'new' | 'existing'

// Migration Mode only: issuing a loan moves money out of a wallet, recording a
// paper loan only states a position, so the officer picks first.
export function LoanKindChooser({ value, onChange }: { value: LoanKind; onChange: (kind: LoanKind) => void }) {
  const { t } = useT()
  const option = (kind: LoanKind, icon: React.ReactNode, label: string, hint: string) => {
    const selected = value === kind
    return (
      <button
        type="button"
        onClick={() => onChange(kind)}
        aria-pressed={selected}
        className={cn(
          'flex-1 rounded-lg border p-3 text-left transition-colors duration-150',
          selected ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-accent/50'
        )}
      >
        <span className={cn('flex items-center gap-2 text-sm font-semibold', selected ? 'text-primary' : 'text-foreground')}>
          {icon}
          {label}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{hint}</span>
      </button>
    )
  }
  return (
    <div className="mb-2 flex gap-2.5">
      {option('new', <Plus className="size-4" />, t('loans.kindNew'), t('loans.kindNewHint'))}
      {option('existing', <Archive className="size-4" />, t('loans.kindExisting'), t('loans.kindExistingHint'))}
    </div>
  )
}
