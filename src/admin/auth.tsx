import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, setAccessToken, onSessionExpired, REFRESH_KEY } from './api'

export interface Admin {
  id: number
  email: string
  name: string
  role: 'superadmin' | 'operator' | 'auditor'
}

interface AuthValue {
  admin: Admin | null
  status: 'loading' | 'out' | 'in'
  login: (email: string, password: string) => Promise<string> // returns mfa_token
  verifyTotp: (mfaToken: string, code: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthValue>(null as unknown as AuthValue)

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [status, setStatus] = useState<'loading' | 'out' | 'in'>('loading')

  useEffect(() => {
    onSessionExpired(() => {
      setAdmin(null)
      setStatus('out')
    })
    // Resume: a refresh token in this tab means we can re-establish a session
    ;(async () => {
      if (!sessionStorage.getItem(REFRESH_KEY)) {
        setStatus('out')
        return
      }
      try {
        const me = await api<Admin>('/me')
        setAdmin(me)
        setStatus('in')
      } catch {
        setStatus('out')
      }
    })()
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<string> => {
    const d = await api<{ mfa_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
    return d.mfa_token
  }, [])

  const verifyTotp = useCallback(async (mfaToken: string, code: string): Promise<void> => {
    const d = await api<{ token: string; refresh_token: string; admin: Admin }>('/auth/totp', {
      method: 'POST',
      body: JSON.stringify({ mfa_token: mfaToken, code })
    })
    setAccessToken(d.token)
    sessionStorage.setItem(REFRESH_KEY, d.refresh_token)
    setAdmin(d.admin)
    setStatus('in')
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    const rt = sessionStorage.getItem(REFRESH_KEY)
    if (rt) await api('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: rt }) }).catch(() => {})
    sessionStorage.removeItem(REFRESH_KEY)
    setAccessToken(null)
    setAdmin(null)
    setStatus('out')
  }, [])

  return <Ctx.Provider value={{ admin, status, login, verifyTotp, logout }}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  return useContext(Ctx)
}
