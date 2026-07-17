import React, { useEffect } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { useType } from '../../typography'
import { useAuth } from '../../auth/AuthContext'
import { getNotifications, registerPushToken } from '../../lib/push'
import { TabBar } from '../../ui/TabBar'

export default function TabsLayout(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
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
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: p.surface },
        headerTintColor: p.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: ty.family.bold, fontSize: 17 },
        sceneStyle: { backgroundColor: p.bg }
      }}
    >
      {/* Home draws its own greeting header inside the screen */}
      <Tabs.Screen name="index" options={{ title: t('mob.tabHome'), headerShown: false }} />
      <Tabs.Screen name="puruka" options={{ title: t('mob.tabPuruka') }} />
      <Tabs.Screen name="contributions" options={{ title: t('mob.tabContributions') }} />
      <Tabs.Screen name="loans" options={{ title: t('mob.tabLoans') }} />
      <Tabs.Screen name="notices" options={{ title: t('mob.tabNotices') }} />
      <Tabs.Screen name="more" options={{ title: t('mob.tabMore') }} />
    </Tabs>
  )
}
