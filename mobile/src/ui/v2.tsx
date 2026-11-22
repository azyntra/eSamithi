import React, { useId } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import Ionicons from '@expo/vector-icons/Ionicons'
import { elevation, radius, spacing, type as typeScale, usePalette, useThemeMode } from '../theme'
import { interFamily, useType } from '../typography'
import { useT } from '../i18n'
import { formatCurrency } from '../lib/money'
import { ScalePressable } from './pressable'

// eSamithi Calm components (docs/MOBILE-APP-REDESIGN-REQUIREMENTS.md §5).
// Same rules as ui/index.tsx: tokens only, Sinhala first, ≥ 48 dp targets, and
// every SVG fill inside an absolute-fill View — never an absolutely positioned,
// percentage-sized Svg, which Android draws at a fraction of its box.

type IconName = keyof typeof Ionicons.glyphMap

// "Hide amounts" (Home, for a shared phone): the figure becomes dots
export const maskedOr = (cents: number, hidden?: boolean): string => (hidden ? 'Rs. ••••' : formatCurrency(cents))
type Tone = 'success' | 'warning' | 'danger' | 'memorial' | 'brand'

const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const
const { elevation: _droppedAndroidElevation, ...cardShadowIos } = elevation.sm

export function useTone(tone: Tone | undefined): { fg: string; bg: string } {
  const p = usePalette()
  switch (tone) {
    case 'success': return { fg: p.success, bg: p.successBg }
    case 'warning': return { fg: p.warning, bg: p.warningBg }
    case 'danger': return { fg: p.danger, bg: p.dangerBg }
    case 'memorial': return { fg: p.memorial, bg: p.memorialBg }
    case 'brand': return { fg: p.primaryOnSoft, bg: p.primarySoft }
    default: return { fg: p.primary, bg: p.surfaceAlt }
  }
}

