import { Platform } from 'react-native'
import * as Device from 'expo-device'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { api } from '../api/client'

// Remote push needs a real device + a dev/production build (Expo Go ≥SDK 53
// cannot receive remote push — and on Android, Expo Go THROWS at import time
// for expo-notifications, so this module must never be imported statically).
// Everything here fails silently: the in-app Notices feed is the guaranteed
// path; push is an upgrade when available.

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient

type NotificationsModule = typeof import('expo-notifications')
let cached: NotificationsModule | null | undefined

// Lazy accessor — returns null in Expo Go (or if the native module is absent)
export function getNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached
  if (isExpoGo) {
    cached = null
    return null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: NotificationsModule = require('expo-notifications')
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false
      })
    })
    cached = mod
  } catch {
    cached = null
  }
  return cached
}

export async function registerPushToken(): Promise<void> {
  try {
    const Notifications = getNotifications()
    if (!Notifications || !Device.isDevice) return

    const existing = await Notifications.getPermissionsAsync()
    let status = existing.status
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status
    }
    if (status !== 'granted') return

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX
      })
    }

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data

    await api.post('/me/push-token', { token, platform: Platform.OS })
  } catch {
    // Simulator / denied permissions / missing native module — feed still works
  }
}
