import React, { useMemo } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { useAnnouncements, useDues, useProfile, useSocietyInfo, useStatement, type LedgerRow } from '../../api/hooks'
import { formatDate } from '../../lib/date'
import { noticeMeta } from './notices'
import { Banner, Card, ErrorView, Money, Screen, SectionHeader, SkeletonCards, StaleBanner } from '../../ui'
import { MembershipCard } from '../../ui/MembershipCard'

type ActivityRow = LedgerRow & { direction: 'in' | 'out' }

export default function Home(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const router = useRouter()
  const profile = useProfile()
  const statement = useStatement()
  const dues = useDues()
  const notices = useAnnouncements()
  const society = useSocietyInfo()

  const refreshing = profile.isRefetching || statement.isRefetching || dues.isRefetching
  const onRefresh = (): void => {
    profile.refetch()
    statement.refetch()
    dues.refetch()
  }

  // Last 5 movements across contributions (in) and payouts (out)
  const recent: ActivityRow[] = useMemo(() => {
    if (!statement.data) return []
    const rows: ActivityRow[] = [
      ...statement.data.income.map((r) => ({ ...r, direction: 'in' as const })),
      ...statement.data.expenses.map((r) => ({ ...r, direction: 'out' as const }))
    ]
    return rows
      .filter((r) => r.status === 'Active')
      .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))
      .slice(0, 5)
  }, [statement.data])

  if (profile.isPending || statement.isPending) {
    return (
      <Screen>
        <SkeletonCards cards={3} />
      </Screen>
    )
  }
  if ((profile.isError && !profile.data) || (statement.isError && !statement.data)) {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <ErrorView onRetry={onRefresh} />
      </Screen>
    )
  }

  const prof = profile.data!
  const stmt = statement.data!

  const totalContributed = stmt.income
    .filter((r) => r.status === 'Active')
    .reduce((sum, r) => sum + r.amount, 0)

  const loanBalance = stmt.loans
    .filter((l) => l.status === 'Active' || l.status === 'Overdue')
    .reduce((sum, l) => sum + l.principal_owed + l.interest_owed + l.fines_owed, 0)

  const hasOverdue = (dues.data?.overdue_loans.length ?? 0) > 0
  const feeMissing = dues.data?.membership_fee_paid === false
  const showStale = (profile.isError || statement.isError || dues.isError)

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {showStale && <StaleBanner />}

      <Text style={{ color: p.text, fontSize: 24, fontWeight: '800', marginBottom: 2 }}>
        {t('mob.hello', { name: prof.full_name.split(' ')[0] })}
      </Text>
      <Text style={{ color: p.textMuted, fontSize: 14, marginBottom: 16 }}>
        {prof.date_of_joining ? `${t('mob.memberSince', { date: formatDate(prof.date_of_joining) })} · ` : ''}{prof.society_id}
      </Text>

      {/* Membership card — tap for the full-size version */}
      <Pressable onPress={() => router.push('/card')} accessibilityRole="button" style={{ marginBottom: 16 }}>
        <MembershipCard
          profile={prof}
          societyName={society.data?.society_name ?? 'Maranadhara Samithi'}
          compact
        />
      </Pressable>

      {(hasOverdue || feeMissing) && <SectionHeader>{t('mob.duesTitle')}</SectionHeader>}
      {hasOverdue && (
        <Pressable onPress={() => router.push('/dues')} accessibilityRole="button">
          <Banner kind="danger" text={t('mob.overdueLoanBanner')} />
        </Pressable>
      )}
      {feeMissing && (
        <Pressable onPress={() => router.push('/dues')} accessibilityRole="button">
          <Banner kind="warning" text={t('mob.membershipFeeDue')} />
        </Pressable>
      )}
      {!hasOverdue && !feeMissing && dues.isSuccess && <Banner kind="success" text={t('mob.allGood')} />}

      {notices.data && notices.data.length > 0 && (() => {
        const latest = notices.data[0]
        const meta = noticeMeta(latest.type, t, p)
        return (
          <>
            <SectionHeader>{t('mob.latestNotice')}</SectionHeader>
            <Pressable onPress={() => router.push('/(tabs)/notices')} accessibilityRole="button">
              <Card style={{ borderLeftWidth: 4, borderLeftColor: meta.color }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Ionicons name={meta.icon} size={16} color={meta.color} />
                  <Text style={{ color: meta.color, fontSize: 12, fontWeight: '700', flex: 1 }}>{meta.label}</Text>
                  <Text style={{ color: p.textMuted, fontSize: 12, flexShrink: 0, paddingRight: 2 }}>{formatDate(latest.created_at)}</Text>
                </View>
                <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }} numberOfLines={2}>{latest.title}</Text>
                {latest.type === 'death' && latest.deceased_name && (
                  <Text style={{ color: p.textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{latest.deceased_name}</Text>
                )}
              </Card>
            </Pressable>
          </>
        )
      })()}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: p.textMuted, fontSize: 13, marginBottom: 6 }}>{t('mob.totalContributed')}</Text>
          <Money cents={totalContributed} size={19} bold color={p.success} />
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: p.textMuted, fontSize: 13, marginBottom: 6 }}>{t('mob.activeLoanBalance')}</Text>
          <Money cents={loanBalance} size={19} bold color={loanBalance > 0 ? p.warning : p.text} />
        </Card>
      </View>

      {recent.length > 0 && (
        <>
          <SectionHeader>{t('mob.recentActivity')}</SectionHeader>
          <Card style={{ paddingVertical: 4 }}>
            {recent.map((row, i) => (
              <View
                key={`${row.direction}-${row.id}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 11,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: p.border
                }}
              >
                <Ionicons
                  name={row.direction === 'in' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                  size={22}
                  color={row.direction === 'in' ? p.success : p.warning}
                  style={{ marginRight: 10 }}
                />
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{row.type_name}</Text>
                  <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 1 }}>{formatDate(row.date)}</Text>
                </View>
                <Money cents={row.amount} color={row.direction === 'in' ? p.success : p.warning} size={14} />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  )
}
