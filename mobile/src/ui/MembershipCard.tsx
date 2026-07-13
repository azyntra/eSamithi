import React from 'react'
import { Text, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { useT } from '../i18n'
import { usePalette } from '../theme'
import type { Profile } from '../api/hooks'
import { formatDate } from '../lib/date'
import { Badge } from './index'

// The branded membership card, shared by the Home page (compact) and the
// dedicated card screen (full). Purely presentational — data comes in props.
export function MembershipCard({
  profile,
  societyName,
  compact = false
}: {
  profile: Profile
  societyName: string
  compact?: boolean
}): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const active = profile.is_active === 1

  return (
    <View
      style={{
        borderRadius: compact ? 16 : 20,
        overflow: 'hidden',
        backgroundColor: p.primaryDark,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: compact ? 8 : 12,
        shadowOffset: { width: 0, height: compact ? 3 : 6 },
        elevation: compact ? 5 : 8
      }}
    >
      {/* Header */}
      <View style={{ padding: compact ? 14 : 18, paddingBottom: compact ? 10 : 12 }}>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: compact ? 11 : 13, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
          {societyName}
        </Text>
        <Text style={{ color: '#fff', fontSize: compact ? 19 : 24, fontWeight: '800', marginTop: compact ? 3 : 6 }} numberOfLines={1}>
          {profile.full_name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: compact ? 4 : 6 }}>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: compact ? 13 : 15, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            {profile.society_id}
          </Text>
          <Badge
            text={active ? t('common.active') : t('common.inactive')}
            color={active ? '#166534' : '#7f1d1d'}
            bg={active ? '#bbf7d0' : '#fecaca'}
          />
        </View>
      </View>

      {/* Body */}
      <View style={{ backgroundColor: p.surface, padding: compact ? 14 : 18, flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <View style={{ flex: 1, gap: compact ? 6 : 8 }}>
          <View>
            <Text style={{ color: p.textMuted, fontSize: compact ? 11 : 12, fontWeight: '600' }}>{t('mob.nic')}</Text>
            <Text style={{ color: p.text, fontSize: compact ? 14 : 15, fontWeight: '700' }}>{profile.nic}</Text>
          </View>
          <View>
            <Text style={{ color: p.textMuted, fontSize: compact ? 11 : 12, fontWeight: '600' }}>{t('mob.joined')}</Text>
            <Text style={{ color: p.text, fontSize: compact ? 14 : 15, fontWeight: '700' }}>{formatDate(profile.date_of_joining)}</Text>
          </View>
          {!compact && (
            <View>
              <Text style={{ color: p.textMuted, fontSize: 12, fontWeight: '600' }}>{t('common.phone')}</Text>
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>{profile.phone}</Text>
            </View>
          )}
        </View>
        <View style={{ backgroundColor: '#fff', padding: compact ? 6 : 8, borderRadius: 12 }}>
          <QRCode value={profile.society_id || String(profile.id)} size={compact ? 84 : 110} backgroundColor="#ffffff" color="#0f172a" />
        </View>
      </View>
    </View>
  )
}
