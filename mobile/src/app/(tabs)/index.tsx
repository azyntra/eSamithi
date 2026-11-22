import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { setStatusBarStyle } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as SecureStore from 'expo-secure-store'
import { useT } from '../../i18n'
import { radius, spacing, type as typeScale, usePalette, useThemeMode } from '../../theme'
import { useType } from '../../typography'
import { useAnnouncements, useDues, useProfile, useSocietyInfo, useStatement, type LedgerRow } from '../../api/hooks'
import { isOpenLoan, loanOwed } from '../../lib/loans'
import { useNoticesSeen } from '../../lib/noticesSeen'
import {
  BottomSheet,
  Button,
  ErrorView,
  ListRow,
  HeroGradient,
  LogoChip,
  QuickAction,
  ScalePressable,
  Screen,
  SectionTitle,
  Skeleton,
  StaleBanner,
  StatTile,
  StatusCard,
  TimelineRow,
  maskedOr,
  useCardStyle
} from '../../ui'
import { MembershipCard } from '../../ui/MembershipCard'
import { NoticeCard } from '../../ui/NoticeCard'

// Home (redesign §6.2): one glance answers "am I OK?". The gradient hero holds
// who you are and your status; everything below is one tap from its detail.

const HIDE_KEY = 'esamithi.hideAmounts'
// One-time sheet introducing the five-tab layout (redesign §12)
const WHATS_NEW_KEY = 'esamithi.seen.fiveTabs'

type ActivityRow = LedgerRow & { direction: 'in' | 'out' }