// The three-stop hero gradient of the membership card, as an absolute fill.
export function HeroGradient({ rounded = 0, bottomOnly = false }: { rounded?: number; bottomOnly?: boolean }): React.ReactElement {
  const p = usePalette()
  const id = `hero${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const corners = bottomOnly ? { borderBottomLeftRadius: rounded, borderBottomRightRadius: rounded } : { borderRadius: rounded }
  return (
    <View pointerEvents="none" style={[FILL, corners, { overflow: 'hidden' }]}>
      <Svg width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0" stopColor={p.heroStart} />
            <Stop offset="0.55" stopColor={p.heroMid} />
            <Stop offset="1" stopColor={p.heroEnd} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {/* Faint rings, as on the card — decoration only */}
      <View style={FILL}>
        <Svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="xMaxYMin slice" pointerEvents="none">
          <Circle cx="92" cy="0" r="26" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="0.6" />
          <Circle cx="92" cy="0" r="38" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.6" />
          <Circle cx="92" cy="0" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.6" />
        </Svg>
      </View>
    </View>
  )
}

// The white eS tile used on gradients (hero, Me card)
export function LogoChip({ size = 36 }: { size?: number }): React.ReactElement {
  const p = usePalette()
  // The letters grow with the tile, staying on the type scale
  const letters = size >= 80 ? typeScale.hero : size >= 44 ? typeScale.heading : typeScale.caption
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: p.onHero, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: p.heroStart, fontFamily: interFamily.extrabold, fontSize: letters, letterSpacing: -0.5 }}>eS</Text>
    </View>
  )
}

// Title at the top of a tab screen (the tabs hide their native header so the
// title can sit in the page, large, the way the mockups draw it).
export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const insets = useSafeAreaInsets()
  return (
    <View style={{ paddingTop: insets.top + spacing.sm, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={{ color: p.text, fontSize: typeScale.display, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.display) }}>{title}</Text>
        {subtitle ? (
          <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  )
}

// Section heading with an optional "See all" link (48 dp tall target)
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.xs }}>
      <Text accessibilityRole="header" style={{ color: p.text, fontSize: typeScale.heading, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.heading), flex: 1 }}>{title}</Text>
      {action && onAction ? (
        <ScalePressable accessibilityRole="link" onPress={onAction} style={{ minHeight: 48, justifyContent: 'center', paddingLeft: spacing.md }}>
          <Text style={{ color: p.primary, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption) }}>{action}</Text>
        </ScalePressable>
      ) : null}
    </View>
  )
}

// White card on the hero answering "am I OK?"; translucent in dark mode
export function StatusCard({
  tone,
  title,
  sub,
  onPress
}: {
  tone: 'ok' | 'due' | 'overdue'
  title: string
  sub?: string
  onPress?: () => void
}): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const { scheme } = useThemeMode()
  const dark = scheme === 'dark'
  const t = useTone(tone === 'ok' ? 'success' : tone === 'due' ? 'warning' : 'danger')
  const fg = dark ? p.onHero : p.text
  const icon: IconName = tone === 'ok' ? 'checkmark' : tone === 'due' ? 'time-outline' : 'alert'
  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={sub ? `${title}. ${sub}` : title}
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.98}
      style={{
        marginTop: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderRadius: radius.lg,
        padding: spacing.md + 2,
        backgroundColor: dark ? p.heroGlass : p.surface
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: dark ? p.heroGlass : t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={24} color={dark ? p.onHero : t.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: fg, fontSize: typeScale.heading, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.heading) }}>{title}</Text>
        {sub ? <Text style={{ color: dark ? p.onHeroMuted : p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>{sub}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={20} color={fg} /> : null}
    </ScalePressable>
  )
}

// Round icon button with a label under it (Home quick actions)
export function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const { scheme } = useThemeMode()
  return (
    <ScalePressable accessibilityRole="button" accessibilityLabel={label} haptic="selection" onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: spacing.xs + 2, minHeight: 48 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: p.surface,
          borderWidth: 1,
          borderColor: p.border,
          alignItems: 'center',
          justifyContent: 'center',
          ...(scheme === 'dark' ? null : { shadowColor: p.shadow, ...cardShadowIos })
        }}
      >
        <Ionicons name={icon} size={24} color={p.primary} />
      </View>
      <Text numberOfLines={2} style={{ color: p.text, fontSize: typeScale.micro, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.micro), textAlign: 'center' }}>{label}</Text>
    </ScalePressable>
  )
}

// Card surface shared by the v2 tiles (hairline + iOS-only shadow)
export function useCardStyle(): ViewStyle {
  const p = usePalette()
  const { scheme } = useThemeMode()
  return {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    ...(scheme === 'dark' ? null : { shadowColor: p.shadow, ...cardShadowIos })
  }
}

// Half-width summary tile: icon, label, amount, sub-line
export function StatTile({
  icon,
  tone,
  label,
  cents,
  amountColor,
  sub,
  onPress,
  style,
  hidden
}: {
  icon: IconName
  tone?: Tone
  label: string
  cents: number
  amountColor?: string
  sub?: string
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  hidden?: boolean
}): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const card = useCardStyle()
  const t = useTone(tone)
  return (
    <ScalePressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${maskedOr(cents, hidden)}${sub ? `. ${sub}` : ''}`}
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.98}
      style={[card, { flex: 1, padding: spacing.md + 2 }, style]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={t.fg} />
        </View>
        <Text numberOfLines={2} style={{ flex: 1, color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.micro) }}>{label}</Text>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{ marginTop: spacing.sm + 2, color: amountColor ?? p.text, fontSize: typeScale.heading, fontFamily: interFamily.extrabold, fontVariant: ['tabular-nums'], letterSpacing: -0.3 }}
      >
        {maskedOr(cents, hidden)}
      </Text>
      {sub ? <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro), marginTop: 2 }}>{sub}</Text> : null}
    </ScalePressable>
  )
}

