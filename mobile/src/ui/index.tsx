import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated'
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg'
import Ionicons from '@expo/vector-icons/Ionicons'
import { elevation, radius, spacing, type as typeScale, usePalette, useThemeMode } from '../theme'
import { interFamily, useType } from '../typography'
import { useT } from '../i18n'
import { formatCurrency } from '../lib/money'
import { ScalePressable } from './pressable'

// Small shared UI kit — large touch targets and font scaling stay enabled
// throughout (many members are elderly; see NFRs in the requirements doc).
// Every visual here is token-driven (theme.tsx + typography.tsx) so light,
// dark, Sinhala and English all come out of the same components.

export { ScalePressable } from './pressable'
export { ToastProvider, useToast } from './toast'
export { TabBar } from './TabBar'

// ---- Brand ---------------------------------------------------------------

// The 135° icon gradient as an absolute fill — the primitive behind primary
// buttons, the membership card header and hero blocks.
export function BrandGradient({ rounded = 0, style }: { rounded?: number; style?: StyleProp<ViewStyle> }): React.ReactElement {
  const p = usePalette()
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: rounded, overflow: 'hidden' }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <SvgLinearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0" stopColor={p.gradStart} />
            <Stop offset="1" stopColor={p.gradEnd} />
          </SvgLinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#brand)" />
      </Svg>
    </View>
  )
}

// The eS launcher tile, in-app (Welcome hero, About footer)
export function LogoTile({ size = 64 }: { size?: number }): React.ReactElement {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <BrandGradient rounded={size * 0.27} />
      <Text style={{ color: '#ffffff', fontFamily: interFamily.extrabold, fontSize: size * 0.4, marginTop: -size * 0.02 }}>eS</Text>
    </View>
  )
}

// iOS-only soft card shadow: the elevation presets minus the `elevation`
// key, so Android renders a clean hairline with no shadow smudge.
const { elevation: _cardElevationDropped, ...cardShadowIos } = elevation.sm

// ---- Layout --------------------------------------------------------------

export function Screen({
  children,
  refreshing,
  onRefresh,
  padded = true
}: {
  children: React.ReactNode
  refreshing?: boolean
  onRefresh?: () => void
  padded?: boolean
}): React.ReactElement {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: padded ? spacing.lg : 0, paddingBottom: insets.bottom + spacing.xxxl }}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={p.primary} colors={[p.primary]} /> : undefined
      }
    >
      {children}
    </ScrollView>
  )
}

export function Card({
  children,
  style,
  onPress
}: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  onPress?: () => void
}): React.ReactElement {
  const p = usePalette()
  const { scheme } = useThemeMode()
  const base: ViewStyle = {
    backgroundColor: scheme === 'dark' ? p.surface : p.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    // Hairline border in BOTH schemes; light adds an iOS-only soft shadow.
    // Android `elevation` is deliberately absent — its baked-in shadow
    // smudges around large corner radii on real devices.
    borderWidth: 1,
    borderColor: p.border,
    ...(scheme === 'dark' ? null : { shadowColor: p.shadow, ...cardShadowIos })
  }
  if (onPress) {
    return (
      <ScalePressable accessibilityRole="button" onPress={onPress} scaleTo={0.98} style={[base, style]}>
        {children}
      </ScalePressable>
    )
  }
  return <View style={[base, style]}>{children}</View>
}

// ---- Text ----------------------------------------------------------------

export function Title({ children }: { children: React.ReactNode }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  return (
    <Text style={{ color: p.text, fontSize: typeScale.title, fontFamily: ty.family.extrabold, lineHeight: ty.lh(typeScale.title), marginBottom: spacing.xs }}>
      {children}
    </Text>
  )
}

export function Subtitle({ children }: { children: React.ReactNode }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  return (
    <Text style={{ color: p.textMuted, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body), marginBottom: spacing.lg }}>
      {children}
    </Text>
  )
}

export function SectionHeader({ children }: { children: React.ReactNode }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  return (
    <Text style={{ color: p.textMuted, fontSize: 12.5, fontFamily: ty.family.bold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.sm }}>
      {children}
    </Text>
  )
}

export function Row({
  label,
  value,
  bold,
  icon
}: {
  label: string
  value: React.ReactNode
  bold?: boolean
  icon?: keyof typeof Ionicons.glyphMap
}): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm + 1 }}>
      {icon ? (
        <View style={{ width: 30, height: 30, borderRadius: radius.pill, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md - 2 }}>
          <Ionicons name={icon} size={15} color={p.primary} />
        </View>
      ) : null}
      {/* paddingRight guards against Android clipping the label's last glyph */}
      <Text style={{ color: p.textMuted, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body), flexShrink: 0, marginRight: spacing.md, paddingRight: 2 }}>
        {label}
      </Text>
      <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: bold ? ty.family.bold : ty.family.semibold, lineHeight: ty.lh(typeScale.body), flex: 1, flexShrink: 1, textAlign: 'right' }}>
        {value ?? '—'}
      </Text>
    </View>
  )
}

