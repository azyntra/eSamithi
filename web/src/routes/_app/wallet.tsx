import { createFileRoute } from '@tanstack/react-router'
import { WalletPage } from '@/features/wallet/WalletPage'
import { WALLET_TABS } from '@/features/wallet/tabs'
import { oneOf } from '@/lib/router/search'

const tabOf = oneOf(WALLET_TABS)

export const Route = createFileRoute('/_app/wallet')({
  validateSearch: (search: Record<string, unknown>): { tab?: (typeof WALLET_TABS)[number] } => ({ tab: tabOf(search.tab) }),
  component: WalletRoute
})

function WalletRoute() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return <WalletPage tab={tab ?? 'liquid'} onTabChange={(next) => void navigate({ search: { tab: next === 'liquid' ? undefined : next }, replace: true })} />
}
