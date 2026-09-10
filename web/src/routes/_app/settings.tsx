import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SETTINGS_TABS, SettingsPage } from '@/features/settings/SettingsPage'

const searchSchema = z.object({ tab: z.enum(SETTINGS_TABS).optional().catch(undefined) })

export const Route = createFileRoute('/_app/settings')({
  validateSearch: (search) => searchSchema.parse(search),
  component: SettingsRoute
})

function SettingsRoute() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return <SettingsPage tab={tab ?? 'general'} onTabChange={(next) => void navigate({ search: { tab: next === 'general' ? undefined : next }, replace: true })} />
}
