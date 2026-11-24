import React, { useState } from 'react'
import { Linking, Text, View } from 'react-native'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT, type TranslationKey } from '../i18n'
import { spacing, type as typeScale, usePalette } from '../theme'
import { useType } from '../typography'
import { useSocietyInfo } from '../api/hooks'
import { Button, Callout, DetailRow, GroupLabel, LogoTile, ScalePressable, Screen, useCardStyle } from '../ui'

// Help (redesign §6.6.8): how to pay, how to claim, questions that open on
// tap, the office contact with a Call button, and About.
export default function Help(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const card = useCardStyle()
  const society = useSocietyInfo()
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(null)

  const claims: Array<{ title: TranslationKey; body: TranslationKey }> = [
    { title: 'mob.helpClaimFuneral', body: 'mob.helpClaimFuneralBody' },
    { title: 'mob.helpClaimInlaw', body: 'mob.helpClaimInlawBody' },
    { title: 'mob.helpClaimHospital', body: 'mob.helpClaimHospitalBody' },
    { title: 'mob.helpClaimScholarship', body: 'mob.helpClaimScholarshipBody' },
    { title: 'mob.helpClaimBonus', body: 'mob.helpClaimBonusBody' }
  ]
  const faqs: Array<{ q: TranslationKey; a: TranslationKey }> = [
    { q: 'mob.faq1Q', a: 'mob.faq1A' },
    { q: 'mob.faq2Q', a: 'mob.faq2A' },
    { q: 'mob.faq3Q', a: 'mob.faq3A' },
    { q: 'mob.faq4Q', a: 'mob.faq4A' }
  ]

  // One expandable row: the question is a 56 dp button, the answer opens below
  const expandable = (key: string, icon: keyof typeof Ionicons.glyphMap, title: string, body: string, first: boolean): React.ReactElement => {
    const isOpen = open === key
    return (
      <View key={key} style={{ borderTopWidth: first ? 0 : 1, borderTopColor: p.border }}>
        <ScalePressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          onPress={() => setOpen(isOpen ? null : key)}
          scaleTo={0.99}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm }}
        >
          <Ionicons name={icon} size={20} color={p.primary} />
          <Text style={{ flex: 1, color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body) }}>{title}</Text>
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={p.textMuted} />
        </ScalePressable>
        {isOpen ? (
          <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption), paddingLeft: spacing.xl + spacing.md, paddingBottom: spacing.md }}>{body}</Text>
        ) : null}
      </View>
    )
  }

  const phone = society.data?.society_phone?.trim()
  const address = society.data?.society_address?.trim()

  return (
    <Screen>
      <GroupLabel>{t('mob.helpPayTitle')}</GroupLabel>
      <Callout icon="cash-outline" tone="brand" text={t('mob.helpPayBody')} />

      <GroupLabel>{t('mob.helpClaimTitle')}</GroupLabel>
      <View style={[card, { paddingHorizontal: spacing.lg }]}>
        <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption), paddingTop: spacing.md }}>{t('mob.helpClaimIntro')}</Text>
        {claims.map((c, i) => expandable(c.title, 'checkmark-circle-outline', t(c.title), t(c.body), i === 0))}
      </View>

      <GroupLabel>{t('mob.faqTitle')}</GroupLabel>
      <View style={[card, { paddingHorizontal: spacing.lg }]}>
        {faqs.map((f, i) => expandable(f.q, 'help-circle-outline', t(f.q), t(f.a), i === 0))}
      </View>

      {phone || address ? (
        <>
          <GroupLabel>{t('mob.officeContact')}</GroupLabel>
          <View style={[card, { paddingHorizontal: spacing.lg, paddingBottom: phone ? spacing.lg : 0 }]}>
            {phone ? <DetailRow first icon="call-outline" label={t('common.phone')} value={phone} /> : null}
            {address ? <DetailRow first={!phone} icon="location-outline" label={t('mob.address')} value={address} /> : null}
            {phone ? <Button label={t('mob.callOffice')} icon="call-outline" onPress={() => { Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => {}) }} /> : null}
          </View>
        </>
      ) : null}

      <GroupLabel>{t('mob.meSafety')}</GroupLabel>
      <Callout icon="shield-checkmark-outline" tone="brand" text={t('mob.reportIntro')}>
        <Button label={t('mob.reportConcern')} variant="secondary" icon="flag-outline" onPress={() => router.push('/report')} />
      </Callout>

      <GroupLabel>{t('mob.aboutTitle')}</GroupLabel>
      <View style={[card, { padding: spacing.lg, alignItems: 'center', gap: spacing.sm }]}>
        <LogoTile size={48} />
        <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.body), textAlign: 'center' }}>{society.data?.society_name ?? 'Maranadhara Samithi'}</Text>
        <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{t('mob.version', { v: Constants.expoConfig?.version ?? '1.0.0' })}</Text>
      </View>
    </Screen>
  )
}
