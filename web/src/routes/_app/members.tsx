import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export const Route = createFileRoute('/_app/members')({
  component: () => <ModulePlaceholder titleKey="nav.members" phase={1} />
})
