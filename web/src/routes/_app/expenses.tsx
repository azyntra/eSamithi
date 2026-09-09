import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export const Route = createFileRoute('/_app/expenses')({
  component: () => <ModulePlaceholder titleKey="nav.expenses" phase={1} />
})
