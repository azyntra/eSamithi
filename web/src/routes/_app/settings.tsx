import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export const Route = createFileRoute('/_app/settings')({
  component: () => <ModulePlaceholder titleKey="nav.settings" phase={2} />
})
