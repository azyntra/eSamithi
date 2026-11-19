import React, { useEffect, useRef } from 'react'
import { Modal, PanResponder, Platform, Pressable, StatusBar, Text, useWindowDimensions, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '../i18n'
import { interFamily, useType } from '../typography'

// Full-screen QR for scanning at arm's length (requirements FR-5.2–5.6):
// the code, the society ID and the name — nothing else. Always black on pure
// white whatever the theme, because a dark-mode QR is the one most phone
// scanners struggle with. Closes on a tap, the back button or a swipe down.
//
// Screen brightness goes to full while it is open and back afterwards
// (FR-5.7). The brightness module is required lazily inside a try, so this
// file also runs on an older binary that does not contain it.
export function LargeQr({
  visible,
  onClose,
  value,
  societyId,
  name
}: {
  visible: boolean
  onClose: () => void
  value: string
  societyId: string
  name: string
}): React.ReactElement {
  const { t } = useT()
  const ty = useType()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  // ~80% of the narrow side, leaving room below for the ID and name
  const size = Math.round(Math.min(width * 0.82, height * 0.55))

  useEffect(() => {
    if (!visible) return
    let restore: (() => void) | null = null
    let cancelled = false
    ;(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Brightness = require('expo-brightness') as typeof import('expo-brightness')
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const KeepAwake = require('expo-keep-awake') as typeof import('expo-keep-awake')
        const before = await Brightness.getBrightnessAsync()
        if (cancelled) return
        await Brightness.setBrightnessAsync(1)
        await KeepAwake.activateKeepAwakeAsync('large-qr')
        restore = () => {
          void KeepAwake.deactivateKeepAwake('large-qr')
          // Android can hand the window back to the system level; iOS keeps
          // what we set until the phone locks, so put the old value back
          if (Platform.OS === 'android') void Brightness.restoreSystemBrightnessAsync().catch(() => {})
          else void Brightness.setBrightnessAsync(before).catch(() => {})
        }
      } catch {
        // Module missing or refused: the code still shows, just not brighter
      }
    })()
    return () => {
      cancelled = true
      restore?.()
    }
  }, [visible])

  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 80 || g.vy > 0.8) onClose()
      }
    })
  ).current

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="fade" statusBarTranslucent presentationStyle="fullScreen">
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('mob.cardLargeHint')}
        style={{ flex: 1, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}
        {...swipe.panHandlers}
      >
        <View accessible accessibilityLabel={t('mob.cardLargeLabel')} style={{ padding: 4, backgroundColor: '#ffffff' }}>
          <QRCode value={value} size={size} backgroundColor="#ffffff" color="#000000" quietZone={Math.round(size * 0.06)} ecl="M" />
        </View>
        <Text
          style={{ marginTop: 28, color: '#000000', fontSize: 28, fontFamily: interFamily.extrabold, fontVariant: ['tabular-nums'], letterSpacing: 0.5, textAlign: 'center', paddingHorizontal: 24 }}
          selectable={false}
        >
          {societyId}
        </Text>
        <Text
          style={{ marginTop: 8, color: '#111111', fontSize: 22, fontFamily: ty.family.bold, lineHeight: ty.lh(22), textAlign: 'center', paddingHorizontal: 24 }}
        >
          {name}
        </Text>
        <Text style={{ position: 'absolute', bottom: insets.bottom + 18, color: '#666666', fontSize: 14, fontFamily: ty.family.regular, lineHeight: ty.lh(14) }}>
          {t('mob.cardLargeHint')}
        </Text>
      </Pressable>
    </Modal>
  )
}
