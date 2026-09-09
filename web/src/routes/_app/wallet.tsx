import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export const Route = createFileRoute('/_app/wallet')({
  component: () => <ModulePlaceholder titleKey="nav.wallet" phase={1} />
})
