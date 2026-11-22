import React from 'react'
import { Pressable, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import QRCode from 'react-native-qrcode-svg'
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { useT } from '../i18n'
import { elevation, radius, usePalette } from '../theme'
import { interFamily, useType } from '../typography'
import type { Profile } from '../api/hooks'

// The membership card, shared by the Home page (compact) and the dedicated
// card screen (full). Purely presentational — data comes in props. Same design
// as the printed card (web/src/features/members/cards.ts) so the card on the
// phone and the one in the wallet are recognisably the same thing:
//
//   ┌ gradient header: eS tile · "Membership card" · society name (curved edge) ┐
//   │ full name (wraps — a cut-off name reads as a wrong one)                    │
//   │ ┃ MEMBERSHIP NO. 217 (tinted panel)                       ┌────────┐       │
//   │ (id) NIC 806593052V                                         │   QR   │       │
//   │ (☎) Phone 070 136 6809                                      └────────┘       │
//   └ gradient footer: ● Active                                        eSamithi ┘
//
// The header and footer keep the brand blues in both themes — the card is an
// object, like the printed one — and carry white text, which holds AA on them.

const CARD_BLUE = '#1E64D4'
const CARD_DEEP = '#0D3B8C'

// 0701366809 → 070 136 6809; anything else shows as entered.
export function formatPhone(phone: string | null | undefined): string {
  const raw = (phone ?? '').trim()
  const d = raw.replace(/[\s-]/g, '')
  return /^0\d{9}$/.test(d) ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : raw
}

// Android sizes a percentage-sized Svg against nothing useful when the Svg
// itself is absolutely positioned (it drew ~300 × 34 dp and left white text on
// white). So the absolute fill is a View, and the Svg fills that — the same
// pattern as BrandGradient in ./index.tsx.
const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const

function CardGradient({ id }: { id: string }): React.ReactElement {
  return (
    <View pointerEvents="none" style={FILL}>
      <Svg width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0" stopColor={CARD_BLUE} />
            <Stop offset="1" stopColor={CARD_DEEP} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  )
}

export function MembershipCard({
  profile,
  societyName,
  compact = false,
  onQrPress
}: {
  profile: Profile
  societyName: string
  compact?: boolean
  // When set, the QR tile becomes a button (the card screen opens the large view)
  onQrPress?: () => void
}): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const active = profile.is_active === 1
  const r = compact ? radius.lg : radius.xl - 4
  const pad = compact ? 16 : 20
  const tile = compact ? 40 : 48
  const qr = compact ? 104 : 128
  const phone = formatPhone(profile.phone)

  const label = (text: string) => (
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: p.textMuted, fontSize: 12, fontFamily: ty.family.semibold, lineHeight: ty.lh(12), letterSpacing: 0.4 }}>{text}</Text>
  )

  const detail = (icon: 'card-outline' | 'call-outline', name: string, value: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={16} color={p.primaryOnSoft} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {label(name)}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: p.text, fontSize: compact ? 14 : 16, fontFamily: interFamily.bold, lineHeight: compact ? 19 : 22, fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
      </View>
    </View>
  )

  return (
    <View
      style={{
        borderRadius: r,
        overflow: 'hidden',
        backgroundColor: p.surface,
        borderWidth: 1,
        borderColor: p.border,
        shadowColor: p.navy,
        ...(compact ? elevation.md : elevation.lg)
      }}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: pad, paddingTop: compact ? 14 : 18, paddingBottom: compact ? 26 : 30 }}>
        <CardGradient id={compact ? 'cardHeadC' : 'cardHead'} />
        <View pointerEvents="none" style={FILL}>
          <Svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="xMaxYMin slice" pointerEvents="none">
            <Circle cx="92" cy="2" r="22" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="0.8" />
            <Circle cx="92" cy="2" r="31" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
            <Circle cx="92" cy="2" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" />
          </Svg>
        </View>
        <Text pointerEvents="none" style={{ position: 'absolute', right: 8, top: compact ? -24 : -20, fontSize: 100, fontFamily: interFamily.extrabold, color: 'rgba(255,255,255,0.08)' }}>
          eS
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: tile, height: tile, borderRadius: tile * 0.26, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', ...elevation.sm, shadowColor: '#081e46' }}>
            <Text style={{ color: CARD_BLUE, fontSize: compact ? 16 : 18, fontFamily: interFamily.extrabold, letterSpacing: -0.5, marginTop: -1 }}>eS</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: ty.family.semibold, lineHeight: ty.lh(12), letterSpacing: 1.2, textTransform: 'uppercase' }}>
              {t('mob.cardTitle')}
            </Text>
            <Text numberOfLines={2} style={{ color: '#ffffff', fontSize: compact ? 14 : 16, fontFamily: ty.family.bold, lineHeight: ty.lh(compact ? 14 : 16) }}>
              {societyName}
            </Text>
          </View>
        </View>
        {/* Curved edge into the body */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: compact ? 14 : 16 }}>
          <Svg width="100%" height="100%" viewBox="0 0 100 10" preserveAspectRatio="none" pointerEvents="none">
            <Path d="M0 10V7.5C18 1.5 38 1 58 4.5S88 8.5 100 3V10Z" fill={p.surface} />
          </Svg>
        </View>
      </View>

      {/* Body */}
      <View style={{ paddingHorizontal: pad, paddingTop: 2, paddingBottom: compact ? 14 : 18, gap: compact ? 10 : 14 }}>
        {/* The whole name, wrapped — members read a cut-off name as a wrong one */}
        <Text style={{ color: p.text, fontSize: compact ? 18 : 22, fontFamily: ty.family.extrabold, lineHeight: ty.lh(compact ? 18 : 22) }}>{profile.full_name}</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 12 : 16 }}>
          <View style={{ flex: 1, minWidth: 0, gap: compact ? 8 : 10 }}>
            <View style={{ backgroundColor: p.primarySoft, borderRadius: radius.md, paddingVertical: compact ? 6 : 8, paddingLeft: 12, paddingRight: 8, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 }}>
                <CardGradient id={compact ? 'cardBarC' : 'cardBar'} />
              </View>
              {label(t('mob.memberNo'))}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                style={{ color: p.primaryOnSoft, fontSize: compact ? 22 : 28, fontFamily: interFamily.extrabold, lineHeight: compact ? 28 : 34 }}
              >
                {profile.society_id}
              </Text>
            </View>
            {/* Compact: NIC sits beside the QR. Full: NIC and phone get their own
                full-width rows below, so long numbers are never cut off. (The
                card screen says "tap the code" under the card, so no hint here.) */}
            {compact && profile.nic ? detail('card-outline', t('mob.nic'), profile.nic) : null}
          </View>

          {/* White tile keeps the QR quiet zone in dark mode too */}
          <Pressable
            disabled={!onQrPress}
            onPress={onQrPress}
            accessibilityRole={onQrPress ? 'button' : undefined}
            accessibilityLabel={onQrPress ? t('mob.cardLargeLabel') : undefined}
            style={({ pressed }) => ({
              backgroundColor: '#ffffff',
              padding: compact ? 7 : 9,
              borderRadius: radius.md + 2,
              borderWidth: 1,
              borderColor: '#D3DFF3',
              opacity: pressed ? 0.85 : 1,
              ...(compact ? null : { shadowColor: p.shadow, ...elevation.sm })
            })}
          >
            <QRCode value={profile.society_id || String(profile.id)} size={qr} backgroundColor="#ffffff" color="#0f172a" />
          </Pressable>
        </View>

        {!compact && (profile.nic || phone) ? (
          <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: p.border, paddingTop: 14 }}>
            {profile.nic ? detail('card-outline', t('mob.nic'), profile.nic) : null}
            {phone ? detail('call-outline', t('common.phone'), phone) : null}
          </View>
        ) : null}
      </View>

      {/* Footer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pad, paddingVertical: compact ? 6 : 8 }}>
        <CardGradient id={compact ? 'cardFootC' : 'cardFoot'} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: active ? '#4ADE80' : '#F87171' }} />
          <Text style={{ color: '#ffffff', fontSize: 12, fontFamily: ty.family.semibold, lineHeight: ty.lh(12) }}>{active ? t('common.active') : t('common.inactive')}</Text>
        </View>
        <Text style={{ color: '#ffffff', fontSize: 12, fontFamily: interFamily.bold, letterSpacing: 0.5 }}>eSamithi</Text>
      </View>
    </View>
  )
}
