import React from 'react'
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable)

export type HapticKind = 'impact' | 'selection' | 'none'

// The app-wide press affordance: a soft spring scale-down (0.97) instead of
// bare opacity. Everything tappable — buttons, cards, list rows, tab items —
// funnels through this so touch feedback feels like one system.
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
        pressed.value = withSpring(1, { damping: 20, stiffness: 400 })
        rest.onPressIn?.(e)
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, { damping: 20, stiffness: 400 })
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