export function Money({ cents, color, size = 15, bold }: { cents: number; color?: string; size?: number; bold?: boolean }): React.ReactElement {
  const p = usePalette()
  // Amounts are Latin digits — always Inter, whatever the UI language
  return (
    <Text style={{ color: color ?? p.text, fontSize: size, fontFamily: bold ? interFamily.bold : interFamily.semibold, fontVariant: ['tabular-nums'] }}>
      {formatCurrency(cents)}
    </Text>
  )
}

// ---- Controls ------------------------------------------------------------

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  loading?: boolean
  icon?: keyof typeof Ionicons.glyphMap
}): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const fg = variant === 'secondary' ? p.primary : p.onPrimary
  return (
    <ScalePressable
      accessibilityRole="button"
      haptic="impact"
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        minHeight: 52,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.xl,
        marginTop: spacing.xs,
        overflow: 'hidden',
        backgroundColor: variant === 'secondary' ? p.primarySoft : variant === 'danger' ? p.danger : 'transparent',
        opacity: disabled || loading ? 0.55 : 1,
        ...(variant === 'primary' ? { shadowColor: p.gradEnd, ...elevation.sm } : null)
      }}
    >
      {variant === 'primary' ? <BrandGradient rounded={radius.md} /> : null}
      {/* Label keeps its width while loading so the button doesn't jump */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, opacity: loading ? 0 : 1 }}>
        {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
        <Text style={{ color: fg, fontSize: 16.5, fontFamily: ty.family.bold, lineHeight: ty.lh(16.5) }}>{label}</Text>
      </View>
      {loading ? (
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={fg} />
        </View>
      ) : null}
    </ScalePressable>
  )
}

// Generic pill segmented control (same look as LangToggle): iOS-style
// floating thumb — the selected option sits on an elevated surface chip
export function Segmented<T extends string>({
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
    <View style={{ flexDirection: 'row', gap: spacing.xs, backgroundColor: p.surfaceAlt, borderRadius: radius.md, padding: 3, alignSelf: 'flex-start' }}>
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <ScalePressable
            key={opt.value}
            haptic="selection"
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={selected ? { selected: true } : {}}
            scaleTo={0.95}
            style={{
              paddingHorizontal: spacing.lg - 2,
              paddingVertical: spacing.sm,
              borderRadius: radius.md - 4,
              backgroundColor: selected ? (scheme === 'dark' ? p.surfaceElevated : p.surface) : 'transparent',
              ...(selected && scheme !== 'dark' ? { shadowColor: p.shadow, ...cardShadowIos } : null)
            }}
          >
            <Text style={{ color: selected ? p.text : p.textMuted, fontFamily: ty.family.bold, fontSize: 14, lineHeight: ty.lh(14) }}>
              {opt.label}
            </Text>
          </ScalePressable>
        )
      })}
    </View>
  )
}

export function LangToggle(): React.ReactElement {
  const { lang, setLang } = useT()
  return (
    <Segmented
      options={[
        { value: 'en', label: 'EN' },
        { value: 'si', label: 'සිං' }
      ]}
      value={lang}
      onChange={(code) => setLang(code)}
    />
  )
}

export function Input(props: TextInputProps & { label: string; error?: string }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const { label, error, style, onFocus, onBlur, ...rest } = props
  const [focused, setFocused] = useState(false)
  const borderColor = error ? p.danger : focused ? p.primary : p.border
  return (
    <View style={{ marginBottom: spacing.lg - 2 }}>
      <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body), marginBottom: spacing.sm - 2 }}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={p.textMuted}
        {...rest}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); onBlur?.(e) }}
        style={[
          {
            backgroundColor: p.surface,
            borderColor,
            borderWidth: 1.5,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg - 2,
            paddingVertical: spacing.lg - 3,
            fontSize: 16.5,
            fontFamily: ty.family.regular,
            color: p.text,
            ...(focused ? { shadowColor: p.primary, ...elevation.sm } : null)
          },
          style
        ]}
      />
      {error ? (
        <Text style={{ color: p.danger, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption), marginTop: spacing.xs + 1 }}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

// ---- Loading / feedback ----------------------------------------------------

// Shimmering placeholder block for skeleton loading states
export function Skeleton({ height = 16, width = '100%' as number | `${number}%`, radius: r = 8, style }: {
  height?: number
  width?: number | `${number}%`
  radius?: number
  style?: StyleProp<ViewStyle>
}): React.ReactElement {
  const p = usePalette()
  const { scheme } = useThemeMode()
  const [w, setW] = useState(0)
  const sweep = useSharedValue(0)

  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1)
  }, [sweep])

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -90 + sweep.value * (w + 180) }]
  }))

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ height, width, borderRadius: r, backgroundColor: scheme === 'dark' ? p.surfaceAlt : p.border, overflow: 'hidden', marginBottom: spacing.sm }, style]}
    >
      {w > 0 ? (
        <Animated.View
          style={[
            { width: 90, height: '100%', backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)' },
            sweepStyle
          ]}
        />
      ) : null}
    </View>
  )
}

