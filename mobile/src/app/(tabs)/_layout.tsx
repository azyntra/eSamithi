import React, { useEffect } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { useType } from '../../typography'
import { useAuth } from '../../auth/AuthContext'
import { getNotifications, registerPushToken } from '../../lib/push'
import { useAnnouncements } from '../../api/hooks'
import { useNoticesSeen } from '../../lib/noticesSeen'
import { TabBar } from '../../ui/TabBar'

export default function TabsLayout(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const { activeProfile, profiles, switchProfile } = useAuth()

  // Unread badge: announcements above the per-samithi seen watermark.
  // The query is shared with Home/Notices via React Query, so this adds no
  // extra network traffic.
  const notices = useAnnouncements()
  const { seenId } = useNoticesSeen()
  const unread = seenId === null || !notices.data ? 0 : notices.data.filter((n) => n.id > seenId).length

  useEffect(() => {
    // Signed-in shell mounted (or samithi switched): register this device for
    // push with the active samithi (no-ops in Expo Go / simulator) and route
    // notification taps to the Notices tab.
    registerPushToken()
    const Notifications = getNotifications()
    if (!Notifications) return
    // A notice push carries { type: 'announcement', id }: open that notice.
    // Anything else (or an older server without an id) lands on the list.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response?.notification?.request?.content?.data ?? {}) as { type?: string; id?: number | string; report_id?: number | string; sam?: string }
      const id = Number(data.id)
      // Meeting minutes pushes name their society (§7.5): switch to it first,
      // then open the report. A society this phone doesn't have stays put.
      if (data.type === 'minutes' || data.type === 'minutes_comment' || data.type === 'minutes_secretary') {
        const reportId = Number(data.report_id)
        const open = (): void => {
          if (data.type === 'minutes_secretary') router.push('/meeting-records/secretary')
          else if (Number.isFinite(reportId) && reportId > 0) router.push(data.type === 'minutes_comment' ? `/meeting-records/${reportId}/comments` : `/meeting-records/${reportId}`)
          else router.push('/meeting-records')
        }
        if (data.sam && data.sam !== activeProfile?.slug && profiles.some((pr) => pr.slug === data.sam)) {
          switchProfile(data.sam).then(open).catch(() => {})
        } else open()
        return
      }
      if (data.type === 'announcement' && Number.isFinite(id) && id > 0) router.push(`/notice/${id}`)
      else router.push('/(tabs)/notices')
    })
    return () => sub.remove()
  }, [router, activeProfile?.slug, profiles, switchProfile])

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        // Tab screens draw their own large title in the page (redesign §5)
        headerShown: false,
        headerStyle: { backgroundColor: p.surface },
        headerTintColor: p.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: ty.family.bold, fontSize: 18 },
        sceneStyle: { backgroundColor: p.bg }
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('mob.tabHome') }} />
      <Tabs.Screen name="money" options={{ title: t('mob.tabMoney') }} />
      <Tabs.Screen
        name="notices"
        options={{ title: t('mob.tabNotices'), tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : String(unread)) : undefined }}
      />
      <Tabs.Screen name="puruka" options={{ title: t('mob.tabPuruka') }} />
      <Tabs.Screen name="me" options={{ title: t('mob.tabMe') }} />
    </Tabs>
  )
}
