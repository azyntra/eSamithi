import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { WALLET_TABS, WalletPage } from '@/features/wallet/WalletPage'

const searchSchema = z.object({ tab: z.enum(WALLET_TABS).optional().catch(undefined) })

export const Route = createFileRoute('/_app/wallet')({
  validateSearch: (search) => searchSchema.parse(search),
  component: WalletRoute
})

function WalletRoute() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return <WalletPage tab={tab ?? 'liquid'} onTabChange={(next) => void navigate({ search: { tab: next === 'liquid' ? undefined : next }, replace: true })} />
}
