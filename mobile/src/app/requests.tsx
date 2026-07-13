import React from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../i18n'
import { usePalette } from '../theme'
import { useMyRequests, type MemberRequest } from '../api/hooks'
import { formatCurrency } from '../lib/money'
import { Badge, Button, Card, EmptyState, ErrorView, Screen, SkeletonCards, StaleBanner } from '../ui'

export default function Requests(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const router = useRouter()
  const requests = useMyRequests()

  const statusBadge = (s: MemberRequest['status']): React.ReactElement => {
    const map = {
      Pending: { label: t('mob.stPending'), color: p.warning, bg: p.warningBg },
      Approved: { label: t('mob.stApproved'), color: p.success, bg: p.successBg },
      Rejected: { label: t('mob.stRejected'), color: p.danger, bg: p.dangerBg },
      Done: { label: t('mob.stDone'), color: p.textMuted, bg: p.surfaceAlt }
    } as const
    const c = map[s] ?? map.Done
    return <Badge text={c.label} color={c.color} bg={c.bg} />
  }

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
            <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
              {r.type === 'loan' ? t('mob.reqTypeLoan') : t('mob.reqTypeCorrection')}
            </Text>
            {statusBadge(r.status)}
          </View>
          <Text style={{ color: p.textMuted, fontSize: 12, marginBottom: 6 }}>{r.created_at}</Text>
          {r.type === 'loan' && r.amount != null && (
            <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', marginBottom: 2 }}>{formatCurrency(r.amount)}</Text>
          )}
          {r.purpose ? <Text style={{ color: p.textMuted, fontSize: 14, lineHeight: 19 }}>{r.purpose}</Text> : null}
          {r.message ? <Text style={{ color: p.textMuted, fontSize: 14, lineHeight: 19 }}>{r.message}</Text> : null}
          {r.staff_note ? (
            <View style={{ borderTopWidth: 1, borderTopColor: p.border, marginTop: 8, paddingTop: 8 }}>
              <Text style={{ color: p.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 2 }}>{t('mob.officeNote')}</Text>
              <Text style={{ color: p.text, fontSize: 14, lineHeight: 19 }}>{r.staff_note}</Text>
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  )
}
