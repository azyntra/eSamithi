import { useCallback, useState, type ReactNode } from 'react'
import { useLocation } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { CommandPalette, useCommandPalette } from '@/components/CommandPalette'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { BannerStack } from './BannerStack'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

const COLLAPSE_KEY = 'esamithi-sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true'
  } catch {
    return false
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useCommandPalette()
  const { pathname } = useLocation()

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, String(!c))
      } catch {
        /* ignore */
      }
      return !c
    })
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={cn('sticky top-0 hidden h-screen shrink-0 transition-[width] duration-220 ease-standard lg:block', collapsed ? 'w-[72px]' : 'w-[260px]')}>
        <Sidebar collapsed={collapsed} onToggle={toggle} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobileOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <BannerStack />
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
          <motion.div key={pathname} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0, 0, 0, 1] }} className="mx-auto w-full max-w-[1400px]">
            {children}
          </motion.div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
