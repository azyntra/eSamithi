import React, { useEffect, useRef } from 'react'
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import Ionicons from '@expo/vector-icons/Ionicons'
import { usePalette } from '../theme'
import { useT } from '../i18n'
import { formatCurrency } from '../lib/money'

// Small shared UI kit — large touch targets and font scaling stay enabled
// throughout (many members are elderly; see NFRs in the requirements doc).

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
      contentContainerStyle={{ padding: padded ? 16 : 0, paddingBottom: insets.bottom + 32 }}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={p.primary} /> : undefined
      }
    >
      {children}
    </ScrollView>
  )
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }): React.ReactElement {
  const p = usePalette()
  return (
    <View style={[{ backgroundColor: p.surface, borderColor: p.border, borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 }, style]}>
      {children}
    </View>
  )
}

export function Title({ children }: { children: React.ReactNode }): React.ReactElement {
  const p = usePalette()
  return <Text style={{ color: p.text, fontSize: 22, fontWeight: '700', marginBottom: 4 }}>{children}</Text>
}

export function Subtitle({ children }: { children: React.ReactNode }): React.ReactElement {
  const p = usePalette()
  return <Text style={{ color: p.textMuted, fontSize: 15, lineHeight: 21, marginBottom: 16 }}>{children}</Text>
}

export function SectionHeader({ children }: { children: React.ReactNode }): React.ReactElement {
  const p = usePalette()
  return <Text style={{ color: p.textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 8 }}>{children}</Text>
}

export function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }): React.ReactElement {
  const p = usePalette()
  return (
    <View style={styles.row}>
      {/* paddingRight guards against Android clipping the label's last glyph */}
      <Text style={{ color: p.textMuted, fontSize: 15, flexShrink: 0, marginRight: 12, paddingRight: 2 }}>{label}</Text>
      <Text style={{ color: p.text, fontSize: 15, fontWeight: bold ? '700' : '500', flex: 1, flexShrink: 1, textAlign: 'right' }}>
        {value ?? '—'}
      </Text>
    </View>
  )
}

export function Money({ cents, color, size = 15, bold }: { cents: number; color?: string; size?: number; bold?: boolean }): React.ReactElement {
  const p = usePalette()
  return <Text style={{ color: color ?? p.text, fontSize: size, fontWeight: bold ? '700' : '600', fontVariant: ['tabular-nums'] }}>{formatCurrency(cents)}</Text>
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  loading?: boolean
}): React.ReactElement {
  const p = usePalette()
  const bg = variant === 'primary' ? p.primary : variant === 'danger' ? p.danger : 'transparent'
  const fg = variant === 'secondary' ? p.primary : p.onPrimary
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        onPress()
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === 'secondary' ? p.primary : bg, opacity: disabled || loading ? 0.55 : pressed ? 0.85 : 1 }
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: 17, fontWeight: '700' }}>{label}</Text>}
    </Pressable>
  )
}

// Generic pill segmented control (same look as LangToggle)
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
  return (
    <View style={{ flexDirection: 'row', gap: 4, backgroundColor: p.surfaceAlt, borderRadius: 10, padding: 3, alignSelf: 'flex-start' }}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {})
            onChange(opt.value)
          }}
          accessibilityRole="button"
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: value === opt.value ? p.primary : 'transparent'
          }}
        >
          <Text style={{ color: value === opt.value ? p.onPrimary : p.textMuted, fontWeight: '700', fontSize: 14 }}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

// Pulsing placeholder block for skeleton loading states
export function Skeleton({ height = 16, width = '100%' as number | `${number}%`, radius = 8, style }: {
  height?: number
  width?: number | `${number}%`
  radius?: number
  style?: StyleProp<ViewStyle>
}): React.ReactElement {
  const p = usePalette()
  const pulse = useRef(new Animated.Value(0.4)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true })
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])
  return (
    <Animated.View
      style={[{ height, width, borderRadius: radius, backgroundColor: p.border, opacity: pulse, marginBottom: 8 }, style]}
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

// Thin repayment-progress bar (0..1)
export function ProgressBar({ value, color }: { value: number; color?: string }): React.ReactElement {
  const p = usePalette()
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: p.surfaceAlt, overflow: 'hidden', marginTop: 8 }}>
      <View style={{ height: 8, width: `${clamped * 100}%`, borderRadius: 4, backgroundColor: color ?? p.success }} />
    </View>
  )
}

