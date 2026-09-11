import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react'
import { useLocation } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useCommandPalette } from '@/components/useCommandPalette'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useSession } from '@/lib/api/session'
import { SupportBanner } from '@/features/support/SupportBanner'
import { cn } from '@/lib/utils'
import { BannerStack } from './BannerStack'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

// cmdk and the member index only load when the palette is first opened
const CommandPalette = lazy(() => import('@/components/CommandPalette').then((m) => ({ default: m.CommandPalette })))

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
  // An operator support session adds a fixed 36 px bar above everything, so
  // the shell and both sticky edges move down by exactly that much.
  const support = useSession().support !== null

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
    <div className={cn('flex min-h-screen bg-background', support && 'pt-9')}>
      {support && <SupportBanner />}
      <aside
        className={cn(
          'sticky hidden shrink-0 transition-[width] duration-220 ease-standard lg:block',
          support ? 'top-9 h-[calc(100vh-2.25rem)]' : 'top-0 h-screen',
          collapsed ? 'w-[72px]' : 'w-[260px]'
        )}
      >
        <Sidebar collapsed={collapsed} onToggle={toggle} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobileOpen(true)} onSearch={() => setPaletteOpen(true)} offsetTop={support} />
        <BannerStack />
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
          <motion.div key={pathname} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0, 0, 0, 1] }} className="mx-auto w-full max-w-[1400px]">
            {children}
          </motion.div>
        </main>
      </div>

      {paletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette open onOpenChange={setPaletteOpen} />
        </Suspense>
      )}
    </div>
  )
}