// The one amount a money screen exists to show
export function AmountHero({
  label,
  cents,
  tone,
  sub,
  icon
}: {
  label: string
  cents: number
  tone?: 'success' | 'warning' | 'danger'
  sub?: string
  icon?: IconName
}): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const card = useCardStyle()
  const t = useTone(tone)
  return (
    <View accessible accessibilityLabel={`${label}: ${formatCurrency(cents)}${sub ? `. ${sub}` : ''}`} style={[card, { padding: spacing.xl, alignItems: 'center', marginBottom: spacing.md }]}>
      {icon ? (
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm + 2 }}>
          <Ionicons name={icon} size={28} color={t.fg} />
        </View>
      ) : null}
      <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption) }}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{ color: tone ? t.fg : p.text, fontSize: typeScale.hero, fontFamily: interFamily.extrabold, fontVariant: ['tabular-nums'], letterSpacing: -0.6 }}
      >
        {formatCurrency(cents)}
      </Text>
      {sub ? <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption), textAlign: 'center' }}>{sub}</Text> : null}
    </View>
  )
}

// Full-width segmented tabs (My Money). 48 dp; Sinhala labels may wrap.
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const { scheme } = useThemeMode()
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: spacing.xs, backgroundColor: p.surfaceAlt, borderWidth: 1, borderColor: p.border, borderRadius: radius.md, padding: spacing.xs }}>
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <ScalePressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            haptic="selection"
            scaleTo={0.97}
            onPress={() => onChange(opt.value)}
            style={{
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing.xs,
              borderRadius: radius.sm,
              backgroundColor: selected ? p.surface : 'transparent',
              ...(selected && scheme !== 'dark' ? { shadowColor: p.shadow, ...cardShadowIos } : null),
              ...(selected && scheme === 'dark' ? { borderWidth: 1, borderColor: p.borderStrong } : null)
            }}
          >
            <Text style={{ color: selected ? p.text : p.textMuted, fontSize: typeScale.caption, fontFamily: selected ? ty.family.bold : ty.family.semibold, lineHeight: ty.lh(typeScale.caption), textAlign: 'center' }}>
              {opt.label}
            </Text>
          </ScalePressable>
        )
      })}
    </View>
  )
}

// Day-over-month tile for timelines, meetings and funerals
export function DateBlock({ date, tone, large }: { date: string; tone?: Tone; large?: boolean }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const { monthsShort } = useT()
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date))
  const day = m ? m[3] : '—'
  const mon = m ? (monthsShort[Number(m[2]) - 1] ?? '') : ''
  const t = useTone(tone)
  const bg = tone ? t.bg : p.surfaceAlt
  const fg = tone === 'brand' ? t.fg : p.text
  return (
    <View style={{ width: large ? 52 : 44, height: large ? 60 : 50, borderRadius: radius.sm + 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontSize: large ? typeScale.title : typeScale.heading, fontFamily: interFamily.extrabold, fontVariant: ['tabular-nums'], lineHeight: large ? 26 : 22 }}>{day}</Text>
      <Text style={{ color: tone === 'brand' ? t.fg : p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.micro) }}>{mon}</Text>
    </View>
  )
}

// A dated money movement: contributions, payouts, repayments, recent activity
export function TimelineRow({
  date,
  title,
  sub,
  cents,
  direction,
  muted,
  status,
  onPress,
  first,
  hidden
}: {
  date: string
  title: string
  sub?: string
  cents: number
  direction?: 'in' | 'out'
  muted?: boolean
  status?: React.ReactNode
  onPress?: () => void
  first?: boolean
  hidden?: boolean
}): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const sign = direction === 'in' ? '+ ' : direction === 'out' ? '− ' : ''
  const color = muted ? p.textMuted : direction === 'in' ? p.success : p.text
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingVertical: spacing.sm, borderTopWidth: first ? 0 : 1, borderTopColor: p.border }}>
      <DateBlock date={date} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body) }}>{title}</Text>
        {sub ? <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{sub}</Text> : null}
        {status ? <View style={{ marginTop: spacing.xs }}>{status}</View> : null}
      </View>
      <Text style={{ color, fontSize: typeScale.body, fontFamily: interFamily.bold, fontVariant: ['tabular-nums'], textDecorationLine: muted ? 'line-through' : 'none' }}>
        {sign}{maskedOr(cents, hidden)}
      </Text>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={p.textMuted} /> : null}
    </View>
  )
  if (!onPress) return body
  return (
    <ScalePressable accessibilityRole="button" accessibilityLabel={`${title}, ${sign}${maskedOr(cents, hidden)}`} onPress={onPress} scaleTo={0.99}>
      {body}
    </ScalePressable>
  )
}

