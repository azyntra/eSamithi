import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import { refreshTokenKey } from '../lib/profiles'

// API base comes from app.json → expo.extra: set "apiEnv" to a key of
// "apiUrls" ("prod" | "testbed") to switch environments; a flat "apiUrl"
// still works as a manual override. Restart Metro after changing it.
interface ApiExtra {
  apiEnv?: string
  apiUrls?: Record<string, string>
  apiUrl?: string
  samithis?: Record<string, string>
  samithi?: string
}

const extra = (Constants.expoConfig?.extra ?? {}) as ApiExtra
const API_URL: string =
  (extra.apiEnv && extra.apiUrls?.[extra.apiEnv]) ??
  extra.apiUrl ??
  'http://141.147.75.132/api/v1'

// Build-time default samithi (used until a profile is set / for legacy
// sessions from before samithi-code login). Absent on prod until it migrates.
export const BUILD_SAMITHI: string | undefined =
  (extra.apiEnv ? extra.samithis?.[extra.apiEnv] : undefined) ?? extra.samithi

export { API_URL as BUILD_API_URL }

// Active samithi profile (multi-samithi): AuthContext sets this on cold
// start, sign-in, and switching. Everything below — baseURL, X-Samithi
// header, refresh-token storage key, photo origins — follows it.
interface ActiveApi {
  slug: string
  apiUrl: string
}
let activeApi: ActiveApi | null = null

export function setActiveApi(profile: ActiveApi | null): void {
  activeApi = profile
}

function currentApiUrl(): string {
  return activeApi?.apiUrl ?? API_URL
}

function currentSlug(): string | undefined {
  return activeApi?.slug ?? BUILD_SAMITHI
}

export const REFRESH_TOKEN_KEY = 'esamithi.refreshToken' // legacy single-samithi key (migrated on cold start)

export function currentRefreshKey(): string {
  return activeApi ? refreshTokenKey(activeApi.slug) : REFRESH_TOKEN_KEY
}

export function photoUrl(serverPath: string): string {
  return `${currentApiUrl().replace(/\/api\/v1\/?$/, '')}${serverPath}`
}

// Access token lives in memory only; the refresh token sits in SecureStore
let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function hasAccessToken(): boolean {
  return accessToken !== null
}

// AuthContext registers this so a dead session bounces the user to login
let onSessionExpired: (() => void) | null = null
export function registerSessionExpiredHandler(fn: () => void): void {
  onSessionExpired = fn
}

export const api = axios.create({ baseURL: API_URL, timeout: 20000 })

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.baseURL = currentApiUrl()
  const slug = currentSlug()
  if (slug) config.headers['X-Samithi'] = slug
  if (accessToken && !config.url?.startsWith('/member-auth/')) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// Single-flight refresh: concurrent 401s share one rotation
let refreshPromise: Promise<string | null> | null = null

export async function refreshSession(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const key = currentRefreshKey()
        const stored = await SecureStore.getItemAsync(key)
        if (!stored) return null
        const slug = currentSlug()
        const res = await axios.post(
          `${currentApiUrl()}/member-auth/refresh`,
          { refresh_token: stored },
          { timeout: 20000, headers: slug ? { 'X-Samithi': slug } : undefined }
        )
        const { token, refresh_token } = res.data
        await SecureStore.setItemAsync(key, refresh_token)
        setAccessToken(token)
        return token as string
      } catch (err) {
        // Only a definitive rejection kills the session — network blips don't
        if (axios.isAxiosError(err) && err.response && [400, 401, 423].includes(err.response.status)) {
          await SecureStore.deleteItemAsync(currentRefreshKey()).catch(() => {})
          setAccessToken(null)
          onSessionExpired?.()
        }
        return null
      } finally {
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
  if (
    error.response?.status === 401 &&
    config &&
    !config._retried &&
    !config.url?.startsWith('/member-auth/')
  ) {
    const token = await refreshSession()
    if (token) {
      config._retried = true
      config.headers.Authorization = `Bearer ${token}`
      return api.request(config)
    }
  }
  return Promise.reject(error)
})

// Server errors arrive as { error: '...' } — surface that message when present
export function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined
    if (data?.error) return data.error
  }
  return fallback
}
