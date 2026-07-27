import React from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../../i18n'
import { radius, spacing, usePalette } from '../../../theme'
import { interFamily, useType } from '../../../typography'
import { formatDate } from '../../../lib/date'
import { useReceipt, type ReceiptKind } from '../../../api/hooks'
import { Badge, Card, ErrorView, LoadingView, Money, Row, Screen } from '../../../ui'

const KINDS: ReceiptKind[] = ['income', 'expense', 'loan-payment']

// The member-facing twin of the desktop's printed receipt: same fields, same
// receipt number, laid out for a phone. Members are told to keep their paper
// receipt — this is the copy they can't lose.
export default function ReceiptScreen(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const params = useLocalSearchParams<{ kind: string; id: string }>()

  const kind = (KINDS.includes(params.kind as ReceiptKind) ? params.kind : 'income') as ReceiptKind
  const id = parseInt(params.id ?? '0', 10)
  const receipt = useReceipt(kind, id)

  if (receipt.isPending) return <Screen><LoadingView /></Screen>
  if (receipt.isError || !receipt.data) {
    return (
      <Screen refreshing={receipt.isRefetching} onRefresh={() => receipt.refetch()}>
        <ErrorView onRetry={() => receipt.refetch()} />
      </Screen>
    )
  }

  const r = receipt.data
  const voided = r.status !== 'Active'

  const title =
    kind === 'income' ? t('mob.rcptIncomeTitle')
    : kind === 'expense' ? t('mob.rcptExpenseTitle')
    : t('mob.rcptLoanTitle')

  const amountLabel =
    kind === 'income' ? t('mob.rcptAmountReceived')
    : kind === 'expense' ? t('mob.rcptAmountPaid')
    : t('mob.rcptTotalPaid')

  const paymentMethod = (m?: string | null): string => {
    if (!m) return '—'
    if (m === 'Cash') return t('mob.rcptPmCash')
    if (m === 'Bank Transfer') return t('mob.rcptPmBankTransfer')
    if (m === 'Cheque') return t('mob.rcptPmCheque')
    return m
  }

  return (
    <Screen refreshing={receipt.isRefetching} onRefresh={() => receipt.refetch()}>
      <Card style={{ paddingTop: spacing.xl }}>
        {/* Letterhead */}
        <View style={{ alignItems: 'center', paddingBottom: spacing.lg, borderBottomWidth: 2, borderBottomColor: p.text, marginBottom: spacing.md }}>
          <Text style={{ color: p.text, fontSize: 18, fontFamily: ty.family.extrabold, lineHeight: ty.lh(18), textAlign: 'center' }}>
            {r.society.name || 'eSamithi'}
          </Text>
          <Text style={{ color: p.textMuted, fontSize: 13, fontFamily: ty.family.regular, lineHeight: ty.lh(13), marginTop: 4 }}>
            {title}
          </Text>
          {voided && (
            <View style={{ marginTop: spacing.sm }}>
              <Badge text={t('mob.voided')} color="#fff" bg={p.danger} />
            </View>
          )}
        </View>

        <Row label={t('mob.rcptNo')} value={<Text style={{ fontFamily: interFamily.semibold, color: p.text }}>{r.receipt_no}</Text>} />
        <Row label={t('common.date')} value={formatDate(r.date)} />

        {kind === 'income' && (
          <>
            <Row label={t('mob.rcptReceivedFrom')} value={r.member.full_name ?? '—'} />
            {!!r.member.nic && <Row label={t('mob.nic')} value={r.member.nic} />}
            <Row label={t('mob.rcptType')} value={r.type_name ?? '—'} />
            {!!r.months_covered && <Row label={t('mob.rcptMonthsCovered')} value={r.months_covered} />}
            <Row label={t('mob.rcptPaymentMethod')} value={paymentMethod(r.payment_method)} />
          </>
        )}

        {kind === 'expense' && (
          <>
            <Row label={t('mob.rcptPaidTo')} value={r.member.full_name ?? '—'} />
            {!!r.member.nic && <Row label={t('mob.nic')} value={r.member.nic} />}
            <Row label={t('mob.rcptType')} value={r.type_name ?? '—'} />
            <Row label={t('mob.rcptPaymentMethod')} value={paymentMethod(r.payment_method)} />
          </>
        )}

        {kind === 'loan-payment' && (
          <>
            <Row label={t('mob.rcptBorrower')} value={r.member.full_name ?? '—'} />
            <Row label={t('mob.rcptLoanRef')} value={`#${r.loan_id ?? '—'}`} />
            <Row label={t('mob.rcptAppliedFine')} value={<Money cents={r.fines_paid ?? 0} size={14} />} />
            <Row label={t('mob.rcptAppliedInterest')} value={<Money cents={r.interest_paid ?? 0} size={14} />} />
            <Row label={t('mob.rcptAppliedPrincipal')} value={<Money cents={r.principal_paid ?? 0} size={14} />} />
          </>
        )}

        {/* Total */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: p.border, borderStyle: 'dashed', marginTop: spacing.md, paddingTop: spacing.md }}>
          <Text style={{ color: p.text, fontSize: 14, fontFamily: ty.family.bold, lineHeight: ty.lh(14), flexShrink: 1, marginRight: spacing.md }}>
            {amountLabel}
          </Text>
          <Money cents={r.amount} size={20} bold color={voided ? p.textMuted : p.primary} />
        </View>

        {!!r.notes && (
          <Text style={{ color: p.textMuted, fontSize: 12, fontFamily: ty.family.regular, lineHeight: ty.lh(12), marginTop: spacing.md }}>
            {r.notes}
          </Text>
        )}
        {kind === 'loan-payment' && (
          <Text style={{ color: p.textMuted, fontSize: 12, fontFamily: ty.family.regular, lineHeight: ty.lh(12), marginTop: spacing.md }}>
            {t('mob.rcptAllocationNote')}
          </Text>
        )}
      </Card>

      {/* This is a record, not a substitute for the office's paper receipt */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: p.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md }}>
        <Ionicons name="information-circle-outline" size={17} color={p.textMuted} style={{ marginTop: 1 }} />
        <Text style={{ color: p.textMuted, fontSize: 12.5, fontFamily: ty.family.regular, lineHeight: ty.lh(12.5), flex: 1 }}>
          {t('mob.rcptFooterNote')}
        </Text>
      </View>
    </Screen>
  )
}
