import React, { useEffect, useState } from 'react'
import { Modal, Text, useWindowDimensions, View } from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import Ionicons from '@expo/vector-icons/Ionicons'
import { radius, spacing } from '../theme'
import { interFamily } from '../typography'
import { ScalePressable } from './pressable'

// Full-screen photo viewer: pinch to zoom, drag to pan, double-tap to
// toggle zoom. One photo at a time with chevron navigation — deliberately
// no swipe-pager, so pan and page gestures can never fight each other.

function ZoomablePhoto({ uri }: { uri: string }): React.ReactElement {
  const { width, height } = useWindowDimensions()
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const savedTx = useSharedValue(0)
  const savedTy = useSharedValue(0)

  const reset = (): void => {
    'worklet'
    scale.value = withTiming(1, { duration: 180 })
    savedScale.value = 1
    tx.value = withTiming(0, { duration: 180 })
    ty.value = withTiming(0, { duration: 180 })
    savedTx.value = 0
    savedTy.value = 0
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(4, Math.max(1, savedScale.value * e.scale))
    })
    .onEnd(() => {
      if (scale.value <= 1.05) reset()
      else savedScale.value = scale.value
    })

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value <= 1) return
      // Keep the photo roughly on screen while panning
      const maxX = (width * (scale.value - 1)) / 2
      const maxY = (height * (scale.value - 1)) / 2
      tx.value = Math.min(maxX, Math.max(-maxX, savedTx.value + e.translationX))
      ty.value = Math.min(maxY, Math.max(-maxY, savedTy.value + e.translationY))
    })
    .onEnd(() => {
      savedTx.value = tx.value
      savedTy.value = ty.value
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        reset()
      } else {
        scale.value = withTiming(2.2, { duration: 180 })
        savedScale.value = 2.2
      }
    })

  const composed = Gesture.Exclusive(Gesture.Simultaneous(pinch, pan), doubleTap)

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }]
  }))

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}>
        <Image source={{ uri }} style={{ width, height }} contentFit="contain" transition={150} />
      </Animated.View>
    </GestureDetector>
  )
}

export function PhotoViewer({
  photos,
  initialIndex,
  visible,
  onClose
}: {
  photos: string[]
  initialIndex: number
  visible: boolean
  onClose: () => void
}): React.ReactElement {
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(initialIndex)

  useEffect(() => {
    if (visible) setIndex(initialIndex)
  }, [visible, initialIndex])

  const current = photos[Math.min(index, photos.length - 1)]

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center' }}>
        {/* keyed so zoom state resets per photo */}
        {current ? <ZoomablePhoto key={current} uri={current} /> : null}

        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          haptic="selection"
          onPress={onClose}
          style={{
            position: 'absolute',
            top: insets.top + spacing.md,
            right: spacing.lg,
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            backgroundColor: 'rgba(255,255,255,0.14)',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Ionicons name="close" size={24} color="#ffffff" />
        </ScalePressable>

        {photos.length > 1 && (
          <>
            <Text
              style={{
                position: 'absolute',
                top: insets.top + spacing.md + 9,
                alignSelf: 'center',
                color: 'rgba(255,255,255,0.85)',
                fontFamily: interFamily.semibold,
                fontSize: 14
              }}
            >
              {index + 1} / {photos.length}
            </Text>
            {index > 0 && (
              <ScalePressable
                accessibilityRole="button"
                haptic="selection"
                onPress={() => setIndex((i) => Math.max(0, i - 1))}
                style={{ position: 'absolute', left: spacing.md, top: '50%', marginTop: -22, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="chevron-back" size={26} color="#ffffff" />
              </ScalePressable>
            )}
            {index < photos.length - 1 && (
              <ScalePressable
                accessibilityRole="button"
                haptic="selection"
                onPress={() => setIndex((i) => Math.min(photos.length - 1, i + 1))}
                style={{ position: 'absolute', right: spacing.md, top: '50%', marginTop: -22, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="chevron-forward" size={26} color="#ffffff" />
              </ScalePressable>
            )}
          </>
        )}
      </View>
    </Modal>
  )
}
