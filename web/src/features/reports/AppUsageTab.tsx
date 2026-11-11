import { Link } from '@tanstack/react-router'
import { BellOff, Lock, Phone, Search } from 'lucide-react'
import { StatCard, type Tone } from '@/components/StatCard'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatNumber } from '@/lib/format/currency'
import { formatDate, formatDateTime, formatTime } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { memberLabel } from '@/lib/members'
import { cn } from '@/lib/utils'
import { lastSeenLabel, STATUS_LABEL, STATUS_TONE, versionLabel } from './appUsage'
import { APP_USAGE_FILTERS, type AppUsageFilter } from './tabs'
import type { AppUsageMember, AppUsageReport } from './types'

interface AppUsageTabProps {
  report: AppUsageReport
  rows: AppUsageMember[]
  filter: AppUsageFilter
  onFilter: (filter: AppUsageFilter) => void
  query: string
  onQuery: (query: string) => void
}

export function AppUsageTab({ report, rows, filter, onFilter, query, onQuery }: AppUsageTabProps) {
  const { t, lang } = useT()
  const { counts, thresholds } = report
  const percent = counts.total ? Math.round((counts.enrolled / counts.total) * 100) : 0

  const tiles: Array<{ filter: AppUsageFilter; label: string; value: number; hint: string; tone: Tone }> = [
    { filter: 'all', label: t('reports.appEnrolled'), value: counts.enrolled, hint: t('reports.appEnrolledHint', { percent, total: formatNumber(counts.total) }), tone: 'brand' },
    { filter: 'online', label: t('reports.appOnline'), value: counts.online, hint: t('reports.appOnlineHint', { minutes: thresholds.online_minutes }), tone: 'success' },
    { filter: 'active', label: t('reports.appActive'), value: counts.active, hint: t('reports.appWithinDays', { days: thresholds.active_days }), tone: 'info' },
    { filter: 'occasional', label: t('reports.appOccasional'), value: counts.occasional, hint: t('reports.appWithinDays', { days: thresholds.occasional_days }), tone: 'warning' },
    { filter: 'dormant', label: t('reports.appDormant'), value: counts.dormant, hint: t('reports.appOverDays', { days: thresholds.occasional_days }), tone: 'neutral' },
    { filter: 'not_enrolled', label: t('reports.appNotEnrolled'), value: counts.not_enrolled, hint: t('reports.appNotEnrolledHint'), tone: 'danger' }
  ]

  const filterLabel = (f: AppUsageFilter) => (f === 'all' ? t('reports.appAll') : t(STATUS_LABEL[f]))
  const filterCount = (f: AppUsageFilter) => (f === 'all' ? counts.total : counts[f])

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('reports.appUsage')}</h2>
        <Badge variant="success" className="tnum">
          <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden />
          {t('reports.appLive')} · {t('reports.appAsOf', { time: formatTime(report.generated_at) })}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        {tiles.map((tile, i) => (
          <button
            key={tile.filter}
            type="button"
            aria-pressed={filter === tile.filter}
            onClick={() => onFilter(tile.filter)}
            className="rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StatCard index={i} label={tile.label} value={formatNumber(tile.value)} hint={tile.hint} tone={tile.tone} className={cn('h-full transition-shadow hover:shadow-md', filter === tile.filter && 'ring-2 ring-primary')} />
          </button>
        ))}
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <NativeSelect aria-label={t('common.status')} className="w-auto min-w-44" value={filter} onChange={(e) => onFilter(e.target.value as AppUsageFilter)}>
            {APP_USAGE_FILTERS.filter((f) => f !== 'blocked' || counts.blocked > 0 || filter === 'blocked').map((f) => (
              <option key={f} value={f}>
                {filterLabel(f)} ({formatNumber(filterCount(f))})
              </option>
            ))}
          </NativeSelect>
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" className="pl-8" value={query} onChange={(e) => onQuery(e.target.value)} placeholder={t('reports.appSearch')} aria-label={t('reports.appSearch')} />
          </div>
          <span className="tnum ml-auto text-sm text-muted-foreground">{t('reports.appShowing', { count: formatNumber(rows.length) })}</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('reports.member')}</TableHead>
              <TableHead>{t('common.phone')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead>{t('reports.appLastSeen')}</TableHead>
              <TableHead>{t('reports.appSetupDate')}</TableHead>
              <TableHead>{t('reports.appVersion')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  {t('reports.appNoMembers')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link to="/members/$memberId" params={{ memberId: m.id }} search={{ tab: undefined }} className="font-medium text-foreground hover:text-primary hover:underline">
                      {memberLabel(m, t('members.unnamed'))}
                    </Link>
                    <div className="tnum text-[11px] text-muted-foreground">{m.society_id}</div>
                  </TableCell>
                  <TableCell className="tnum whitespace-nowrap">
                    {m.phone ? (
                      <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1 hover:text-primary hover:underline">
                        <Phone className="size-3" />
                        {m.phone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={STATUS_TONE[m.status]}>{t(STATUS_LABEL[m.status])}</Badge>
                      {m.pin_locked && (
                        <Badge variant="warning" title={t('reports.appPinLocked')}>
                          <Lock /> {t('reports.appPinLocked')}
                        </Badge>
                      )}
                      {m.enrolled && m.status !== 'blocked' && !m.push_enabled && (
                        <span title={t('reports.appNoPush')} className="text-muted-foreground">
                          <BellOff className="size-3.5" aria-label={t('reports.appNoPush')} />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="tnum whitespace-nowrap" title={m.last_seen_at ? formatDateTime(m.last_seen_at, lang) : undefined}>
                    {lastSeenLabel(m.last_seen_at, report.generated_at, t, lang)}
                  </TableCell>
                  <TableCell className="tnum whitespace-nowrap text-muted-foreground">{m.enrolled_at ? formatDate(new Date(m.enrolled_at), lang) : '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{versionLabel(m)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-muted-foreground">{t('reports.appNote')}</p>
    </div>
  )
}
