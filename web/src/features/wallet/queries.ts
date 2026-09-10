import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/queryKeys'
import { walletApi, type AssetPayload, type FixedDepositPayload, type WalletPayload } from './api'

export function useWallets() {
  return useQuery({ queryKey: qk.wallets, queryFn: walletApi.wallets, staleTime: 60_000 })
}
export function useFixedDeposits() {
  return useQuery({ queryKey: qk.fds, queryFn: walletApi.fixedDeposits, staleTime: 60_000 })
}
export function useAssets() {
  return useQuery({ queryKey: qk.assets, queryFn: walletApi.assets, staleTime: 5 * 60_000 })
}

// Any hub mutation can move society totals: wallets, FDs, assets + dashboard
function useInvalidateHub() {
  const qc = useQueryClient()
  return () => Promise.all([qc.invalidateQueries({ queryKey: qk.wallets }), qc.invalidateQueries({ queryKey: qk.fds }), qc.invalidateQueries({ queryKey: qk.assets }), qc.invalidateQueries({ queryKey: qk.dashboard })])
}

export function useCreateWallet() {
  const inv = useInvalidateHub()
  return useMutation({ mutationFn: (p: WalletPayload) => walletApi.createWallet(p), onSuccess: () => inv() })
}
export function useToggleWallet() {
  const inv = useInvalidateHub()
  return useMutation({ mutationFn: (id: number) => walletApi.toggleWallet(id), onSuccess: () => inv() })
}
export function useTransfer() {
  const inv = useInvalidateHub()
  return useMutation({ mutationFn: (v: { fromId: number; toId: number; amount: number }) => walletApi.transfer(v.fromId, v.toId, v.amount), onSuccess: () => inv() })
}
export function useDeposit() {
  const inv = useInvalidateHub()
  return useMutation({ mutationFn: (v: { id: number; amount: number; note: string }) => walletApi.deposit(v.id, v.amount, v.note), onSuccess: () => inv() })
}
export function useDeleteWallet() {
  const inv = useInvalidateHub()
  return useMutation({ mutationFn: (id: number) => walletApi.deleteWallet(id), onSuccess: () => inv() })
}
export function useCreateFixedDeposit() {
  const inv = useInvalidateHub()
  return useMutation({ mutationFn: (p: FixedDepositPayload) => walletApi.createFixedDeposit(p), onSuccess: () => inv() })
}
export function useWithdrawFixedDeposit() {
  const inv = useInvalidateHub()
  return useMutation({ mutationFn: (id: number) => walletApi.withdrawFixedDeposit(id), onSuccess: () => inv() })
}
export function useSaveAsset() {
  const inv = useInvalidateHub()
  return useMutation({ mutationFn: (v: { id?: number; payload: AssetPayload }) => (v.id ? walletApi.updateAsset(v.id, v.payload) : walletApi.createAsset(v.payload)), onSuccess: () => inv() })
}
export function useDeleteAsset() {
  const inv = useInvalidateHub()
  return useMutation({ mutationFn: (id: number) => walletApi.deleteAsset(id), onSuccess: () => inv() })
}
