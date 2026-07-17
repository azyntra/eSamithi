import React, { useMemo } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { radius, spacing, usePalette } from '../../theme'
import { interFamily, useType } from '../../typography'
import { useAnnouncements, useDues, useProfile, useSocietyInfo, useStatement, type LedgerRow } from '../../api/hooks'
import { formatDate } from '../../lib/date'
import { noticeMeta } from './notices'
import { Banner, BrandGradient, Card, ErrorView, Money, ScalePressable, Screen, SectionHeader, SkeletonCards, StaleBanner } from '../../ui'
import { MembershipCard } from '../../ui/MembershipCard'

type ActivityRow = LedgerRow & { direction: 'in' | 'out' }

// Staggered section entrance — one knob for the whole page choreography
function Section({ index, children }: { index: number; children: React.ReactNode }): React.ReactElement {
  return <Animated.View entering={FadeInDown.delay(index * 70).duration(420).springify().damping(18)}>{children}</Animated.View>
}

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

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ height: insets.top + spacing.sm }} />
      {showStale && <StaleBanner />}

      {/* Greeting header (tab header is hidden for Home) */}
      <Section index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={{ color: p.text, fontSize: 24, fontFamily: ty.family.extrabold, lineHeight: ty.lh(24) }}>
              {t('mob.hello', { name: prof.full_name.split(' ')[0] })}
            </Text>
            <Text style={{ color: p.textMuted, fontSize: 13.5, fontFamily: ty.family.regular, lineHeight: ty.lh(13.5), marginTop: 2 }}>
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
            <Text style={{ color: '#ffffff', fontFamily: ty.family.extrabold, fontSize: 18 }}>
              {prof.full_name.trim().charAt(0)}
            </Text>
          </ScalePressable>
        </View>
      </Section>

      {/* Membership card — tap for the full-size version */}
      <Section index={1}>
        <ScalePressable onPress={() => router.push('/card')} accessibilityRole="button" scaleTo={0.98} style={{ marginBottom: spacing.lg }}>
          <MembershipCard
            profile={prof}
            societyName={society.data?.society_name ?? 'Maranadhara Samithi'}
            compact
          />
        </ScalePressable>
      </Section>

      <Section index={2}>
        {(hasOverdue || feeMissing) && <SectionHeader>{t('mob.duesTitle')}</SectionHeader>}
        {hasOverdue && (
          <ScalePressable onPress={() => router.push('/dues')} accessibilityRole="button" scaleTo={0.98}>
            <Banner kind="danger" text={t('mob.overdueLoanBanner')} />
          </ScalePressable>
        )}
        {feeMissing && (
          <ScalePressable onPress={() => router.push('/dues')} accessibilityRole="button" scaleTo={0.98}>
            <Banner kind="warning" text={t('mob.membershipFeeDue')} />
          </ScalePressable>
        )}
        {!hasOverdue && !feeMissing && dues.isSuccess && <Banner kind="success" text={t('mob.allGood')} />}
      </Section>

      {notices.data && notices.data.length > 0 && (() => {
        const latest = notices.data[0]
        const meta = noticeMeta(latest.type, t, p)
        return (
          <Section index={3}>
            <SectionHeader>{t('mob.latestNotice')}</SectionHeader>
            <Card onPress={() => router.push('/(tabs)/notices')} style={{ borderLeftWidth: 4, borderLeftColor: meta.color }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                <Ionicons name={meta.icon} size={16} color={meta.color} />
                <Text style={{ color: meta.color, fontSize: 12, fontFamily: ty.family.bold, lineHeight: ty.lh(12), flex: 1 }}>{meta.label}</Text>
                <Text style={{ color: p.textMuted, fontSize: 12, fontFamily: interFamily.regular, flexShrink: 0, paddingRight: 2 }}>
                  {formatDate(latest.created_at)}
                </Text>
              </View>
              <Text style={{ color: p.text, fontSize: 15, fontFamily: ty.family.bold, lineHeight: ty.lh(15) }} numberOfLines={2}>{latest.title}</Text>
              {latest.type === 'death' && latest.deceased_name && (
                <Text style={{ color: p.textMuted, fontSize: 13, fontFamily: ty.family.regular, lineHeight: ty.lh(13), marginTop: 2 }} numberOfLines={1}>
                  {latest.deceased_name}
                </Text>
              )}
            </Card>
          </Section>
        )
      })()}

      <Section index={4}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Card style={{ flex: 1 }}>
            <View style={{ width: 34, height: 34, borderRadius: radius.pill, backgroundColor: p.successBg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm + 2 }}>
              <Ionicons name="trending-up" size={17} color={p.success} />
            </View>
            <Text style={{ color: p.textMuted, fontSize: 12.5, fontFamily: ty.family.semibold, lineHeight: ty.lh(12.5), marginBottom: spacing.xs }}>
              {t('mob.totalContributed')}
            </Text>
            <Money cents={totalContributed} size={19} bold color={p.success} />
          </Card>
          <Card style={{ flex: 1 }}>
            <View style={{ width: 34, height: 34, borderRadius: radius.pill, backgroundColor: loanBalance > 0 ? p.warningBg : p.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm + 2 }}>
              <Ionicons name="wallet-outline" size={17} color={loanBalance > 0 ? p.warning : p.textMuted} />
            </View>
            <Text style={{ color: p.textMuted, fontSize: 12.5, fontFamily: ty.family.semibold, lineHeight: ty.lh(12.5), marginBottom: spacing.xs }}>
              {t('mob.activeLoanBalance')}
            </Text>
            <Money cents={loanBalance} size={19} bold color={loanBalance > 0 ? p.warning : p.text} />
          </Card>
        </View>
      </Section>

      {/* Quick actions — the things members ask the office about most */}
      <Section index={5}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.sm }}>
          {([
            { href: '/card', icon: 'id-card-outline', label: t('mob.memberCard') },
            { href: '/dues', icon: 'alert-circle-outline', label: t('mob.duesTitle') },
            { href: '/requests', icon: 'document-text-outline', label: t('mob.requests') },
            { href: '/help', icon: 'help-circle-outline', label: t('mob.help') }
          ] as const).map((qa) => (
            <ScalePressable
              key={qa.href}
              accessibilityRole="button"
              haptic="selection"
              scaleTo={0.95}
              onPress={() => router.push(qa.href)}
              style={{ flex: 1, alignItems: 'center', gap: spacing.xs + 2, paddingVertical: spacing.sm }}
            >
              <View style={{ width: 46, height: 46, borderRadius: radius.pill, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={qa.icon} size={21} color={p.primary} />
              </View>
              <Text
                numberOfLines={2}
                style={{ color: p.textMuted, fontSize: 11, fontFamily: ty.family.semibold, textAlign: 'center', lineHeight: ty.lh(11) }}
              >
                {qa.label}
              </Text>
            </ScalePressable>
          ))}
        </View>
      </Section>

      {recent.length > 0 && (
        <Section index={6}>
          <SectionHeader>{t('mob.recentActivity')}</SectionHeader>
          <Card style={{ paddingVertical: spacing.xs }}>
            {recent.map((row, i) => (
              <View
                key={`${row.direction}-${row.id}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: spacing.sm + 3,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: p.border
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: radius.pill,
                    backgroundColor: row.direction === 'in' ? p.successBg : p.warningBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: spacing.md - 2
                  }}
                >
                  <Ionicons
                    name={row.direction === 'in' ? 'arrow-up' : 'arrow-down'}
                    size={16}
                    color={row.direction === 'in' ? p.success : p.warning}
                  />
                </View>
                <View style={{ flex: 1, marginRight: spacing.md - 2 }}>
                  <Text style={{ color: p.text, fontSize: 14, fontFamily: ty.family.semibold, lineHeight: ty.lh(14) }} numberOfLines={1}>{row.type_name}</Text>
                  <Text style={{ color: p.textMuted, fontSize: 12, fontFamily: interFamily.regular, marginTop: 1 }}>{formatDate(row.date)}</Text>
                </View>
                <Money cents={row.amount} color={row.direction === 'in' ? p.success : p.warning} size={14} />
              </View>
            ))}
          </Card>
        </Section>
      )}
    </Screen>
  )
}
