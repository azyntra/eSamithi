import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/queryKeys'
import { walletApi } from './api'

export function useWallets() {
  return useQuery({ queryKey: qk.wallets, queryFn: walletApi.wallets, staleTime: 60_000 })
}
export function useFixedDeposits() {
  return useQuery({ queryKey: qk.fds, queryFn: walletApi.fixedDeposits, staleTime: 60_000 })
}
export function useAssets() {
  return useQuery({ queryKey: qk.assets, queryFn: walletApi.assets, staleTime: 5 * 60_000 })
}
