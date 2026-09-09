import { ArrowDownToLine, ArrowUpFromLine, BarChart3, ClipboardCheck, HandCoins, Landmark, LayoutDashboard, Megaphone, Settings, Users, type LucideIcon } from 'lucide-react'
import type { TranslationKey } from '@/lib/i18n'

export interface NavItem {
  to: '/dashboard' | '/incomes' | '/expenses' | '/loans' | '/wallet' | '/members' | '/attendance' | '/messages' | '/reports' | '/settings'
  key: TranslationKey
  icon: LucideIcon
}
export interface NavGroup {
  key: TranslationKey
  items: NavItem[]
}

// Sidebar groups (requirements §4.7): Money · People · Society · System
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'nav.groupMoney',
    items: [
      { to: '/dashboard', key: 'nav.dashboard', icon: LayoutDashboard },
      { to: '/incomes', key: 'nav.incomes', icon: ArrowDownToLine },
      { to: '/expenses', key: 'nav.expenses', icon: ArrowUpFromLine },
      { to: '/loans', key: 'nav.loans', icon: HandCoins },
      { to: '/wallet', key: 'nav.wallet', icon: Landmark }
    ]
  },
  {
    key: 'nav.groupPeople',
    items: [
      { to: '/members', key: 'nav.members', icon: Users },
      { to: '/attendance', key: 'nav.attendance', icon: ClipboardCheck }
    ]
  },
  {
    key: 'nav.groupSociety',
    items: [
      { to: '/messages', key: 'nav.messages', icon: Megaphone },
      { to: '/reports', key: 'nav.reports', icon: BarChart3 }
    ]
  },
  { key: 'nav.groupSystem', items: [{ to: '/settings', key: 'nav.settings', icon: Settings }] }
]
