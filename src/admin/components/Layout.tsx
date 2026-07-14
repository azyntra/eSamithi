import React, { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, Building2, KeyRound, ScrollText, Moon, Sun, LogOut } from 'lucide-react'
import { useAuth } from '../auth'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/samithis', label: 'Samithis', icon: Building2 },
  { to: '/sessions', label: 'Support sessions', icon: KeyRound },
  { to: '/audit', label: 'Audit log', icon: ScrollText }
]

const TITLES: Record<string, { h: string; sub: string }> = {
  '/': { h: 'Fleet dashboard', sub: 'Platform-wide health and financials' },
  '/samithis': { h: 'Samithis', sub: 'Manage every society on the platform' },
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

export default function Layout(): React.ReactElement {
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
