import React from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../i18n'
import { radius, spacing, type as typeScale, usePalette } from '../theme'
import { interFamily, useType } from '../typography'
import { useMyRequests, type MemberRequest } from '../api/hooks'
import { formatCurrency } from '../lib/money'
import { formatDate } from '../lib/date'
import { Button, EmptyState, ErrorView, Screen, SkeletonCards, StaleBanner, StatusPill, useCardStyle } from '../ui'

// My requests (redesign §6.6.3): each request shows where it is — sent,
// decided, done — instead of a lone status word.
export default function Requests(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const card = useCardStyle()
  const requests = useMyRequests()

  if (requests.isPending) return <Screen><SkeletonCards cards={2} /></Screen>
  if (requests.isError && !requests.data) {
    return (
      <Screen refreshing={requests.isRefetching} onRefresh={() => requests.refetch()}>
        <ErrorView onRetry={() => requests.refetch()} />
      </Screen>
    )
  }

  const rows = requests.data!

  const track = (r: MemberRequest): React.ReactElement => {
    const reached = r.status === 'Pending' ? 1 : r.status === 'Done' ? 3 : 2
    const rejected = r.status === 'Rejected'
    const steps = [t('mob.reqSent'), rejected ? t('mob.stRejected') : t('mob.reqDecided'), t('mob.reqDone')]
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.md }}>
        {steps.map((label, i) => {
          const on = i < reached
          const bad = rejected && i === 1
          const color = bad ? p.danger : on ? p.success : p.borderStrong
          return (
            <View key={label} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
                <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : (i < reached ? p.success : p.border) }} />
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: on || bad ? color : p.surface, borderWidth: 2, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
                  {bad ? <Ionicons name="close" size={14} color={p.onPrimary} /> : on ? <Ionicons name="checkmark" size={14} color={p.onPrimary} /> : null}
                </View>
                <View style={{ flex: 1, height: 2, backgroundColor: i === steps.length - 1 ? 'transparent' : (i + 1 < reached ? p.success : p.border) }} />
              </View>
              <Text style={{ color: on || bad ? p.text : p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.micro), marginTop: spacing.xs, textAlign: 'center' }}>{label}</Text>
            </View>
          )
        })}
      </View>
    )
  }

  return (
    <Screen refreshing={requests.isRefetching} onRefresh={() => requests.refetch()}>
      {requests.isError && <StaleBanner />}
      <Button label={t('mob.newRequest')} icon="add" onPress={() => router.push('/new-request')} />
      <View style={{ height: spacing.lg }} />

      {rows.length === 0 && <EmptyState icon="document-text-outline" text={t('mob.noRequests')} />}
      {rows.map((r) => (
        <View key={r.id} style={[card, { padding: spacing.lg, marginBottom: spacing.md }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={r.type === 'loan' ? 'wallet-outline' : r.type === 'concern' ? 'shield-checkmark-outline' : 'create-outline'} size={20} color={p.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.body) }}>
                {r.type === 'loan' ? t('mob.reqTypeLoan') : r.type === 'concern' ? t('mob.reqTypeConcern') : t('mob.reqTypeCorrection')}
              </Text>
              <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{formatDate(r.created_at)}</Text>
              {/* Under the title, not beside it: Sinhala status words are long */}
              <View style={{ marginTop: spacing.xs }}><StatusPill status={r.status} /></View>
            </View>
          </View>
          {r.type === 'loan' && r.amount != null ? (
            <Text style={{ color: p.text, fontSize: typeScale.title, fontFamily: interFamily.extrabold, fontVariant: ['tabular-nums'], marginTop: spacing.md }}>{formatCurrency(r.amount)}</Text>
          ) : null}
          {r.purpose ? <Text style={{ color: p.text, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption), marginTop: spacing.xs }}>{r.purpose}</Text> : null}
          {r.message ? <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption), marginTop: spacing.xs }}>{r.message}</Text> : null}
          {track(r)}
          {r.staff_note ? (
            <View style={{ marginTop: spacing.md, backgroundColor: p.surfaceAlt, borderRadius: radius.sm, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: p.primary }}>
              <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.micro) }}>{t('mob.officeNote')}</Text>
              <Text style={{ color: p.text, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>{r.staff_note}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </Screen>
  )
}