export default function Home(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { scheme } = useThemeMode()
  const profile = useProfile()
  const statement = useStatement()
  const dues = useDues()
  const notices = useAnnouncements()
  const society = useSocietyInfo()
  const { seenId } = useNoticesSeen()
  const card = useCardStyle()
  const [hidden, setHidden] = useState(false)
  const [whatsNew, setWhatsNew] = useState(false)

  // White status-bar icons over the hero, only while Home is on screen
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light')
      return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark')
    }, [scheme])
  )

  useEffect(() => {
    try {
      SecureStore.getItemAsync(WHATS_NEW_KEY).then((v) => { if (v !== '1') setWhatsNew(true) }).catch(() => {})
    } catch {
      // no secure storage (web preview): skip the sheet
    }
  }, [])
  const closeWhatsNew = (): void => {
    setWhatsNew(false)
    try {
      SecureStore.setItemAsync(WHATS_NEW_KEY, '1').catch(() => {})
    } catch {
      // shown again next time; harmless
    }
  }

  useEffect(() => {
    try {
      SecureStore.getItemAsync(HIDE_KEY).then((v) => setHidden(v === '1')).catch(() => {})
    } catch {
      // no secure storage (web preview): amounts stay visible
    }
  }, [])
  const toggleHidden = (): void => {
    const next = !hidden
    setHidden(next)
    try {
      SecureStore.setItemAsync(HIDE_KEY, next ? '1' : '0').catch(() => {})
    } catch {
      // remembered for this session only
    }
  }

  const refreshing = profile.isRefetching || statement.isRefetching || dues.isRefetching
  const onRefresh = (): void => {
    profile.refetch()
    statement.refetch()
    dues.refetch()
    notices.refetch()
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

  const heroTop = insets.top + spacing.md

  if (profile.isPending || statement.isPending) {
    return (
      <Screen padded={false}>
        <View style={{ paddingTop: heroTop, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, overflow: 'hidden', minHeight: 230 }}>
          <HeroGradient rounded={radius.xl} bottomOnly />
        </View>
        <View style={{ padding: spacing.lg }}>
          <Skeleton height={56} radius={28} width="25%" />
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
            <Skeleton height={110} radius={radius.lg} width="48%" />
            <Skeleton height={110} radius={radius.lg} width="48%" />
          </View>
          <Skeleton height={90} radius={radius.lg} />
        </View>
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
  const societyName = society.data?.society_name ?? ''
  const firstName = prof.full_name.trim().split(/\s+/)[0] ?? prof.full_name

  const totalContributed = stmt.income.filter((r) => r.status === 'Active').reduce((sum, r) => sum + r.amount, 0)
  const openLoans = stmt.loans.filter(isOpenLoan)
  const loanBalance = openLoans.reduce((sum, l) => sum + loanOwed(l), 0)
  const overdue = dues.data?.overdue_loans ?? []
  const owed = overdue.reduce((sum, l) => sum + loanOwed(l), 0)
  const feeMissing = dues.data?.membership_fee_paid === false
  const showStale = profile.isError || statement.isError || dues.isError
  const latest = notices.data?.[0]
  const unread = seenId === null || !notices.data ? 0 : notices.data.filter((n) => n.id > seenId).length
  const joinedYear = prof.date_of_joining ? String(prof.date_of_joining).slice(0, 4) : null

  const status = overdue.length > 0
    ? { tone: 'overdue' as const, title: t('mob.statusOverdue', { amount: maskedOr(owed, hidden) }), sub: t('mob.statusOverdueSub', { n: overdue.length }) }
    : feeMissing
      ? { tone: 'due' as const, title: t('mob.statusFeeDue'), sub: t('mob.statusFeeDueSub') }
      : { tone: 'ok' as const, title: t('mob.statusOk'), sub: t('mob.statusOkSub') }

  const isStaff = prof.permissions?.includes('attendance') === true
  const actions: Array<{ href: Href; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
    ...(isStaff ? [{ href: '/attendance' as Href, icon: 'scan-outline' as const, label: t('mob.qaAttendance') }] : []),
    { href: '/card', icon: 'id-card-outline', label: t('mob.qaCard') },
    { href: '/dues', icon: 'alert-circle-outline', label: t('mob.qaDues') },
    { href: '/requests', icon: 'document-text-outline', label: t('mob.qaRequests') },
    { href: '/help', icon: 'help-buoy-outline', label: t('mob.qaHelp') }
  ]

  const heroIconButton = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, dot?: boolean): React.ReactElement => (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={label}
      haptic="selection"
      onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.heroGlass, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={22} color={p.onHero} />
      {dot ? <View style={{ position: 'absolute', top: 9, right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: p.onHero, borderWidth: 2, borderColor: p.heroStart }} /> : null}
    </ScalePressable>
  )

  return (
    <Screen padded={false} refreshing={refreshing} onRefresh={onRefresh}>
      {/* 1 — hero: who you are, and the answer to "am I OK?" */}
      <View style={{ paddingTop: heroTop, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, overflow: 'hidden' }}>
        <HeroGradient rounded={radius.xl} bottomOnly />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 }}>
          <LogoChip size={36} />
          <Text numberOfLines={1} style={{ flex: 1, color: p.onHeroMuted, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption) }}>{societyName}</Text>
          {heroIconButton(hidden ? 'eye-off-outline' : 'eye-outline', hidden ? t('mob.showAmounts') : t('mob.hideAmounts'), toggleHidden)}
          {heroIconButton('notifications-outline', t('mob.noticesTab'), () => router.push('/(tabs)/notices'), unread > 0)}
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel={t('mob.myProfile')}
            haptic="selection"
            onPress={() => router.push('/(tabs)/me')}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.onHero, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: p.heroStart, fontSize: typeScale.heading, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.heading) }}>{prof.full_name.trim().charAt(0).toUpperCase()}</Text>
          </ScalePressable>
        </View>
        <Text accessibilityRole="header" style={{ color: p.onHero, fontSize: typeScale.display, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.display), marginTop: spacing.lg }}>
          {t('mob.hello', { name: firstName })}
        </Text>
        <Text style={{ color: p.onHeroMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>
          {`${t('mob.memberNo')} ${prof.society_id}`}
        </Text>
        <StatusCard tone={status.tone} title={status.title} sub={status.sub} onPress={() => router.push('/dues')} />
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        {showStale ? <View style={{ marginTop: spacing.md }}><StaleBanner /></View> : null}

        {/* 2 — what members ask the office about */}
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.lg }}>
          {actions.map((a) => (
            <QuickAction key={String(a.href)} icon={a.icon} label={a.label} onPress={() => router.push(a.href)} />
          ))}
        </View>

        {/* 3 — the two standing figures */}
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
          <StatTile
            icon="arrow-down-circle-outline"
            tone="success"
            label={t('mob.totalContributed')}
            cents={totalContributed}
            sub={joinedYear ? t('mob.sinceYear', { year: joinedYear }) : undefined}
            hidden={hidden}
            onPress={() => router.push({ pathname: '/(tabs)/money', params: { view: 'contributions' } })}
          />
          <StatTile
            icon="wallet-outline"
            tone={overdue.length > 0 ? 'danger' : undefined}
            label={t('mob.activeLoanBalance')}
            cents={loanBalance}
            sub={openLoans.length > 0 ? t('mob.onLoans', { n: openLoans.length }) : undefined}
            hidden={hidden}
            onPress={() => router.push({ pathname: '/(tabs)/money', params: { view: 'loans' } })}
          />
        </View>

        {/* 4 — the latest notice */}
        {latest ? (
          <>
            <SectionTitle title={t('mob.latestNotice')} action={t('mob.seeAll')} onAction={() => router.push('/(tabs)/notices')} />
            <NoticeCard notice={latest} compact onPress={() => router.push(`/notice/${latest.id}`)} />
          </>
        ) : null}

        {/* 5 — the card members show at the office */}
        <View style={{ marginTop: latest ? 0 : spacing.lg }}>
          <ScalePressable onPress={() => router.push('/card')} accessibilityRole="button" accessibilityLabel={t('mob.memberCard')} scaleTo={0.98}>
            <MembershipCard profile={prof} societyName={societyName || 'Maranadhara Samithi'} compact />
          </ScalePressable>
        </View>

        {/* 6 — what moved lately */}
        {recent.length > 0 ? (
          <>
            <SectionTitle title={t('mob.recentActivity')} action={t('mob.seeAll')} onAction={() => router.push({ pathname: '/(tabs)/money', params: { view: 'contributions' } })} />
            <View style={[card, { paddingHorizontal: spacing.md + 2 }]}>
              {recent.map((row, i) => (
                <TimelineRow
                  key={`${row.direction}-${row.id}`}
                  first={i === 0}
                  date={row.date}
                  title={row.type_name}
                  cents={row.amount}
                  direction={row.direction}
                  hidden={hidden}
                  onPress={() => router.push({ pathname: '/receipt/[kind]/[id]', params: { kind: row.direction === 'in' ? 'income' : 'expense', id: String(row.id) } })}
                />
              ))}
            </View>
          </>
        ) : null}
      </View>
      <BottomSheet visible={whatsNew} onClose={closeWhatsNew} title={t('mob.whatsNewTitle')} footer={<Button label={t('mob.gotIt')} onPress={closeWhatsNew} />}>
        <Text style={{ color: p.textMuted, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body), marginBottom: spacing.md }}>{t('mob.whatsNewTabs')}</Text>
        {([
          ['home-outline', 'mob.tabHome', 'mob.whatsNewHome'],
          ['wallet-outline', 'mob.tabMoney', 'mob.whatsNewMoney'],
          ['notifications-outline', 'mob.tabNotices', 'mob.whatsNewNotices'],
          ['storefront-outline', 'mob.tabPuruka', 'mob.whatsNewPuruka'],
          ['person-circle-outline', 'mob.tabMe', 'mob.whatsNewMe']
        ] as const).map(([icon, label, sub], i) => (
          <ListRow key={label} first={i === 0} icon={icon} label={t(label)} sublabel={t(sub)} />
        ))}
      </BottomSheet>
    </Screen>
  )
}
