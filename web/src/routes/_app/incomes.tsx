import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export const Route = createFileRoute('/_app/incomes')({
  component: () => <ModulePlaceholder titleKey="nav.incomes" phase={1} />
})
