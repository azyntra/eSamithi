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
  FadeIn,
  makeMutable,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated'
import { dur, ease, timing } from '../motion'
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg'
import Ionicons from '@expo/vector-icons/Ionicons'
import { elevation, radius, spacing, type as typeScale, usePalette, useThemeMode } from '../theme'
import { interFamily, useType } from '../typography'
import { useT } from '../i18n'
import type { TranslationKey } from '../i18n/en'
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
      {/* pointerEvents on the Svg itself: on Android react-native-svg captures
          touches even when the wrapping View is pointerEvents="none", which
          made gradient buttons only tappable on the label text. */}
      <Svg width="100%" height="100%" pointerEvents="none">
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
  // Every screen renders a skeleton Screen and then swaps it for a content
  // Screen, so the two unmount and mount: a hard cut. One short fade here
  // turns that seam into a crossfade on all eighteen screens at once, which
  // is what the Home screen's seven-section cascade was really trying to do.
  return (
    <Animated.ScrollView
      entering={FadeIn.duration(dur.content)}
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: padded ? spacing.lg : 0, paddingBottom: insets.bottom + spacing.xxxl }}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={p.primary} colors={[p.primary]} /> : undefined
      }
    >
      {children}
    </Animated.ScrollView>
  )
}

// The same chrome as Screen, but virtualised. There was no FlatList anywhere
// in this app: a member's entire payment history, the whole notice archive and
// every loaded marketplace page all rendered into one ScrollView. After a few
// years of monthly dues that is the first thing to jank on a cheap Android.
export function ListScreen<T>({
  data,
  renderItem,
  keyExtractor,
  header,
  empty,
  refreshing,
  onRefresh,
  onEndReached
}: {
  data: readonly T[]
  renderItem: (item: T, index: number) => React.ReactElement
  keyExtractor: (item: T, index: number) => string
  header?: React.ReactElement
  empty?: React.ReactElement
  refreshing?: boolean
  onRefresh?: () => void
  onEndReached?: () => void
}): React.ReactElement {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  return (
    <Animated.FlatList
      entering={FadeIn.duration(dur.content)}
      data={data as T[]}
      renderItem={({ item, index }) => renderItem(item, index)}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxxl }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      removeClippedSubviews
      initialNumToRender={10}
      windowSize={7}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={p.primary} colors={[p.primary]} /> : undefined
      }
    />
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
    <Text style={{ color: p.textMuted, fontSize: 12, fontFamily: ty.family.bold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.sm, lineHeight: ty.lh(12) }}>
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
          <Ionicons name={icon} size={15} color={p.primaryOnSoft} />
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
  const fg = variant === 'secondary' ? p.primaryOnSoft : p.onPrimary
  const isPrimary = variant === 'primary'
  // The gradient is a sibling BEHIND the Pressable, not a child on top of it.
  // On Fabric/Android an SVG child intercepts touches over its whole area
  // (pointerEvents doesn't reliably stop it), which left gradient buttons
  // tappable only on the label. With the Pressable as the topmost full-size
  // layer, every tap lands on it regardless of SVG touch behaviour.
  return (
    <View
      style={{
        borderRadius: radius.md,
        marginTop: spacing.xs,
        overflow: 'hidden',
        opacity: disabled || loading ? 0.55 : 1,
        ...(isPrimary ? { shadowColor: p.gradEnd, ...elevation.sm } : null)
      }}
    >
      {isPrimary ? <BrandGradient rounded={radius.md} /> : null}
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
          backgroundColor: variant === 'secondary' ? p.primarySoft : variant === 'danger' ? p.danger : 'transparent'
        }}
      >
        {/* Label keeps its width while loading so the button doesn't jump */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, opacity: loading ? 0 : 1 }}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={{ color: fg, fontSize: 16, fontFamily: ty.family.bold, lineHeight: ty.lh(16) }}>{label}</Text>
        </View>
        {loading ? (
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={fg} />
          </View>
        ) : null}
      </ScalePressable>
    </View>
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
              // 48 dp minimum: this control is both the language switcher and
              // the theme switcher, and it used to be about 34 dp tall.
              minHeight: 48,
              justifyContent: 'center',
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
            fontSize: 16,
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
// One phase drives every skeleton on screen. The Puruka loading state shows
// twelve of these; twelve independent loops used to run out of step, and the
// old sweep used Easing.inOut with no `reverse`, so a white bar decelerated to
// a near-stop at each edge and then snapped back — it read as a twitch, not a
// shimmer. This is a single shared breath, in phase everywhere.
const skeletonPhase = makeMutable(0)
let skeletonRunning = false

