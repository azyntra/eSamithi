import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { I18nProvider } from '@/lib/i18n'
import { consumeHandoff } from '@/lib/api/support'
import { reportCrash } from '@/lib/errors/report'
import { initTheme } from '@/lib/theme'
import { routeTree } from './routeTree.gen'
import '@/styles/globals.css'

initTheme()

// Errors that escape every boundary — a rejected promise nobody awaited, a
// throw inside an event handler — still get filed, marked non-fatal because
// the page is still standing.
window.addEventListener('unhandledrejection', (e) => reportCrash(e.reason, `${window.location.pathname} (unhandled rejection)`, false))
window.addEventListener('error', (e) => reportCrash(e.error ?? e.message, `${window.location.pathname} (window error)`, false))

// Before the router looks at the URL: an operator support handoff arrives as a
// one-time fragment (#s=…) that must be banked and wiped, not routed on.
consumeHandoff()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 }
  }
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  basepath: import.meta.env.BASE_URL,
  defaultPreload: 'intent',
  scrollRestoration: true
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={300}>
            <RouterProvider router={router} />
          </TooltipProvider>
        </MotionConfig>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>
)
