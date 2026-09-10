import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { SETTINGS_TABS } from '@/features/settings/tabs'
import { oneOf } from '@/lib/router/search'

const tabOf = oneOf(SETTINGS_TABS)

export const Route = createFileRoute('/_app/settings')({
  validateSearch: (search: Record<string, unknown>): { tab?: (typeof SETTINGS_TABS)[number] } => ({ tab: tabOf(search.tab) }),
  component: SettingsRoute
})

function SettingsRoute() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return <SettingsPage tab={tab ?? 'general'} onTabChange={(next) => void navigate({ search: { tab: next === 'general' ? undefined : next }, replace: true })} />
}
