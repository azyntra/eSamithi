import React, { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { LayoutDashboard, Building2, KeyRound, ScrollText, Moon, Sun, LogOut, BarChart3, Megaphone, Activity } from 'lucide-react'
import { useAuth } from '../auth'
import { revokeImpersonation } from '../lib/enter'
import { useToast } from './ui'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/samithis', label: 'Samithis', icon: Building2 },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/broadcasts', label: 'Broadcasts', icon: Megaphone },
  { to: '/operations', label: 'Operations', icon: Activity },
  { to: '/sessions', label: 'Support sessions', icon: KeyRound },
  { to: '/audit', label: 'Audit log', icon: ScrollText }
]

const TITLES: Record<string, { h: string; sub: string }> = {
  '/': { h: 'Fleet dashboard', sub: 'Platform-wide health and financials' },
  '/samithis': { h: 'Samithis', sub: 'Manage every society on the platform' },
  '/reports': { h: 'Cross-samithi reports', sub: 'Compare and export fleet figures' },
  '/broadcasts': { h: 'Broadcasts', sub: 'Announce to the whole fleet at once' },
  '/operations': { h: 'Operations', sub: 'Health, releases, and platform controls' },
  '/sessions': { h: 'Support sessions', sub: 'Active impersonation sessions' },
  '/audit': { h: 'Audit log', sub: 'Every platform action, append-only' }
}

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState(() => localStorage.getItem('esamithi-theme') || 'light')
  const toggle = (): void => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    localStorage.setItem('esamithi-theme', next)
  }
  return [theme, toggle]
}

// An operator leaving a support session in the web app comes back here with
// ?exit=<sid>, because ending that session needs credentials only the console
// holds. Doing it here rather than at boot means it still works when the
// console login had lapsed and they had to sign in again on the way back.
function useExitingSupportSession(): void {
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const sid = params.get('exit')
  const done = useRef<string | null>(null)

  useEffect(() => {
    if (!sid || done.current === sid) return
    done.current = sid
    const next = new URLSearchParams(params)
    next.delete('exit')
    setParams(next, { replace: true })
    revokeImpersonation(sid).then(
      () => toast('success', 'Support session ended'),
      // Already expired, already revoked, or gone — the hour caps it regardless
      () => toast('info', 'Support session closed')
    )
  }, [sid, params, setParams, toast])
}

export default function Layout(): React.ReactElement {
  useExitingSupportSession()
  const { admin, logout } = useAuth()
  const [theme, toggleTheme] = useTheme()
  const loc = useLocation()
  const base = '/' + (loc.pathname.split('/')[1] || '')
  const t = TITLES[base] || TITLES['/']
  const initials = (admin?.name || 'SA').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">eS</div>
          <div>
            <h1>eSamithi</h1>
            <span>Platform Console</span>
          </div>
        </div>
        <nav className="nav">
          <div className="nav-section">Operations</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <n.icon size={17} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-user">
            <div className="avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#e2e8f0', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{admin?.name}</div>
              <div style={{ color: '#64748b', fontSize: 11 }}>{admin?.role}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <h2>{t.h}</h2>
            <div className="sub">{t.sub}</div>
          </div>
          <div className="topbar-actions">
            <button className="btn-icon" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => logout()}>
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
