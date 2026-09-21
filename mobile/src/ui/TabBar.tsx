import React from 'react'
import { Text, View } from 'react-native'
// expo-router (SDK 57) vendors react-navigation — the public package isn't
// installed, so the tab-bar props type comes from the vendored build.
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types'
import Animated, { FadeIn } from 'react-native-reanimated'
import Ionicons from '@expo/vector-icons/Ionicons'
import { dur } from '../motion'
import { elevation, radius, spacing, usePalette } from '../theme'
import { interFamily, useType } from '../typography'
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
                  entering={FadeIn.duration(dur.micro)}
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
              {options.tabBarBadge != null ? (
                <Animated.View
                  entering={FadeIn.duration(dur.micro)}
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: 6,
                    minWidth: 18,
                    height: 18,
                    borderRadius: radius.pill,
                    backgroundColor: p.danger,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4
                  }}
                >
                  <Text maxFontSizeMultiplier={1.2} style={{ color: '#ffffff', fontSize: 12, fontFamily: interFamily.bold }}>
                    {String(options.tabBarBadge)}
                  </Text>
                </Animated.View>
              ) : null}
            </View>
            {/* Three of the six Sinhala labels are ten glyphs, and one of them
                (දැනුම්දීම්) has no space, so wrapping cannot save it. Shrinking
                to fit beats the ellipsis this used to show — but the real fix
                is shorter words, which is a Sinhala speaker's call, not a
                developer's. See decision O1 in the requirements. */}
            <Text
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              maxFontSizeMultiplier={1.2}
              style={{
                fontSize: 12,
                fontFamily: focused ? ty.family.bold : ty.family.semibold,
                color: focused ? p.primary : p.textMuted,
                textAlign: 'center',
                lineHeight: ty.lh(12)
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
