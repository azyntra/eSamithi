import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export const Route = createFileRoute('/_app/reports')({
  component: () => <ModulePlaceholder titleKey="nav.reports" phase={2} />
})
