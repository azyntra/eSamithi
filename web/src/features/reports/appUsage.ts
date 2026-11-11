import { formatDate, formatDateTime } from '@/lib/format/dates'
import type { Lang, TranslationKey } from '@/lib/i18n'
import { fold, memberLabel } from '@/lib/members'
import type { AppUsageFilter } from './tabs'
import type { AppUsageMember, AppUsageStatus } from './types'

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string

export const STATUS_LABEL: Record<AppUsageStatus, TranslationKey> = {
  online: 'reports.appOnline',
  active: 'reports.appActive',
  occasional: 'reports.appOccasional',
  dormant: 'reports.appDormant',
  not_enrolled: 'reports.appNotEnrolled',
  blocked: 'reports.appBlocked'
}

export const STATUS_TONE: Record<AppUsageStatus, 'success' | 'info' | 'warning' | 'neutral' | 'danger'> = {
  online: 'success',
  active: 'info',
  occasional: 'warning',
  dormant: 'neutral',
  not_enrolled: 'danger',
  blocked: 'danger'
}

// Most recently used first — the top of the list is who is on the app now —
// then everyone who has never used it, by name.
export function filterUsage(members: AppUsageMember[], filter: AppUsageFilter, query: string): AppUsageMember[] {
  const q = fold(query)
  return members
    .filter((m) => filter === 'all' || m.status === filter)
    .filter((m) => !q || fold(m.full_name).includes(q) || fold(m.society_id).includes(q) || fold(m.phone).includes(q))
    .sort((a, b) => {
      if (a.last_seen_at !== b.last_seen_at) {
        if (!a.last_seen_at) return 1
        if (!b.last_seen_at) return -1
        return a.last_seen_at < b.last_seen_at ? 1 : -1
      }
      return fold(a.full_name).localeCompare(fold(b.full_name)) || a.id - b.id
    })
}

// "now" is the server's clock at the moment the report was generated, so the
// labels cannot drift with a wrong clock on the office PC.
export function lastSeenLabel(lastSeen: string | null, now: string, t: T, lang: Lang): string {
  if (!lastSeen) return t('reports.appNever')
  const seconds = Math.max(0, (new Date(now).getTime() - new Date(lastSeen).getTime()) / 1000)
  if (Number.isNaN(seconds)) return t('reports.appNever')
  if (seconds < 120) return t('reports.appJustNow')
  if (seconds < 3600) return t('reports.appMinAgo', { n: Math.floor(seconds / 60) })
  if (seconds < 86400) return t('reports.appHoursAgo', { n: Math.floor(seconds / 3600) })
  if (seconds < 31 * 86400) return t('reports.appDaysAgo', { n: Math.floor(seconds / 86400) })
  return formatDate(new Date(lastSeen), lang)
}

export function versionLabel(m: Pick<AppUsageMember, 'platform' | 'app_version'>): string {
  const platform = m.platform === 'android' ? 'Android' : m.platform === 'ios' ? 'iOS' : m.platform
  return [platform, m.app_version].filter(Boolean).join(' · ') || '—'
}

// One flat table for print and CSV: the list exactly as filtered on screen
export function usageRows(members: AppUsageMember[], t: T, lang: Lang): string[][] {
  return members.map((m) => [
    m.society_id,
    memberLabel(m, t('members.unnamed')),
    m.phone || '—',
    t(STATUS_LABEL[m.status]),
    m.last_seen_at ? formatDateTime(m.last_seen_at, lang) : t('reports.appNever'),
    m.enrolled_at ? formatDate(new Date(m.enrolled_at), lang) : '—',
    versionLabel(m)
  ])
}
