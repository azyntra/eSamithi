import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Database } from 'lucide-react'
import Sidebar from './Sidebar'
import { useSettings } from '../hooks/useSettings'
import { useT } from '../i18n'

interface LayoutProps {
  user: { full_name: string; role: string }
  onLogout: () => void
}

export default function Layout({ user, onLogout }: LayoutProps): React.ReactElement {
  const { settings } = useSettings()
  const { t } = useT()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('esamithi-sidebar-collapsed') === 'true')

  const toggleCollapsed = (): void => {
    setCollapsed((c) => {
      localStorage.setItem('esamithi-sidebar-collapsed', String(!c))
      return !c
    })
  }

  // Requirement 2 (v2.0): while migration_completed = 'false' the society is
  // still entering its paper-record position — make the mode unmistakable.
  const inMigrationMode = settings.migration_completed === 'false'

  return (
    <div className="app-layout" style={{ ['--sidebar-width' as string]: collapsed ? '72px' : '260px' } as React.CSSProperties}>
      <Sidebar user={user} onLogout={onLogout} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      <main className="main-content">
        {inMigrationMode && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 24px',
              background: 'var(--warning-light)',
              borderBottom: '1px solid var(--warning-border)',
              color: 'var(--warning-text)',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            <Database size={16} />
            <span>{t('banner.migration')}</span>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
