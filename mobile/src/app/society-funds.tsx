import React from 'react'
import { Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../i18n'
import { elevation, radius, usePalette } from '../theme'
import { interFamily, useType } from '../typography'
import { useSocietyFunds, useSocietyInfo, type SocietyFundFD } from '../api/hooks'
import { formatDate } from '../lib/date'
import { BrandGradient, Card, EmptyText, ErrorView, Money, Screen, SectionHeader, SkeletonCards, StaleBanner, Subtitle } from '../ui'

// Society financial transparency for members: headline funds + a cash/FD
// breakdown with the fixed deposits itemised. Read-only.
export default function SocietyFunds(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const funds = useSocietyFunds()
  const society = useSocietyInfo()

  if (funds.isPending) return <Screen><SkeletonCards cards={3} /></Screen>
  if (funds.isError && !funds.data) {
    return (
      <Screen refreshing={funds.isRefetching} onRefresh={() => funds.refetch()}>
        <ErrorView onRetry={() => funds.refetch()} />
      </Screen>
    )
  }

  const d = funds.data!

  const BreakdownRow = ({ icon, label, cents, color }: {
    icon: keyof typeof Ionicons.glyphMap
    label: string
    cents: number
    color: string
  }): React.ReactElement => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <Text style={{ color: p.text, fontSize: 15, fontWeight: '600', flex: 1, paddingRight: 8 }}>{label}</Text>
      <Money cents={cents} size={16} bold />
    </View>
  )

  const fdRow = (fd: SocietyFundFD, i: number): React.ReactElement => (
    <View
      key={fd.id}
      style={{ paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', flex: 1, paddingRight: 8 }} numberOfLines={1}>
          {fd.bank_name || t('mob.fundsFdBank')}
        </Text>
        <Money cents={fd.principal} size={15} bold color={p.primary} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 10 }}>
        <Text style={{ color: p.textMuted, fontSize: 12, flex: 1 }} numberOfLines={1}>
          {fd.fd_number ? `#${fd.fd_number}` : ''}{fd.interest_rate != null ? `${fd.fd_number ? ' · ' : ''}${fd.interest_rate}%` : ''}
        </Text>
        {fd.maturity_date && (
          <Text style={{ color: p.textMuted, fontSize: 12, flexShrink: 0, paddingRight: 2 }}>
            {t('mob.fundsMatures', { date: formatDate(fd.maturity_date) })}
          </Text>
        )}
      </View>
    </View>
  )

  return (
    <Screen refreshing={funds.isRefetching} onRefresh={() => funds.refetch()}>
      {funds.isError && <StaleBanner />}
      <Subtitle>{t('mob.fundsIntro', { society: society.data?.society_name ?? 'Maranadhara Samithi' })}</Subtitle>

      {/* Headline: total society funds — brand-gradient hero */}
      <View
        style={{
          borderRadius: radius.lg,
          padding: 22,
          marginBottom: 16,
          overflow: 'hidden',
          backgroundColor: p.navy,
          shadowColor: p.navy,
          ...elevation.md
        }}
      >
        <BrandGradient />
        <Text
          pointerEvents="none"
          style={{ position: 'absolute', right: -4, top: -22, fontSize: 100, fontFamily: interFamily.extrabold, color: 'rgba(255,255,255,0.08)' }}
        >
          eS
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontFamily: ty.family.bold, lineHeight: ty.lh(12.5), letterSpacing: 0.8, textTransform: 'uppercase' }}>
          {t('mob.fundsTotal')}
        </Text>
        <Text style={{ color: '#fff', fontSize: 34, fontFamily: interFamily.extrabold, marginTop: 6, fontVariant: ['tabular-nums'] }}>
          Rs. {(d.total_funds / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>

      {/* Breakdown */}
      <Card style={{ paddingVertical: 4 }}>
        <BreakdownRow icon="cash-outline" label={t('mob.fundsCash')} cents={d.cash_total} color={p.success} />
        <View style={{ borderTopWidth: 1, borderTopColor: p.border }}>
          <BreakdownRow icon="lock-closed-outline" label={t('mob.fundsFd')} cents={d.fd_total} color={p.primary} />
        </View>
      </Card>

      {/* Itemised fixed deposits */}
      <SectionHeader>{t('mob.fundsFdList')}</SectionHeader>
      <Card style={{ paddingVertical: 4 }}>
        {d.fixed_deposits.length === 0
          ? <EmptyText>{t('mob.fundsNoFd')}</EmptyText>
          : d.fixed_deposits.map(fdRow)}
      </Card>

      <Text style={{ color: p.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
        {t('mob.fundsNote')}
      </Text>
    </Screen>
  )
}
