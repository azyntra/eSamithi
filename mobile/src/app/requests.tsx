import React from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../i18n'
import { usePalette } from '../theme'
import { useMyRequests, type MemberRequest } from '../api/hooks'
import { formatCurrency } from '../lib/money'
import { Button, Card, EmptyState, ErrorView, Screen, SkeletonCards, StaleBanner, StatusPill } from '../ui'
import { useType } from '../typography'

export default function Requests(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
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

  return (
    <Screen refreshing={requests.isRefetching} onRefresh={() => requests.refetch()}>
      {requests.isError && <StaleBanner />}
      <Button label={t('mob.newRequest')} onPress={() => router.push('/new-request')} />
      <View style={{ height: 14 }} />

      {rows.length === 0 && <EmptyState icon="document-text-outline" text={t('mob.noRequests')} />}
      {rows.map((r) => (
        <Card key={r.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Ionicons
              name={r.type === 'loan' ? 'cash-outline' : 'create-outline'}
              size={18}
              color={p.primary}
            />
            <Text style={{ color: p.text, fontSize: 16, flex: 1, fontFamily: ty.family.bold, lineHeight: ty.lh(16) }}>
              {r.type === 'loan' ? t('mob.reqTypeLoan') : t('mob.reqTypeCorrection')}
            </Text>
            <StatusPill status={r.status} />
          </View>
          <Text style={{ color: p.textMuted, fontSize: 12, marginBottom: 6, fontFamily: ty.family.regular, lineHeight: ty.lh(12) }}>{r.created_at}</Text>
          {r.type === 'loan' && r.amount != null && (
            <Text style={{ color: p.text, fontSize: 16, marginBottom: 2, fontFamily: ty.family.bold, lineHeight: ty.lh(16) }}>{formatCurrency(r.amount)}</Text>
          )}
          {r.purpose ? <Text style={{ color: p.textMuted, fontSize: 14, lineHeight: ty.lh(14), fontFamily: ty.family.regular }}>{r.purpose}</Text> : null}
          {r.message ? <Text style={{ color: p.textMuted, fontSize: 14, lineHeight: ty.lh(14), fontFamily: ty.family.regular }}>{r.message}</Text> : null}
          {r.staff_note ? (
            <View style={{ borderTopWidth: 1, borderTopColor: p.border, marginTop: 8, paddingTop: 8 }}>
              <Text style={{ color: p.textMuted, fontSize: 12, marginBottom: 2, fontFamily: ty.family.bold, lineHeight: ty.lh(12) }}>{t('mob.officeNote')}</Text>
              <Text style={{ color: p.text, fontSize: 14, lineHeight: ty.lh(14), fontFamily: ty.family.regular }}>{r.staff_note}</Text>
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  )
}
