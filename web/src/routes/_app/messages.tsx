import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export const Route = createFileRoute('/_app/messages')({
  component: () => <ModulePlaceholder titleKey="nav.messages" phase={2} />
})
