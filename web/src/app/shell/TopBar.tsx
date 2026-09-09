import { useRouter } from '@tanstack/react-router'
import { ChevronDown, LogOut, Menu, MonitorSmartphone } from 'lucide-react'
import { toast } from 'sonner'
import { LangSwitcher } from '@/components/LangSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { signOut, useSession, type Role } from '@/lib/api/session'
import { useT, type TranslationKey } from '@/lib/i18n'
import { errorMessage } from '@/lib/api/errors'

const ROLE_KEY: Record<Role, TranslationKey> = { admin: 'role.admin', user: 'role.user', viewer: 'role.viewer' }

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { t } = useT()
  const { user, samithi } = useSession()
  const router = useRouter()

  const leave = async (all: boolean) => {
    try {
      await signOut(all)
    } catch (e) {
      toast.error(errorMessage(e))
    }
    void router.navigate({ to: '/login' })
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={onMenu}>
        <Menu />
      </Button>

      <div className="flex min-w-0 items-center gap-2.5">
        <span className="truncate text-[15px] font-semibold">{samithi?.name ?? 'eSamithi'}</span>
        {samithi?.code && (
          <Badge variant="default" className="tnum hidden font-mono text-[11px] sm:inline-flex">
            {samithi.code}
          </Badge>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <LangSwitcher className="hidden sm:inline-flex" />
        <ThemeToggle />
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-1 flex items-center gap-2 rounded-full py-1 pr-2 pl-1 text-left transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="bg-brand-gradient grid size-8 place-items-center rounded-full text-[12px] font-bold text-white">{initials(user.full_name || user.username)}</span>
                <span className="hidden min-w-0 leading-tight md:block">
                  <span className="block max-w-[160px] truncate text-[13px] font-medium">{user.full_name}</span>
                  <span className="block text-[11px] text-muted-foreground">{t(ROLE_KEY[user.role] ?? 'role.user')}</span>
                </span>
                <ChevronDown className="hidden size-4 text-muted-foreground md:block" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="text-xs">{t('auth.signedInAs')}</div>
                <div className="truncate text-sm font-medium text-foreground">
                  {user.full_name} <span className="text-muted-foreground">· {user.username}</span>
                </div>
              </DropdownMenuLabel>
              <div className="px-2 pb-2 sm:hidden">
                <LangSwitcher />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void leave(false)}>
                <LogOut /> {t('sidebar.signOut')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void leave(true)}>
                <MonitorSmartphone /> {t('auth.signOutEverywhere')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
