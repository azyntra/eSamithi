import type { ReactElement, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n'

// Components read translations from the provider and their data from the query
// client, so a bare render() would either throw or silently show keys. One
// wrapper keeps every component test honest about both.
export function renderWithApp(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>{children}</I18nProvider>
    </QueryClientProvider>
  )
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) }
}