// Repayment ring with the percentage in the middle
export function LoanRing({ fraction, tone, size = 76, label }: { fraction: number; tone: 'success' | 'danger'; size?: number; label?: string }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const stroke = size >= 90 ? 9 : 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const f = Math.max(0, Math.min(1, fraction))
  const color = tone === 'danger' ? p.danger : p.success
  const pctSize = size >= 90 ? typeScale.title : typeScale.heading
  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={`${Math.round(f * 100)}%`}>
      <Svg width={size} height={size} pointerEvents="none">
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.border} strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * f} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[FILL, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: p.text, fontSize: pctSize, fontFamily: interFamily.extrabold, fontVariant: ['tabular-nums'] }}>{Math.round(f * 100)}%</Text>
        {label ? <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{label}</Text> : null}
      </View>
    </View>
  )
}

// Tinted full-width banner that leads somewhere (My Money dues banner)
export function AlertBanner({ tone, icon, title, sub, onPress }: { tone: 'warning' | 'danger'; icon: IconName; title: string; sub?: string; onPress?: () => void }): React.ReactElement {
  const ty = useType()
  const t = useTone(tone)
  return (
    <ScalePressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.98}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: t.bg, borderRadius: radius.md, padding: spacing.md, minHeight: 56, marginBottom: spacing.md }}
    >
      <Ionicons name={icon} size={24} color={t.fg} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.fg, fontSize: typeScale.body, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.body) }}>{title}</Text>
        {sub ? <Text style={{ color: t.fg, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{sub}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={t.fg} /> : null}
    </ScalePressable>
  )
}

// Initials on the hero gradient
export function Avatar({ name, size = 44 }: { name: string; size?: number }): React.ReactElement {
  const p = usePalette()
  const initialsSize = size >= 60 ? typeScale.title : typeScale.body
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?'
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <HeroGradient rounded={size / 2} />
      <Text style={{ color: p.onHero, fontFamily: interFamily.extrabold, fontSize: initialsSize }}>{initials}</Text>
    </View>
  )
}

// Small label above a group of rows (Me). Not uppercased or letter-spaced:
// Sinhala has no case, and tracking pulls its stacked marks apart.
export function GroupLabel({ children }: { children: string }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  return (
    <Text accessibilityRole="header" style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption), marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
      {children}
    </Text>
  )
}

// Rows of a list split across FlatList items still read as one card: the
// first row rounds the top, the last rounds the bottom.
export function useListCardEdge(): (first: boolean, last: boolean) => ViewStyle {
  const p = usePalette()
  return (first, last) => ({
    backgroundColor: p.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: p.border,
    borderTopWidth: first ? 1 : 0,
    borderBottomWidth: last ? 1 : 0,
    borderTopLeftRadius: first ? radius.lg : 0,
    borderTopRightRadius: first ? radius.lg : 0,
    borderBottomLeftRadius: last ? radius.lg : 0,
    borderBottomRightRadius: last ? radius.lg : 0,
    paddingHorizontal: spacing.md + 2,
    marginBottom: last ? spacing.md : 0
  })
}

// Bottom sheet on RN's own Modal (no native module, so OTA-safe): grabber,
// title, content, and one pinned primary action. Backdrop and back button close.
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer
}: {
  visible: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const { t } = useT()
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={onClose} style={[FILL, { backgroundColor: p.overlay }]} />
        <View style={{ backgroundColor: p.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '85%' }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: p.border, marginTop: spacing.sm, marginBottom: spacing.md }} />
          <Text accessibilityRole="header" style={{ color: p.text, fontSize: typeScale.heading, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.heading), marginBottom: spacing.md }}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
          {footer ? <View style={{ marginTop: spacing.md }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  )
}