function useSkeletonPhase(): typeof skeletonPhase {
  // Started from an effect, not at module scope: an import-time withRepeat
  // runs before Reanimated's UI runtime is ready. The flag keeps it to one
  // animation no matter how many skeletons mount.
  useEffect(() => {
    if (skeletonRunning) return
    skeletonRunning = true
    skeletonPhase.value = withRepeat(withTiming(1, timing(900, ease.pulse)), -1, true)
  }, [])
  return skeletonPhase
}

export function Skeleton({ height = 16, width = '100%' as number | `${number}%`, radius: r = 8, style }: {
  height?: number
  width?: number | `${number}%`
  radius?: number
  style?: StyleProp<ViewStyle>
}): React.ReactElement {
  const p = usePalette()
  const { scheme } = useThemeMode()
  const phase = useSkeletonPhase()

  const breath = useAnimatedStyle(() => ({ opacity: 0.55 + phase.value * 0.45 }))

  return (
    <Animated.View
      style={[
        { height, width, borderRadius: r, backgroundColor: scheme === 'dark' ? p.surfaceAlt : p.border, marginBottom: spacing.sm },
        breath,
        style
      ]}
    />
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
    fill.value = withTiming(clamped, timing(dur.page, ease.enter))
  }, [clamped, fill])

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: fill.value }]
  }))

  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: p.surfaceAlt, overflow: 'hidden', marginTop: spacing.sm }}>
      <Animated.View
        style={[
          { height: 8, width: '100%', backgroundColor: color ?? p.success, transformOrigin: 'left' },
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
    <Animated.View entering={FadeIn.duration(dur.enter)} style={{ alignItems: 'center', paddingVertical: spacing.xxxl + 4, gap: spacing.lg - 2 }}>
      <View style={{ width: 72, height: 72, borderRadius: radius.pill, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={30} color={p.primaryOnSoft} />
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

// One status vocabulary for the whole app. There were four parallel colour
// maps — this component plus local ones in requests, my-posts and post detail
// — and this one printed the RAW ENGLISH status, so a Sinhala-reading member
// saw "Active" and "Overdue" in Latin script on their own loan.
// The leading dot means state still reads without colour vision.
type StatusTone = 'success' | 'warning' | 'danger' | 'neutral'

const STATUS: Record<string, { key: TranslationKey; tone: StatusTone }> = {
  // loans and ledger
  Active: { key: 'rcpt.stActive', tone: 'success' },
  Overdue: { key: 'rcpt.stOverdue', tone: 'danger' },
  Paid: { key: 'rcpt.stPaid', tone: 'neutral' },
  Void: { key: 'rcpt.stVoid', tone: 'warning' },
  Defaulted: { key: 'rcpt.stDefaulted', tone: 'danger' },
  // member requests
  Pending: { key: 'mob.stPending', tone: 'warning' },
  Approved: { key: 'mob.stApproved', tone: 'success' },
  Rejected: { key: 'mob.stRejected', tone: 'danger' },
  Done: { key: 'mob.stDone', tone: 'neutral' },
  // marketplace listings
  Sold: { key: 'mob.pkSold', tone: 'neutral' },
  Inactive: { key: 'mob.pkInactive', tone: 'warning' },
  Removed: { key: 'mob.pkRemoved', tone: 'danger' },
  Deleted: { key: 'mob.pkRemoved', tone: 'danger' }
}

export function StatusPill({ status }: { status: string }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const { t } = useT()
  const entry = STATUS[status]
  const tones: Record<StatusTone, { color: string; bg: string }> = {
    success: { color: p.success, bg: p.successBg },
    warning: { color: p.warning, bg: p.warningBg },
    danger: { color: p.danger, bg: p.dangerBg },
    neutral: { color: p.textMuted, bg: p.surfaceAlt }
  }
  const c = tones[entry?.tone ?? 'neutral']
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.bg, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.color }} />
      <Text style={{ color: c.color, fontSize: typeScale.micro, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.micro) }}>
        {entry ? t(entry.key) : status}
      </Text>
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
    <Animated.View entering={FadeIn.duration(dur.enter)} style={{ alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg }}>
      <View style={{ width: 72, height: 72, borderRadius: radius.pill, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg - 2 }}>
        <Ionicons name="cloud-offline-outline" size={30} color={p.primaryOnSoft} />
      </View>
      <Text style={{ color: p.textMuted, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body), textAlign: 'center', marginBottom: spacing.lg }}>
        {t('mob.errorLoad')}
      </Text>
      <Button label={t('mob.retry')} onPress={onRetry} variant="secondary" />
    </Animated.View>
  )
}

