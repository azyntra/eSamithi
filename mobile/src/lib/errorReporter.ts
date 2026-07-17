import axios from 'axios'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Updates from 'expo-updates'
import { BUILD_API_URL, BUILD_SAMITHI } from '../api/client'

// Crash reporting without a tracker SDK (the privacy policy promises none):
// fatal JS errors and unhandled promise rejections are posted to our own
// /client-errors endpoint, fire-and-forget. Deliberately uses a bare axios
// call with build-time constants — the shared client's interceptors (token
// refresh etc.) are exactly the kind of machinery that may be broken when
// this code runs.

const MAX_REPORTS_PER_SESSION = 5
let sent = 0
const seen = new Set<string>()

export function reportError(err: unknown, isFatal: boolean, context: string): void {
  try {
    if (sent >= MAX_REPORTS_PER_SESSION) return
    const e = err instanceof Error ? err : new Error(String(err))
    const key = `${e.message}|${context}`
    if (seen.has(key)) return
    seen.add(key)
    sent++
    axios
      .post(
        `${BUILD_API_URL}/client-errors`,
        {
          platform: Platform.OS,
          app_version: `${Constants.expoConfig?.version ?? '?'} (${Updates.updateId?.slice(0, 8) ?? 'embedded'})`,
          update_id: Updates.updateId ?? null,
          is_fatal: isFatal,
          message: e.message,
          stack: e.stack ?? null,
          context
        },
        {
          timeout: 10000,
          headers: BUILD_SAMITHI ? { 'X-Samithi': BUILD_SAMITHI } : undefined
        }
      )
      .catch(() => {})
  } catch {
    // The reporter must never be the thing that crashes
  }
}

// Wire the global hooks once, at import time (imported from app/_layout).
type GlobalHandler = (error: unknown, isFatal?: boolean) => void
interface ErrorUtilsLike {
  getGlobalHandler: () => GlobalHandler
  setGlobalHandler: (fn: GlobalHandler) => void
}
const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils

if (errorUtils) {
  const previous = errorUtils.getGlobalHandler()
  errorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, isFatal ?? false, 'global')
    previous(error, isFatal)
  })
}

// Unhandled promise rejections (Hermes exposes the standard hook)
interface RejectionEvent { reason?: unknown }
const g = globalThis as { addEventListener?: (type: string, fn: (e: RejectionEvent) => void) => void }
if (typeof g.addEventListener === 'function') {
  g.addEventListener('unhandledrejection', (e) => {
    reportError(e?.reason ?? 'unhandled rejection', false, 'promise')
  })
}
