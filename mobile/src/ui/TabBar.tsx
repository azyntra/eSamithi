import React from 'react'
import { Text, View } from 'react-native'
// expo-router (SDK 57) vendors react-navigation — the public package isn't
// installed, so the tab-bar props type comes from the vendored build.
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types'
import Animated, { ZoomIn } from 'react-native-reanimated'
import Ionicons from '@expo/vector-icons/Ionicons'
import { elevation, radius, spacing, usePalette } from '../theme'
import { useType } from '../typography'
import { ScalePressable } from './pressable'

// Custom bottom bar (Material-3 style): every tab keeps its label — many
// members are elderly and icon-only navigation loses them — while the active
// tab gets a soft pill behind a filled icon. Selection haptic on switch.

const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; idle: keyof typeof Ionicons.glyphMap }> = {
  index: { active: 'home', idle: 'home-outline' },
  puruka: { active: 'storefront', idle: 'storefront-outline' },
  contributions: { active: 'cash', idle: 'cash-outline' },
  loans: { active: 'business', idle: 'business-outline' },
  notices: { active: 'notifications', idle: 'notifications-outline' },
  more: { active: 'grid', idle: 'grid-outline' }
}

export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps): React.ReactElement {
  const p = usePalette()
  const ty = useType()

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: p.surface,
        paddingBottom: Math.max(insets.bottom, spacing.sm),
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.xs,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        shadowColor: p.shadow,
        ...elevation.md
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]
        const label = options.title ?? route.name
        const focused = state.index === index
        const icons = ICONS[route.name] ?? { active: 'ellipse', idle: 'ellipse-outline' }

        const onPress = (): void => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name)
        }

        return (
          <ScalePressable
            key={route.key}
            haptic="selection"
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            scaleTo={0.94}
            style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 }}
          >
            <View style={{ width: 54, height: 30, alignItems: 'center', justifyContent: 'center' }}>
              {focused ? (
                <Animated.View
                  entering={ZoomIn.springify().damping(16)}
                  style={{
                    position: 'absolute',
                    width: 54,
                    height: 30,
                    borderRadius: radius.pill,
                    backgroundColor: p.primarySoft
                  }}
                />
              ) : null}
              <Ionicons name={focused ? icons.active : icons.idle} size={21} color={focused ? p.primary : p.textMuted} />
            </View>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 10.5,
                fontFamily: focused ? ty.family.bold : ty.family.semibold,
                color: focused ? p.primary : p.textMuted,
                maxWidth: 76
              }}
            >
              {label}
            </Text>
          </ScalePressable>
        )
      })}
    </View>
  )
}