// Layout-shaped loading placeholder used by the list screens
export function SkeletonCards({ cards = 3 }: { cards?: number }): React.ReactElement {
  return (
    <>
      {Array.from({ length: cards }).map((_, i) => (
        <Card key={i}>
          <Skeleton width="45%" height={13} />
          <Skeleton width="70%" height={19} />
          <Skeleton width="30%" height={13} style={{ marginBottom: 0 }} />
        </Card>
      ))}
    </>
  )
}

// Thin repayment-progress bar (0..1) — fill animates to its value
export function ProgressBar({ value, color }: { value: number; color?: string }): React.ReactElement {
  const p = usePalette()
  const clamped = Math.max(0, Math.min(1, value))
  const fill = useSharedValue(0)

  useEffect(() => {
    fill.value = withTiming(clamped, { duration: 650, easing: Easing.out(Easing.cubic) })
  }, [clamped, fill])

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: fill.value }]
  }))

  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: p.surfaceAlt, overflow: 'hidden', marginTop: spacing.sm }}>
      <Animated.View
        style={[
          { height: 8, width: '100%', borderRadius: 4, backgroundColor: color ?? p.success, transformOrigin: 'left' },
          fillStyle
        ]}
      />
    </View>
  )
}

// Friendly icon + message for empty lists
export function EmptyState({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: 'center', paddingVertical: spacing.xxxl + 4, gap: spacing.lg - 2 }}>
      <View style={{ width: 72, height: 72, borderRadius: radius.pill, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={30} color={p.primary} />
      </View>
      <Text style={{ color: p.textMuted, fontSize: typeScale.body, fontFamily: ty.family.regular, textAlign: 'center', paddingHorizontal: spacing.xxl, lineHeight: ty.lh(typeScale.body) }}>
        {text}
      </Text>
    </Animated.View>
  )
}

// Shown when a refetch failed but cached data is still on screen
export function StaleBanner(): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const { t } = useT()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: p.warningBg, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 1, marginBottom: spacing.md }}>
      <Ionicons name="cloud-offline-outline" size={16} color={p.warning} />
      <Text style={{ color: p.warning, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption), flex: 1 }}>
        {t('mob.staleData')}
      </Text>
    </View>
  )
}

const BANNER_ICONS = {
  danger: 'alert-circle',
  warning: 'warning',
  success: 'checkmark-circle'
} as const

export function Banner({ kind, text }: { kind: 'danger' | 'warning' | 'success'; text: string }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const bg = kind === 'danger' ? p.dangerBg : kind === 'warning' ? p.warningBg : p.successBg
  const fg = kind === 'danger' ? p.danger : kind === 'warning' ? p.warning : p.success
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md - 2, backgroundColor: bg, borderRadius: radius.md, padding: spacing.lg - 2, marginBottom: spacing.md }}>
      <Ionicons name={BANNER_ICONS[kind]} size={20} color={fg} />
      <Text style={{ color: fg, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body), flex: 1 }}>{text}</Text>
    </View>
  )
}

export function Badge({ text, color, bg }: { text: string; color: string; bg: string }): React.ReactElement {
  const ty = useType()
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color, fontSize: typeScale.micro, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.micro) }}>{text}</Text>
    </View>
  )
}

// Status → colored badge, using the same status vocabulary as the desktop.
// Pill with a leading dot so state reads even without color vision.
export function StatusBadge({ status }: { status: string }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const map: Record<string, { color: string; bg: string }> = {
    Active: { color: p.success, bg: p.successBg },
    Overdue: { color: p.danger, bg: p.dangerBg },
    Paid: { color: p.textMuted, bg: p.surfaceAlt },
    Void: { color: p.warning, bg: p.warningBg }
  }
  const c = map[status] ?? { color: p.textMuted, bg: p.surfaceAlt }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.bg, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.color }} />
      <Text style={{ color: c.color, fontSize: typeScale.micro, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.micro) }}>{status}</Text>
    </View>
  )
}

export function EmptyText({ children }: { children: React.ReactNode }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  return (
    <Text style={{ color: p.textMuted, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body), textAlign: 'center', paddingVertical: spacing.xxl }}>
      {children}
    </Text>
  )
}

export function LoadingView(): React.ReactElement {
  const p = usePalette()
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, backgroundColor: p.bg }}>
      <ActivityIndicator size="large" color={p.primary} />
    </View>
  )
}

export function ErrorView({ onRetry }: { onRetry: () => void }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const { t } = useT()
  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg }}>
      <View style={{ width: 72, height: 72, borderRadius: radius.pill, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg - 2 }}>
        <Ionicons name="cloud-offline-outline" size={30} color={p.primary} />
      </View>
      <Text style={{ color: p.textMuted, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body), textAlign: 'center', marginBottom: spacing.lg }}>
        {t('mob.errorLoad')}
      </Text>
      <Button label={t('mob.retry')} onPress={onRetry} variant="secondary" />
    </Animated.View>
  )
}
