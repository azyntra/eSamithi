import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import Ionicons from '@expo/vector-icons/Ionicons'
import { elevation, radius, spacing, usePalette } from '../theme'
import { useType } from '../typography'

// Bottom snackbar for outcome feedback (request sent, listing saved, copy
// failed…). Destructive CONFIRMS stay Alert.alert — this is one-way news.
// Fires the matching notification haptic so success/error is felt, not
// just seen (many members glance away after tapping).

export type ToastKind = 'success' | 'error' | 'info'

interface ToastContextValue {
  show: (kind: ToastKind, message: string) => void
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} })

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}

const ICONS: Record<ToastKind, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle'
}

interface ToastState {
  id: number
  kind: ToastKind
  message: string
}

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((kind: ToastKind, message: string): void => {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    else if (kind === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
    setToast({ id: Date.now(), kind, message })
  }, [])

  useEffect(() => {
    if (!toast) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 3000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [toast])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastCard key={toast.id} toast={toast} /> : null}
    </ToastContext.Provider>
  )
}

function ToastCard({ toast }: { toast: ToastState }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const insets = useSafeAreaInsets()
  const fg = toast.kind === 'success' ? p.success : toast.kind === 'error' ? p.danger : p.primary

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18)}
      exiting={SlideOutDown.duration(180)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        // Clears the tab bar when present; harmless offset elsewhere
        bottom: insets.bottom + 76,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm + 2,
        backgroundColor: p.surfaceElevated,
        borderRadius: radius.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md + 2,
        shadowColor: p.shadow,
        ...elevation.lg
      }}
    >
      <Ionicons name={ICONS[toast.kind]} size={22} color={fg} />
      <Text style={{ color: p.text, fontFamily: ty.family.semibold, fontSize: 14, lineHeight: ty.lh(14), flex: 1 }}>
        {toast.message}
      </Text>
    </Animated.View>
  )
}
