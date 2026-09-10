import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowDownToLine, ArrowUpFromLine, CalendarPlus, HandCoins, Languages, LogOut, Megaphone, Moon, ScanLine, Sun, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { memberSublabel } from '@/components/MemberPicker'
import { NAV_GROUPS } from '@/app/shell/nav'
import { useMembersSlim } from '@/features/members/queries'
import { errorMessage } from '@/lib/api/errors'
import { signOut, useSession } from '@/lib/api/session'
import { useT } from '@/lib/i18n'
import { FLAG_ON } from '@/lib/router/flags'
import { useTheme } from '@/lib/theme'

interface QuickAction {
  id: string
  labelKey: Parameters<ReturnType<typeof useT>['t']>[0]
  icon: typeof Users
  run: (go: ReturnType<typeof useNavigate>) => void
}

// Quick actions are ordinary links, not hidden state: every one of them is a
// URL a page already knows how to honour, so the palette, a bookmark and the
// desktop shell all reach the same screen.
const ACTIONS: QuickAction[] = [
  { id: 'income', labelKey: 'cmd.recordIncome', icon: ArrowDownToLine, run: (go) => void go({ to: '/incomes', search: { create: FLAG_ON } }) },
  { id: 'expense', labelKey: 'cmd.recordExpense', icon: ArrowUpFromLine, run: (go) => void go({ to: '/expenses', search: { create: FLAG_ON } }) },
  { id: 'member', labelKey: 'cmd.addMember', icon: UserPlus, run: (go) => void go({ to: '/members', search: { create: FLAG_ON } }) },
  { id: 'scan', labelKey: 'cmd.scanCard', icon: ScanLine, run: (go) => void go({ to: '/members', search: { scan: FLAG_ON } }) },
  { id: 'loan', labelKey: 'cmd.issueLoan', icon: HandCoins, run: (go) => void go({ to: '/loans', search: { create: FLAG_ON } }) },
  { id: 'notice', labelKey: 'cmd.newAnnouncement', icon: Megaphone, run: (go) => void go({ to: '/messages', search: { create: FLAG_ON } }) },
  { id: 'event', labelKey: 'cmd.newEvent', icon: CalendarPlus, run: (go) => void go({ to: '/attendance', search: { create: FLAG_ON } }) }
]

export function useCommandPalette(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return [open, setOpen]
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, lang, setLang } = useT()
  const navigate = useNavigate()
  const [theme, setTheme] = useTheme()
  const { user } = useSession()
  const [query, setQuery] = useState('')
  // The member list is only worth fetching once the palette has been opened.
  const members = useMembersSlim(open)

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const run = useCallback(
    (fn: () => void) => {
      onOpenChange(false)
      fn()
    },
    [onOpenChange]
  )

  // cmdk already filters on the rendered value; the member list is capped so
  // a 3,000-member society does not render 3,000 rows.
  const memberMatches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return (members.data ?? [])
      .filter((m) => m.full_name.toLowerCase().includes(q) || memberSublabel(m).toLowerCase().includes(q))
      .slice(0, 8)
  }, [members.data, query])

  const canWrite = user?.role !== 'viewer'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">{t('cmd.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('cmd.hint')}</DialogDescription>
        <Command shouldFilter>
          <CommandInput placeholder={t('cmd.placeholder')} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{t('cmd.noResults')}</CommandEmpty>

            {memberMatches.length > 0 && (
              <CommandGroup heading={t('nav.members')}>
                {memberMatches.map((m) => (
                  <CommandItem key={m.id} value={`${m.full_name} ${memberSublabel(m)}`} onSelect={() => run(() => void navigate({ to: '/members/$memberId', params: { memberId: m.id }, search: { tab: undefined } }))}>
                    <Users />
                    <span className="flex-1 truncate">{m.full_name}</span>
                    <span className="tnum text-xs text-muted-foreground">{memberSublabel(m)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {canWrite && (
              <CommandGroup heading={t('cmd.actions')}>
                {ACTIONS.map((a) => {
                  const Icon = a.icon
                  return (
                    <CommandItem key={a.id} value={t(a.labelKey)} onSelect={() => run(() => a.run(navigate))}>
                      <Icon />
                      {t(a.labelKey)}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}

            <CommandSeparator />

            <CommandGroup heading={t('cmd.goTo')}>
              {NAV_GROUPS.flatMap((g) => g.items).map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem key={item.to} value={t(item.key)} onSelect={() => run(() => void navigate({ to: item.to }))}>
                    <Icon />
                    {t(item.key)}
                  </CommandItem>
                )
              })}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading={t('cmd.system')}>
              <CommandItem value={t(theme === 'dark' ? 'theme.light' : 'theme.dark')} onSelect={() => run(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}>
                {theme === 'dark' ? <Sun /> : <Moon />}
                {t(theme === 'dark' ? 'theme.light' : 'theme.dark')}
              </CommandItem>
              <CommandItem value={lang === 'si' ? 'English' : 'සිංහල'} onSelect={() => run(() => setLang(lang === 'si' ? 'en' : 'si'))}>
                <Languages />
                {lang === 'si' ? 'English' : 'සිංහල'}
              </CommandItem>
              <CommandItem
                value={t('sidebar.signOut')}
                onSelect={() =>
                  run(() => {
                    void signOut(false)
                      .catch((e) => toast.error(errorMessage(e)))
                      .finally(() => void navigate({ to: '/login' }))
                  })
                }
              >
                <LogOut />
                {t('sidebar.signOut')}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
