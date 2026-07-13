import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Receipt,
  Landmark,
  FileBarChart,
  MessageSquare,
  CalendarCheck,
  Wallet,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sun
} from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { getTheme, applyTheme, type Theme } from '../utils/theme'
import { useT, LangSwitcher } from '../i18n'
import type { TranslationKey } from '../i18n/en'
import ConfirmModal from './ConfirmModal'

const navItems: Array<{ to: string; labelKey: TranslationKey; icon: React.ElementType }> = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/members', labelKey: 'nav.members', icon: Users },
  { to: '/incomes', labelKey: 'nav.incomes', icon: DollarSign },
  { to: '/expenses', labelKey: 'nav.expenses', icon: Receipt },
  { to: '/loans', labelKey: 'nav.loans', icon: Landmark },
  { to: '/reports', labelKey: 'nav.reports', icon: FileBarChart },
  { to: '/messages', labelKey: 'nav.messages', icon: MessageSquare },
  { to: '/attendance', labelKey: 'nav.attendance', icon: CalendarCheck },
  { to: '/wallet', labelKey: 'nav.wallet', icon: Wallet },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings }
]

interface SidebarProps {
  user: { full_name: string; role: string }
  onLogout: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function Sidebar({ user, onLogout, collapsed, onToggleCollapse }: SidebarProps): React.ReactElement {
  const { t } = useT()
  // Shares the dashboard cache — no extra request beyond the landing page's
  const { stats } = useDashboard()
  const activeLoans = stats?.activeLoansCount ?? 0

  const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1)

  const [theme, setTheme] = useState<Theme>(getTheme)
  const toggleTheme = (): void => {
    const next = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`} role="navigation" aria-label="Main navigation">
      <div className="sidebar-brand">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
          {!collapsed && (
            <div>
              <h1>eSamithi</h1>
              <p>{t('sidebar.tagline')}</p>
            </div>
          )}
          <button
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={t(item.labelKey)}
            onDoubleClick={onToggleCollapse}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <item.icon />
            {!collapsed && <span style={{ flex: 1 }}>{t(item.labelKey)}</span>}
            {!collapsed && item.to === '/loans' && activeLoans > 0 && (
              <span
                title={t('sidebar.activeLoans', { count: activeLoans })}
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  borderRadius: '10px',
                  padding: '1px 8px',
                  fontSize: '0.7rem',
                  fontWeight: 700
                }}
              >
                {activeLoans}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-info" title={`${user.full_name} (${roleLabel})`}>
          <div className="sidebar-user-avatar">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="sidebar-user-details">
              <span className="sidebar-user-name">{user.full_name}</span>
              <span className="sidebar-user-role">{roleLabel}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '2px', flexDirection: collapsed ? 'column' : 'row' }}>
          <button
            className="sidebar-logout-btn neutral"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')}
            title={theme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="sidebar-logout-btn"
            onClick={() => setShowLogoutConfirm(true)}
            aria-label={t('sidebar.signOut')}
            title={t('sidebar.signOut')}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div
        style={{
          padding: collapsed ? '8px 8px 12px' : '8px 20px 12px',
          fontSize: '0.7rem',
          color: 'rgba(255,255,255,0.45)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px'
        }}
      >
        <LangSwitcher style={collapsed ? { flexDirection: 'column' } : undefined} />
        {!collapsed && <span>eSamithi v{__APP_VERSION__}</span>}
      </div>

      {showLogoutConfirm && (
        <ConfirmModal
          title={t('sidebar.signOutConfirmTitle')}
          message={t('sidebar.signOutConfirmMsg')}
          confirmLabel={t('sidebar.signOut')}
          onConfirm={onLogout}
          onClose={() => setShowLogoutConfirm(false)}
        />
      )}
    </aside>
  )
}