// The most duplicated pattern in the app: an icon, a label, a value and a
// chevron inside a card. It existed eight times at six different vertical
// paddings (10/12/13/14/18), so scrolling from Contributions to Payouts to
// Benefits to Help changed the list density each time. One row, 56 dp minimum
// — which is also the accessible touch target this app never had.
export function ListRow({
  icon,
  iconTone,
  label,
  sublabel,
  value,
  right,
  onPress,
  first
}: {
  icon?: keyof typeof Ionicons.glyphMap
  iconTone?: 'brand' | 'success' | 'warning' | 'danger'
  label: string
  sublabel?: string
  value?: string
  right?: React.ReactNode
  onPress?: () => void
  first?: boolean
}): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const tones = {
    brand: { fg: p.primaryOnSoft, bg: p.primarySoft },
    success: { fg: p.success, bg: p.successBg },
    warning: { fg: p.warning, bg: p.warningBg },
    danger: { fg: p.danger, bg: p.dangerBg }
  }
  const tone = tones[iconTone ?? 'brand']

  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        paddingVertical: spacing.sm,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: p.border
      }}
    >
      {icon ? (
        <View style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
          <Ionicons name={icon} size={19} color={tone.fg} />
        </View>
      ) : null}
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body) }}>{label}</Text>
        {sublabel ? (
          <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption), marginTop: 1 }}>{sublabel}</Text>
        ) : null}
      </View>
      {value ? (
        <Text style={{ color: p.textMuted, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body) }}>{value}</Text>
      ) : null}
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={p.textMuted} style={{ marginLeft: spacing.xs }} /> : null}
    </View>
  )

  if (!onPress) return body
  return (
    <ScalePressable accessibilityRole="button" onPress={onPress} scaleTo={0.99}>
      {body}
    </ScalePressable>
  )
}

// Filter and category chips. There were three implementations, two of them
// byte-identical copies and a third at a different radius and weight.
// 44 dp minimum so a thumb can actually hit it.
export function Chip({
  label,
  icon,
  selected,
  onPress
}: {
  label: string
  icon?: keyof typeof Ionicons.glyphMap
  selected: boolean
  onPress: () => void
}): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      haptic="selection"
      onPress={onPress}
      scaleTo={0.96}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs + 2,
        minHeight: 44,
        paddingHorizontal: spacing.lg - 2,
        borderRadius: radius.pill,
        backgroundColor: selected ? p.primary : p.primarySoft
      }}
    >
      {icon ? <Ionicons name={icon} size={16} color={selected ? p.onPrimary : p.primaryOnSoft} /> : null}
      <Text style={{ color: selected ? p.onPrimary : p.primaryOnSoft, fontSize: typeScale.caption, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.caption) }}>
        {label}
      </Text>
    </ScalePressable>
  )
}

// "A big number in a box" existed three times, one of which hand-built its own
// "Rs. …" string and so skipped the two-decimal rule the rest of the app keeps.
export function AmountCard({
  label,
  cents,
  tone,
  icon,
  hint,
  onPress
}: {
  label: string
  cents: number
  tone?: 'success' | 'warning' | 'danger'
  icon?: keyof typeof Ionicons.glyphMap
  hint?: string
  onPress?: () => void
}): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const colors = { success: p.success, warning: p.warning, danger: p.danger }
  const fg = tone ? colors[tone] : p.text
  const bg = tone ? { success: p.successBg, warning: p.warningBg, danger: p.dangerBg }[tone] : p.primarySoft
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {icon ? (
          <View style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
            <Ionicons name={icon} size={19} color={tone ? fg : p.primaryOnSoft} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption) }}>{label}</Text>
          <Money cents={cents} size={typeScale.display} bold color={fg} />
          {hint ? (
            <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption), marginTop: 2 }}>{hint}</Text>
          ) : null}
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={18} color={p.textMuted} /> : null}
      </View>
    </Card>
  )
}
