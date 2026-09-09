import { Badge } from '@/components/ui/badge'
import { useT, type TranslationKey } from '@/lib/i18n'

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'default'

// Every enum the API returns in English is shown translated with a semantic
// colour (requirements §4.6 — fixes the raw English badges of the desktop).
const MAP: Record<string, { key: TranslationKey; variant: Variant }> = {
  Active: { key: 'rcpt.stActive', variant: 'success' },
  Void: { key: 'rcpt.stVoid', variant: 'neutral' },
  Overdue: { key: 'rcpt.stOverdue', variant: 'danger' },
  Paid: { key: 'rcpt.stPaid', variant: 'success' },
  Defaulted: { key: 'rcpt.stDefaulted', variant: 'danger' },
  Matured: { key: 'status.matured', variant: 'warning' },
  Withdrawn: { key: 'status.withdrawn', variant: 'neutral' },
  Inactive: { key: 'common.inactive', variant: 'neutral' },
  Pending: { key: 'status.pending', variant: 'warning' },
  Approved: { key: 'status.approved', variant: 'success' },
  Rejected: { key: 'status.rejected', variant: 'danger' },
  Cash: { key: 'status.cash', variant: 'info' },
  Bank: { key: 'status.bank', variant: 'info' },
  Member: { key: 'common.member', variant: 'default' },
  Guest: { key: 'status.guest', variant: 'neutral' },
  Vendor: { key: 'status.vendor', variant: 'neutral' }
}

export function StatusPill({ value, className, override }: { value: string | null | undefined; className?: string; override?: Partial<Record<string, Variant>> }) {
  const { t } = useT()
  if (!value) return <span className="text-muted-foreground">—</span>
  const entry = MAP[value]
  const variant = override?.[value] ?? entry?.variant ?? 'neutral'
  return (
    <Badge variant={variant} className={className}>
      {entry ? t(entry.key) : value}
    </Badge>
  )
}
