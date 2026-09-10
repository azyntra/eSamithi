import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { apiBase } from '@/lib/api/samithi'
import { useSession } from '@/lib/api/session'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { NAV_GROUPS } from './nav'

interface SidebarProps {
  collapsed: boolean
  onToggle?: () => void
  onNavigate?: () => void
}

function useApiVersion(): string | null {
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: () => fetch(`${apiBase()}/health`).then((r) => r.json() as Promise<{ api_version?: string }>),
    staleTime: 5 * 60_000,
    retry: false
  })
  return data?.api_version ?? null
}

export function Sidebar({ collapsed, onToggle, onNavigate }: SidebarProps) {
  const { t } = useT()
  const { samithi } = useSession()
  const apiVersion = useApiVersion()

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn('flex h-16 items-center gap-3 border-b border-sidebar-border px-4', collapsed && 'justify-center px-0')}>
        <BrandMark size={34} className="shadow-none" />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="text-[15px] font-bold tracking-tight text-white">eSamithi</div>
            <div className="truncate text-[11px] text-sidebar-muted">{samithi?.name ?? t('sidebar.tagline')}</div>
          </div>
        )}
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3" aria-label="Main">
        {NAV_GROUPS.map((group) => (
          <div key={group.key} className="mb-3">
            {!collapsed && <div className="px-3 pt-2 pb-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-sidebar-muted uppercase">{t(group.key)}</div>}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const link = (
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium text-sidebar-foreground/85 transition-colors duration-150 hover:bg-sidebar-hover hover:text-white',
                      collapsed && 'justify-center px-0'
                    )}
                    activeProps={{ className: 'bg-sidebar-active text-sidebar-active-foreground! hover:bg-sidebar-active shadow-sm', 'aria-current': 'page' }}
                  >
                    <Icon className="size-[18px] shrink-0 opacity-90" aria-hidden />
                    {!collapsed && <span className="truncate">{t(item.key)}</span>}
                  </Link>
                )
                return (
                  <li key={item.to}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{t(item.key)}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn('border-t border-sidebar-border p-3', collapsed ? 'flex flex-col items-center gap-2' : 'flex items-center justify-between gap-2')}>
        {!collapsed && (
          <div className="tnum text-[11px] leading-tight text-sidebar-muted">
            web v{__APP_VERSION__}
            {apiVersion ? ` · api v${apiVersion}` : ''}
          </div>
        )}
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            className="grid size-8 place-items-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-white"
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        )}
      </div>
    </div>
  )
}
