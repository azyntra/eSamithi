import React from 'react'
import { Text, View } from 'react-native'
import Constants from 'expo-constants'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT, type TranslationKey } from '../i18n'
import { usePalette } from '../theme'
import { useSocietyInfo } from '../api/hooks'
import { Card, Row, Screen, SectionHeader } from '../ui'

// Static help content (§3.4 how to pay, §4.4 how to claim, §6.4 FAQ/About)
export default function Help(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const society = useSocietyInfo()

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

  return (
    <Screen>
      <SectionHeader>{t('mob.helpPayTitle')}</SectionHeader>
      <Card>
        <Text style={{ color: p.text, fontSize: 15, lineHeight: 22 }}>{t('mob.helpPayBody')}</Text>
      </Card>

      <SectionHeader>{t('mob.helpClaimTitle')}</SectionHeader>
      <Card>
        <Text style={{ color: p.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 10 }}>{t('mob.helpClaimIntro')}</Text>
        {claims.map((c, i) => (
          <View key={c.title} style={{ paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="checkmark-circle-outline" size={17} color={p.success} />
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', flex: 1 }}>{t(c.title)}</Text>
            </View>
            <Text style={{ color: p.textMuted, fontSize: 14, lineHeight: 20, paddingLeft: 25 }}>{t(c.body)}</Text>
          </View>
        ))}
      </Card>

      {society.isSuccess && (society.data.society_phone || society.data.society_address) && (
        <>
          <SectionHeader>{t('mob.officeContact')}</SectionHeader>
          <Card>
            {society.data.society_phone && <Row label={t('common.phone')} value={society.data.society_phone} />}
            {society.data.society_address && <Row label={t('mob.address')} value={society.data.society_address} />}
          </Card>
        </>
      )}

      <SectionHeader>{t('mob.faqTitle')}</SectionHeader>
      <Card>
        {faqs.map((f, i) => (
          <View key={f.q} style={{ paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border }}>
            <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', marginBottom: 4 }}>{t(f.q)}</Text>
            <Text style={{ color: p.textMuted, fontSize: 14, lineHeight: 20 }}>{t(f.a)}</Text>
          </View>
        ))}
      </Card>

      <SectionHeader>{t('mob.aboutTitle')}</SectionHeader>
      <Card>
        <Row label={t('mob.societyInfo')} value={society.data?.society_name ?? 'Maranadhara Samithi'} />
        <Row label={t('mob.version', { v: '' }).replace(/\s*$/, '')} value={Constants.expoConfig?.version ?? '1.0.0'} />
      </Card>
    </Screen>
  )
}
