import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import { useQueryClient } from '@tanstack/react-query'
import {
  api,
  BUILD_API_URL,
  BUILD_SAMITHI,
  REFRESH_TOKEN_KEY,
  refreshSession,
  registerSessionExpiredHandler,
  setAccessToken,
  setActiveApi
} from '../api/client'
import {
  getActiveSlug,
  loadProfiles,
  refreshTokenKey,
  setActiveSlugStored,
  upsertProfile,
  type SamithiProfile
} from '../lib/profiles'

type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

// Opt-in Face ID / fingerprint gate, set from the More tab
export const BIOMETRIC_KEY = 'esamithi.biometric'

interface AuthContextValue {
  status: AuthStatus
  profiles: SamithiProfile[]
  activeProfile: SamithiProfile | null
  // The samithi the (auth) flow is targeting: set by the samithi-code screen,
  // consumed by verify/login/set-pin via signInWithTokens.
  pendingProfile: SamithiProfile | null
  setPendingProfile: (profile: SamithiProfile | null) => void
  signInWithTokens: (token: string, refreshToken: string) => Promise<void>
  switchProfile: (slug: string) => Promise<void>
  addSamithi: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  status: 'loading',
  profiles: [],
  activeProfile: null,
  pendingProfile: null,
  setPendingProfile: () => {},
  signInWithTokens: async () => {},
  switchProfile: async () => {},
  addSamithi: () => {},
  signOut: async () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [profiles, setProfiles] = useState<SamithiProfile[]>([])
  const [activeProfile, setActiveProfile] = useState<SamithiProfile | null>(null)
  const [pendingProfile, setPendingProfileState] = useState<SamithiProfile | null>(null)
  const pendingRef = useRef<SamithiProfile | null>(null)
  const activeRef = useRef<SamithiProfile | null>(null)
  const queryClient = useQueryClient()

  const setPendingProfile = useCallback((profile: SamithiProfile | null) => {
    pendingRef.current = profile
    setPendingProfileState(profile)
    // The (auth) screens talk to the samithi being signed into
    if (profile) setActiveApi({ slug: profile.slug, apiUrl: profile.apiUrl })
  }, [])

  const activate = useCallback(async (profile: SamithiProfile | null) => {
    activeRef.current = profile
    setActiveProfile(profile)
    setActiveApi(profile ? { slug: profile.slug, apiUrl: profile.apiUrl } : null)
    await setActiveSlugStored(profile?.slug ?? null)
  }, [])

  // Cold start: load profiles, migrate any pre-multi-samithi session, then
  // exchange the active samithi's stored refresh token
  useEffect(() => {
    let mounted = true
    registerSessionExpiredHandler(() => { if (mounted) setStatus('signedOut') })
    ;(async () => {
      try {
        let list = await loadProfiles()
        let activeSlug = await getActiveSlug()

        // Legacy migration: single-samithi sessions predate profiles — wrap
        // the old refresh token in a profile built from the build-time config
        const legacy = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY).catch(() => null)
        if (list.length === 0 && legacy && BUILD_SAMITHI) {
          const migrated: SamithiProfile = { code: '', slug: BUILD_SAMITHI, name: '', apiUrl: BUILD_API_URL }
          list = await upsertProfile(migrated)
          activeSlug = migrated.slug
          await SecureStore.setItemAsync(refreshTokenKey(migrated.slug), legacy)
          await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {})
        }

        if (!mounted) return
        setProfiles(list)
        const active = list.find((p) => p.slug === activeSlug) ?? null
        await activate(active)

        const stored = active
          ? await SecureStore.getItemAsync(refreshTokenKey(active.slug)).catch(() => null)
          : null
        if (!stored) { if (mounted) setStatus('signedOut'); return }

        // Biometric gate (opt-in): a failed/cancelled prompt falls back to
        // the PIN login screen — the stored session itself is kept.
        const bio = await SecureStore.getItemAsync(BIOMETRIC_KEY).catch(() => null)
        if (bio === '1') {
          const enrolled =
            (await LocalAuthentication.hasHardwareAsync()) &&
            (await LocalAuthentication.isEnrolledAsync())
          if (enrolled) {
            const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'eSamithi' })
            if (!result.success) { if (mounted) setStatus('signedOut'); return }
          }
        }

        const token = await refreshSession()
        if (mounted) setStatus(token ? 'signedIn' : 'signedOut')
      } catch {
        if (mounted) setStatus('signedOut')
      }
    })()
    return () => { mounted = false }
  }, [activate])

  const signInWithTokens = useCallback(async (token: string, refreshToken: string) => {
    const target = pendingRef.current ?? activeRef.current
    if (target) {
      const list = await upsertProfile(target)
      setProfiles(list)
      await activate(target)
      await SecureStore.setItemAsync(refreshTokenKey(target.slug), refreshToken)
    } else {
      // No profile context (shouldn't happen after migration) — legacy key
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken)
    }
    setPendingProfile(null)
    setAccessToken(token)
    queryClient.clear()
    setStatus('signedIn')
  }, [activate, queryClient, setPendingProfile])

  // Bank-app style account switching: silent when that samithi's refresh
  // token is still alive, otherwise its login screen.
  const switchProfile = useCallback(async (slug: string) => {
    const target = profiles.find((p) => p.slug === slug)
    if (!target || target.slug === activeRef.current?.slug) return
    setAccessToken(null)
    queryClient.clear()
    await activate(target)
    const stored = await SecureStore.getItemAsync(refreshTokenKey(slug)).catch(() => null)
    if (stored) {
      const token = await refreshSession()
      if (token) { setStatus('signedIn'); return }
    }
    setPendingProfile(target)
    setStatus('signedOut')
  }, [activate, profiles, queryClient, setPendingProfile])

  // Enroll in another samithi: keeps every stored session, just drops into
  // the (auth) flow at the samithi-code screen.
  const addSamithi = useCallback(() => {
    setAccessToken(null)
    setPendingProfile(null)
    setStatus('signedOut')
  }, [setPendingProfile])

  const signOut = useCallback(async () => {
    const active = activeRef.current
    const key = active ? refreshTokenKey(active.slug) : REFRESH_TOKEN_KEY
    const stored = await SecureStore.getItemAsync(key).catch(() => null)
    if (stored) {
      // Best-effort server-side revocation; local cleanup happens regardless
      api.post('/member-auth/logout', { refresh_token: stored }).catch(() => {})
    }
    await SecureStore.deleteItemAsync(key).catch(() => {})
    setAccessToken(null)
    queryClient.clear()

    // Another samithi still has a live session? Switch to it silently.
    if (active) {
      for (const other of profiles.filter((p) => p.slug !== active.slug)) {
        const otherToken = await SecureStore.getItemAsync(refreshTokenKey(other.slug)).catch(() => null)
        if (otherToken) {
          await activate(other)
          const token = await refreshSession()
          if (token) { setStatus('signedIn'); return }
        }
      }
    }
    setPendingProfile(active)
    setStatus('signedOut')
  }, [activate, profiles, queryClient, setPendingProfile])

  const value = useMemo(
    () => ({ status, profiles, activeProfile, pendingProfile, setPendingProfile, signInWithTokens, switchProfile, addSamithi, signOut }),
    [status, profiles, activeProfile, pendingProfile, setPendingProfile, signInWithTokens, switchProfile, addSamithi, signOut]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
