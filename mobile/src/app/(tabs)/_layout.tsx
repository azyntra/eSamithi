import React, { useEffect } from 'react'
import { Tabs, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { useAuth } from '../../auth/AuthContext'
import { getNotifications, registerPushToken } from '../../lib/push'

export default function TabsLayout(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const router = useRouter()
  const { activeProfile } = useAuth()

  useEffect(() => {
    // Signed-in shell mounted (or samithi switched): register this device for
    // push with the active samithi (no-ops in Expo Go / simulator) and route
    // notification taps to the Notices tab.
    registerPushToken()
    const Notifications = getNotifications()
    if (!Notifications) return
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/(tabs)/notices')
    })
    return () => sub.remove()
  }, [router, activeProfile?.slug])

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: p.surface },
        headerTintColor: p.text,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.border },
        tabBarActiveTintColor: p.primary,
        tabBarInactiveTintColor: p.textMuted,
        sceneStyle: { backgroundColor: p.bg }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('mob.tabHome'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="puruka"
        options={{
          title: t('mob.tabPuruka'),
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="contributions"
        options={{
          title: t('mob.tabContributions'),
          tabBarIcon: ({ color, size }) => <Ionicons name="cash-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="loans"
        options={{
          title: t('mob.tabLoans'),
          tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: t('mob.tabNotices'),
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('mob.tabMore'),
          tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" color={color} size={size} />
        }}
      />
    </Tabs>
  )
}