// Floating action button on the hero gradient (gradient behind a full-size
// Pressable, never a child of it — Android SVG swallows touches)
export function Fab({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  return (
    <View style={{ position: 'absolute', right: spacing.lg, bottom: spacing.lg, borderRadius: 28, overflow: 'hidden', shadowColor: p.heroEnd, ...elevation.md }}>
      <HeroGradient rounded={28} />
      <ScalePressable accessibilityRole="button" accessibilityLabel={label} haptic="impact" onPress={onPress} style={{ minHeight: 56, paddingLeft: spacing.lg, paddingRight: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name={icon} size={24} color={p.onHero} />
        <Text style={{ color: p.onHero, fontSize: typeScale.body, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.body) }}>{label}</Text>
      </ScalePressable>
    </View>
  )
}

// Label above value, so long values (addresses, names, bank details) wrap
// instead of truncating (redesign §6.6.1)
export function DetailRow({ icon, label, value, first, right }: { icon?: IconName; label: string; value: string | null | undefined; first?: boolean; right?: React.ReactNode }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm, borderTopWidth: first ? 0 : 1, borderTopColor: p.border }}>
      {icon ? (
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={p.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{label}</Text>
        <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body) }}>{value && String(value).trim() ? value : '—'}</Text>
      </View>
      {right}
    </View>
  )
}

// Quiet information box with an optional action
export function Callout({ icon = 'information-circle-outline', text, tone, children }: { icon?: IconName; text: string; tone?: 'brand' | 'warning'; children?: React.ReactNode }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const bg = tone === 'brand' ? p.primarySoft : tone === 'warning' ? p.warningBg : p.surfaceAlt
  const fg = tone === 'brand' ? p.primaryOnSoft : tone === 'warning' ? p.warning : p.textMuted
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm + 2 }}>
        <Ionicons name={icon} size={20} color={fg} />
        <Text style={{ flex: 1, color: fg, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>{text}</Text>
      </View>
      {children ? <View style={{ marginTop: spacing.sm }}>{children}</View> : null}
    </View>
  )
}

// The member header used by Profile: avatar, name, member number
export function MemberHeader({ name, sub }: { name: string; sub: string }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
      <Avatar name={name} size={72} />
      <Text style={{ color: p.text, fontSize: typeScale.title, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.title), marginTop: spacing.md, textAlign: 'center' }}>{name}</Text>
      <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption), textAlign: 'center' }}>{sub}</Text>
    </View>
  )
}

// Shown while the app restores the session and while the fingerprint prompt
// is up: the same gradient and white eS tile as Welcome and the splash, so
// launch reads as one continuous brand moment instead of a bare spinner.
export function BrandLoading(): React.ReactElement {
  const p = usePalette()
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <HeroGradient />
      <LogoChip size={96} />
      <ActivityIndicator color={p.onHero} style={{ marginTop: spacing.xxl }} />
    </View>
  )
}

// Two-tone line illustration for empty states (redesign §3.6): a tinted disc,
// a white plate with the subject icon, and three small accents. Drawn from
// tokens, so it follows the theme and needs no image download.
export function EmptyIllustration({ icon }: { icon: IconName }): React.ReactElement {
  const p = usePalette()
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 112, height: 112, borderRadius: 56, backgroundColor: p.primarySoft }} />
      <View style={{ position: 'absolute', top: 10, right: 12, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: p.primary }} />
      <View style={{ position: 'absolute', bottom: 16, left: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: p.primary }} />
      <View style={{ position: 'absolute', top: 22, left: 14, width: 6, height: 6, borderRadius: 3, backgroundColor: p.borderStrong }} />
      <View style={{ width: 64, height: 64, borderRadius: radius.md + 4, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.primary, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] }}>
        <Ionicons name={icon} size={30} color={p.primary} />
      </View>
    </View>
  )
}