// Friendly icon + message for empty lists
export function EmptyState({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }): React.ReactElement {
  const p = usePalette()
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, gap: 10 }}>
      <Ionicons name={icon} size={44} color={p.border} />
      <Text style={{ color: p.textMuted, fontSize: 15, textAlign: 'center', paddingHorizontal: 24, lineHeight: 21 }}>{text}</Text>
    </View>
  )
}

// Shown when a refetch failed but cached data is still on screen
export function StaleBanner(): React.ReactElement {
  const p = usePalette()
  const { t } = useT()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.warningBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12 }}>
      <Ionicons name="cloud-offline-outline" size={16} color={p.warning} />
      <Text style={{ color: p.warning, fontSize: 13, fontWeight: '600', flex: 1 }}>{t('mob.staleData')}</Text>
    </View>
  )
}

export function Input(props: TextInputProps & { label: string }): React.ReactElement {
  const p = usePalette()
  const { label, style, ...rest } = props
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: p.text, fontSize: 15, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <TextInput
        placeholderTextColor={p.textMuted}
        {...rest}
        style={[
          {
            backgroundColor: p.surface,
            borderColor: p.border,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 14,
            fontSize: 17,
            color: p.text
          },
          style
        ]}
      />
    </View>
  )
}

export function Banner({ kind, text }: { kind: 'danger' | 'warning' | 'success'; text: string }): React.ReactElement {
  const p = usePalette()
  const bg = kind === 'danger' ? p.dangerBg : kind === 'warning' ? p.warningBg : p.successBg
  const fg = kind === 'danger' ? p.danger : kind === 'warning' ? p.warning : p.success
  return (
    <View style={{ backgroundColor: bg, borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <Text style={{ color: fg, fontSize: 15, fontWeight: '600', lineHeight: 21 }}>{text}</Text>
    </View>
  )
}

export function Badge({ text, color, bg }: { text: string; color: string; bg: string }): React.ReactElement {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  )
}

export function EmptyText({ children }: { children: React.ReactNode }): React.ReactElement {
  const p = usePalette()
  return <Text style={{ color: p.textMuted, fontSize: 15, textAlign: 'center', paddingVertical: 24 }}>{children}</Text>
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
  const { t } = useT()
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 }}>
      <Text style={{ color: p.textMuted, fontSize: 15, textAlign: 'center', marginBottom: 16 }}>{t('mob.errorLoad')}</Text>
      <Button label={t('mob.retry')} onPress={onRetry} variant="secondary" />
    </View>
  )
}

// Status → colored badge, using the same status vocabulary as the desktop
export function StatusBadge({ status }: { status: string }): React.ReactElement {
  const p = usePalette()
  const map: Record<string, { color: string; bg: string }> = {
    Active: { color: p.success, bg: p.successBg },
    Overdue: { color: p.danger, bg: p.dangerBg },
    Paid: { color: p.textMuted, bg: p.surfaceAlt },
    Void: { color: p.warning, bg: p.warningBg }
  }
  const c = map[status] ?? { color: p.textMuted, bg: p.surfaceAlt }
  return <Badge text={status} color={c.color} bg={c.bg} />
}

export function LangToggle(): React.ReactElement {
  const { lang, setLang } = useT()
  const p = usePalette()
  const btn = (code: 'en' | 'si', label: string): React.ReactElement => (
    <Pressable
      key={code}
      onPress={() => setLang(code)}
      accessibilityRole="button"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: lang === code ? p.primary : 'transparent'
      }}
    >
      <Text style={{ color: lang === code ? p.onPrimary : p.textMuted, fontWeight: '700', fontSize: 15 }}>{label}</Text>
    </Pressable>
  )
  return (
    <View style={{ flexDirection: 'row', gap: 4, backgroundColor: p.surfaceAlt, borderRadius: 10, padding: 3, alignSelf: 'flex-start' }}>
      {btn('en', 'EN')}
      {btn('si', 'සිං')}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9
  },
  button: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 4
  }
})
