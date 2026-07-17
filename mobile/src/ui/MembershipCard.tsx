import React from 'react'
import { Text, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { useT } from '../i18n'
import { elevation, radius, usePalette } from '../theme'
import { interFamily, useType } from '../typography'
import type { Profile } from '../api/hooks'
import { formatDate } from '../lib/date'
import { Badge, BrandGradient } from './index'

// The branded membership card, shared by the Home page (compact) and the
// dedicated card screen (full). Purely presentational — data comes in props.
// Header carries the launcher-icon gradient + a ghost eS watermark so the
// card in hand matches the icon on the shelf.
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
  const ty = useType()
  const active = profile.is_active === 1
  const r = compact ? radius.lg : radius.xl - 4

  return (
    <View
      style={{
        borderRadius: r,
        overflow: 'hidden',
        backgroundColor: p.navy,
        shadowColor: p.navy,
        ...(compact ? elevation.md : elevation.lg)
      }}
    >
      {/* Header */}
      <View style={{ padding: compact ? 16 : 20, paddingBottom: compact ? 12 : 14 }}>
        <BrandGradient />
        <Text
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: -6,
            top: compact ? -18 : -14,
            fontSize: compact ? 88 : 112,
            fontFamily: interFamily.extrabold,
            color: 'rgba(255,255,255,0.08)'
          }}
        >
          eS
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: 'rgba(255,255,255,0.8)', fontSize: compact ? 11 : 12.5, fontFamily: ty.family.bold, letterSpacing: 0.8, textTransform: 'uppercase' }}
        >
          {societyName}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: '#ffffff', fontSize: compact ? 19 : 24, fontFamily: ty.family.extrabold, lineHeight: ty.lh(compact ? 19 : 24), marginTop: compact ? 4 : 7 }}
        >
          {profile.full_name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: compact ? 5 : 7 }}>
          <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: compact ? 13 : 15, fontFamily: interFamily.bold, fontVariant: ['tabular-nums'] }}>
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
      <View style={{ backgroundColor: p.surface, padding: compact ? 16 : 20, flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <View style={{ flex: 1, gap: compact ? 8 : 10 }}>
          <View>
            <Text style={{ color: p.textMuted, fontSize: compact ? 11 : 12, fontFamily: ty.family.semibold }}>{t('mob.nic')}</Text>
            <Text style={{ color: p.text, fontSize: compact ? 14 : 15, fontFamily: interFamily.bold, fontVariant: ['tabular-nums'] }}>{profile.nic}</Text>
          </View>
          <View>
            <Text style={{ color: p.textMuted, fontSize: compact ? 11 : 12, fontFamily: ty.family.semibold }}>{t('mob.joined')}</Text>
            <Text style={{ color: p.text, fontSize: compact ? 14 : 15, fontFamily: interFamily.bold, fontVariant: ['tabular-nums'] }}>
              {formatDate(profile.date_of_joining)}
            </Text>
          </View>
          {!compact && (
            <View>
              <Text style={{ color: p.textMuted, fontSize: 12, fontFamily: ty.family.semibold }}>{t('common.phone')}</Text>
              <Text style={{ color: p.text, fontSize: 15, fontFamily: interFamily.bold, fontVariant: ['tabular-nums'] }}>{profile.phone}</Text>
            </View>
          )}
        </View>
        {/* White tile keeps the QR quiet zone in dark mode too */}
        <View style={{ backgroundColor: '#ffffff', padding: compact ? 8 : 10, borderRadius: radius.md, ...(compact ? null : { shadowColor: p.shadow, ...elevation.sm }) }}>
          <QRCode value={profile.society_id || String(profile.id)} size={compact ? 82 : 110} backgroundColor="#ffffff" color="#0f172a" />
        </View>
      </View>
    </View>
  )
}
