import React from 'react'
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { dur, ease, timing } from '../motion'

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable)

export type HapticKind = 'impact' | 'selection' | 'none'

// The app-wide press affordance: a short scale-down instead of bare opacity.
// Everything tappable — buttons, cards, list rows, tab items — funnels through
// this so touch feedback feels like one system.
//
// This used to be a spring, and because it passed a partial config it ran at a
// damping ratio of 0.25: it sprang 1.3% LARGER than rest on release and wobbled
// for 1.4 seconds, on every tap in the app. A timing curve cannot overshoot, is
// cheaper, and is interruption-safe. Asymmetric on purpose — the finger drives
// the press down, the release settles.
export function ScalePressable({
  children,
  style,
  onPress,
  disabled,
  haptic = 'none',
  scaleTo = 0.97,
  ...rest
}: PressableProps & {
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
  haptic?: HapticKind
  scaleTo?: number
}): React.ReactElement {
  const pressed = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pressed.value * (scaleTo - 1) }]
  }))

  return (
    <AnimatedPressableBase
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        pressed.value = withTiming(1, timing(dur.pressIn, ease.press))
        rest.onPressIn?.(e)
      }}
      onPressOut={(e) => {
        pressed.value = withTiming(0, timing(dur.pressOut))
        rest.onPressOut?.(e)
      }}
      onPress={(e) => {
        if (haptic === 'impact') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        else if (haptic === 'selection') Haptics.selectionAsync().catch(() => {})
        onPress?.(e)
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressableBase>
  )
}
