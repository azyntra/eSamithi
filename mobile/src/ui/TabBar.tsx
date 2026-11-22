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
  money: { active: 'wallet', idle: 'wallet-outline' },
  notices: { active: 'notifications', idle: 'notifications-outline' },
  puruka: { active: 'storefront', idle: 'storefront-outline' },
  me: { active: 'person-circle', idle: 'person-circle-outline' }
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
        // A single word too wide for its slot must shrink, never wrap: Android
        // breaks an unspaced word wherever it runs out of room ("Contributio" /
        // "ns"), and a label that has already wrapped counts as fitting, so the
        // shrink below never happens. Labels with a space may still use two lines.
        const oneWord = !/\s/.test(label.trim())
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
              <Ionicons name={focused ? icons.active : icons.idle} size={21} color={focused ? p.primaryOnSoft : p.textMuted} />
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
                    backgroundColor: p.primary,
                    borderWidth: 2,
                    borderColor: p.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4
                  }}
                >
                  <Text maxFontSizeMultiplier={1.2} style={{ color: p.onPrimary, fontSize: 12, fontFamily: interFamily.bold }}>
                    {String(options.tabBarBadge)}
                  </Text>
                </Animated.View>
              ) : null}
            </View>
            {/* Five slots of ~72 dp: every label fits on one line at 12 sp
                (decision O1 picked the short Sinhala words). A label that is
                still too wide shrinks rather than wrapping mid-word. */}
            <Text
              numberOfLines={oneWord ? 1 : 2}
              adjustsFontSizeToFit
              minimumFontScale={oneWord ? 0.7 : 0.85}
              maxFontSizeMultiplier={1.2}
              style={{
                fontSize: 12,
                fontFamily: focused ? ty.family.bold : ty.family.semibold,
                color: focused ? p.primaryOnSoft : p.textMuted,
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
