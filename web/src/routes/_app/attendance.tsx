import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export const Route = createFileRoute('/_app/attendance')({
  component: () => <ModulePlaceholder titleKey="nav.attendance" phase={2} />
})
