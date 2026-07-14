import React, { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import Layout from './components/Layout'
import { I18nProvider } from './i18n'
import ToastContainer, { showToast } from './components/Toast'
import { clearAllCaches } from './utils/cache'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import Dashboard from './pages/Dashboard'
import Members from './pages/Members'
import Incomes from './pages/Incomes'
import Expenses from './pages/Expenses'
import Loans from './pages/Loans'
import Reports from './pages/Reports'
import Messages from './pages/Messages'
import Attendance from './pages/Attendance'
import WalletPage from './pages/Wallet'
import SettingsPage from './pages/Settings'

interface AuthUser {
  id: number
  username: string
  full_name: string
  role: string
}

function OfflineBar(): React.ReactElement {
  const [retrying, setRetrying] = useState(false)

  const retry = async (): Promise<void> => {
    setRetrying(true)
    try {
      const reachable = await window.api.network.ping()
      if (reachable) showToast('success', 'Connection to the server restored')
      // reachable pings broadcast network:online, which hides this bar
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '8px 16px',
        background: '#b91c1c',
        color: '#fff',
        fontSize: '0.85rem',
        fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
      }}
    >
      <WifiOff size={16} />
      <span>Server unreachable — check your network connection.</span>
      <button
        onClick={retry}
        disabled={retrying}
        style={{
          border: '1px solid rgba(255,255,255,0.6)',
          background: 'rgba(255,255,255,0.12)',
          color: '#fff',
          borderRadius: '6px',
          padding: '3px 14px',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: retrying ? 'wait' : 'pointer'
        }}
      >
        {retrying ? 'Checking…' : 'Retry'}
      </button>
    </div>
  )
}

// Super-admin support workspace injects a pre-authenticated user (the
// impersonation token is already valid) so we skip the login/setup screens.
// Undefined in the normal desktop app — zero effect there.
const impersonationUser = (globalThis as { __IMPERSONATION__?: { user: AuthUser } }).__IMPERSONATION__?.user

export default function App(): React.ReactElement {
  const [user, setUser] = useState<AuthUser | null>(impersonationUser ?? null)
  const [offline, setOffline] = useState(false)
  // null = still asking the main process; true = no samithi configured yet
  // (first run) → show the samithi-code setup screen before login
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(impersonationUser ? false : null)

  useEffect(() => {
    if (impersonationUser) return // workspace: already authenticated
    window.api.setup
      ?.getState?.()
      .then((s) => setSetupNeeded(!s.configured))
      .catch(() => setSetupNeeded(false))
  }, [])

  // JWT expired mid-session (main process saw a 401) — return to login
  useEffect(() => {
    const cleanup = window.api.auth.onSessionExpired?.(() => {
      clearAllCaches()
      setUser(null)
      showToast('error', 'Your session has expired. Please sign in again.')
    })
    return cleanup
  }, [])

  // One offline bar instead of a raw axios error toast per failed action
  useEffect(() => {
    const offOffline = window.api.network?.onOffline?.(() => setOffline(true))
    const offOnline = window.api.network?.onOnline?.(() => setOffline(false))
    return () => {
      offOffline?.()
      offOnline?.()
    }
  }, [])

  // type="number" inputs (rates, months, counts) change value on scroll-wheel
  // hover — blur them so scrolling the page can't silently edit a field
  useEffect(() => {
    const onWheel = (): void => {
      const el = document.activeElement as HTMLInputElement | null
      if (el && el.tagName === 'INPUT' && el.type === 'number') el.blur()
    }
    document.addEventListener('wheel', onWheel, { passive: true })
    return () => document.removeEventListener('wheel', onWheel)
  }, [])

  const handleLogin = (loggedInUser: AuthUser): void => {
    clearAllCaches()
    setUser(loggedInUser)
  }

  const handleLogout = (): void => {
    clearAllCaches()
    window.api.auth.logout?.().catch(() => {})
    setUser(null)
  }

  // Show setup (first run) or login screen if not authenticated
  if (!user) {
    return (
      <I18nProvider>
        <ToastContainer />
        {offline && <OfflineBar />}
        {setupNeeded === null ? null : setupNeeded ? (
          <SetupPage onDone={() => setSetupNeeded(false)} />
        ) : (
          <LoginPage onLogin={handleLogin} />
        )}
      </I18nProvider>
    )
  }

  return (
    <I18nProvider>
      <HashRouter>
        <ToastContainer />
        {offline && <OfflineBar />}
        <Routes>
          <Route path="/" element={<Layout user={user} onLogout={handleLogout} />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="members" element={<Members />} />
            <Route path="incomes" element={<Incomes />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="loans" element={<Loans />} />
            <Route path="reports" element={<Reports />} />
            <Route path="messages" element={<Messages />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="settings" element={<SettingsPage user={user} />} />
          </Route>
        </Routes>
      </HashRouter>
    </I18nProvider>
  )
}
