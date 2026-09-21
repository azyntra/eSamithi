import React, { useMemo } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { radius, spacing, type as typeScale, usePalette } from '../../theme'
import { interFamily, useType } from '../../typography'
import { useAnnouncements, useDues, useProfile, useSocietyInfo, useStatement, type LedgerRow } from '../../api/hooks'
import { formatDate } from '../../lib/date'
import { noticeMeta } from './notices'
import { AmountCard, BrandGradient, Card, ErrorView, ListRow, Money, ScalePressable, Screen, SectionHeader, SkeletonCards, StaleBanner } from '../../ui'
import { MembershipCard } from '../../ui/MembershipCard'

type ActivityRow = LedgerRow & { direction: 'in' | 'out' }

export default function Home(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const insets = useSafeAreaInsets()
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
        <View style={{ height: insets.top + spacing.sm }} />
        <SkeletonCards cards={3} />
      </Screen>
    )
  }
  if ((profile.isError && !profile.data) || (statement.isError && !statement.data)) {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <View style={{ height: insets.top + spacing.sm }} />
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

  const owed = (dues.data?.overdue_loans ?? []).reduce((sum, l) => sum + l.principal_owed + l.interest_owed + l.fines_owed, 0)
  const latest = notices.data?.[0]

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ height: insets.top + spacing.sm }} />
      {showStale && <StaleBanner />}

      {/* 1 — who you are. The page's own title, not a section. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
        <View style={{ flex: 1, marginRight: spacing.md }}>
          <Text style={{ color: p.text, fontSize: typeScale.title, fontFamily: ty.family.extrabold, lineHeight: ty.lh(typeScale.title) }}>
            {t('mob.hello', { name: prof.full_name.split(' ')[0] })}
          </Text>
          <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption), marginTop: 2 }}>
            {prof.date_of_joining ? `${t('mob.memberSince', { date: formatDate(prof.date_of_joining) })} · ` : ''}{prof.society_id}
          </Text>
        </View>
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel={t('mob.myProfile')}
          haptic="selection"
          onPress={() => router.push('/profile')}
          style={{ width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          <BrandGradient rounded={radius.pill} />
          <Text style={{ color: p.onPrimary, fontFamily: interFamily.extrabold, fontSize: typeScale.heading }}>
            {prof.full_name.trim().charAt(0)}
          </Text>
        </ScalePressable>
      </View>

      {/* 2 — the question this app exists to answer, always in the same place.
             It used to be a conditional stack of banners, so the whole page
             shifted depending on whether you owed anything. */}
      {hasOverdue ? (
        <AmountCard
          label={t('mob.totalOwed')}
          cents={owed}
          tone="danger"
          icon="alert-circle"
          hint={t('mob.overdueLoanBanner')}
          onPress={() => router.push('/dues')}
        />
      ) : feeMissing ? (
        <Card onPress={() => router.push('/dues')}>
          <ListRow first icon="time-outline" iconTone="warning" label={t('mob.duesTitle')} sublabel={t('mob.membershipFeeDue')} onPress={() => router.push('/dues')} />
        </Card>
      ) : (
        <Card onPress={() => router.push('/dues')}>
          <ListRow first icon="checkmark-circle" iconTone="success" label={t('mob.allGood')} onPress={() => router.push('/dues')} />
        </Card>
      )}

      {/* 3 — the card members show at the office */}
      <ScalePressable onPress={() => router.push('/card')} accessibilityRole="button" scaleTo={0.98} style={{ marginBottom: spacing.lg }}>
        <MembershipCard profile={prof} societyName={society.data?.society_name ?? 'Maranadhara Samithi'} compact />
      </ScalePressable>

      {/* 4 — the two standing figures */}
      <AmountCard label={t('mob.totalContributed')} cents={totalContributed} tone="success" icon="trending-up" />
      <AmountCard
        label={t('mob.activeLoanBalance')}
        cents={loanBalance}
        tone={loanBalance > 0 ? 'warning' : undefined}
        icon="wallet-outline"
        onPress={loanBalance > 0 ? () => router.push('/(tabs)/loans') : undefined}
      />

      {/* 5 — the latest notice */}
      {latest ? (
        <>
          <SectionHeader>{t('mob.latestNotice')}</SectionHeader>
          <Card onPress={() => router.push('/(tabs)/notices')}>
            <ListRow
              first
              icon={noticeMeta(latest.type, t, p).icon}
              iconTone={latest.type === 'death' ? 'danger' : latest.type === 'meeting' ? 'warning' : 'brand'}
              label={latest.title}
              sublabel={latest.type === 'death' && latest.deceased_name ? latest.deceased_name : formatDate(latest.created_at)}
              onPress={() => router.push('/(tabs)/notices')}
            />
          </Card>
        </>
      ) : null}

      {/* 6 — the four things members ask the office about. These were unlabelled
             circles with 11px captions underneath; at 16px Sinhala a label
             cannot fit under a 46px circle, but it fits beside one. */}
      <SectionHeader>{t('mob.quickActions')}</SectionHeader>
      <Card>
        {([
          { href: '/card', icon: 'id-card-outline', label: t('mob.memberCard') },
          { href: '/dues', icon: 'alert-circle-outline', label: t('mob.duesTitle') },
          { href: '/requests', icon: 'document-text-outline', label: t('mob.requests') },
          { href: '/help', icon: 'help-circle-outline', label: t('mob.help') }
        ] as const).map((qa, i) => (
          <ListRow key={qa.href} first={i === 0} icon={qa.icon} label={qa.label} onPress={() => router.push(qa.href)} />
        ))}
      </Card>

      {/* 7 — what moved lately */}
      {recent.length > 0 ? (
        <>
          <SectionHeader>{t('mob.recentActivity')}</SectionHeader>
          <Card>
            {recent.map((row, i) => (
              <ListRow
                key={`${row.direction}-${row.id}`}
                first={i === 0}
                icon={row.direction === 'in' ? 'arrow-up' : 'arrow-down'}
                iconTone={row.direction === 'in' ? 'success' : 'warning'}
                label={row.type_name}
                sublabel={formatDate(row.date)}
                right={<Money cents={row.amount} color={row.direction === 'in' ? p.success : p.warning} size={typeScale.caption} bold />}
              />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  )
}
