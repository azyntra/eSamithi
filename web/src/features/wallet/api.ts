import { api } from '@/lib/api/client'

export interface Wallet {
  id: number
  name: string
  wallet_type: 'Cash' | 'Bank'
  balance: number
  is_active: number
  created_at: string
}
export interface FixedDeposit {
  id: number
  fd_number: string
  bank_name: string
  principal: number
  interest_rate: number
  term_months: number
  start_date: string
  maturity_date: string
  status: 'Active' | 'Matured' | 'Withdrawn'
  notes: string | null
  linked_wallet_id: number | null
  linked_wallet_name?: string | null
}
export interface PhysicalAsset {
  id: number
  name: string
  quantity: number
  description: string | null
  is_active: number
  created_at: string
}

export interface WalletPayload {
  name: string
  wallet_type: 'Cash' | 'Bank'
  opening_balance: number
}
export interface FixedDepositPayload {
  fd_number: string
  bank_name: string
  principal: number
  interest_rate: number
  term_months: number
  start_date: string
  maturity_date: string
  notes: string
  linked_wallet_id: number | null
  fund_from_wallet: boolean
}
export interface AssetPayload {
  name: string
  quantity: number
  description: string
}

export const walletApi = {
  wallets: () => api.get<Wallet[]>('/wallets'),
  createWallet: (p: WalletPayload) => api.post<{ success: boolean; id: number }>('/wallets', p),
  updateWallet: (id: number, p: Pick<WalletPayload, 'name' | 'wallet_type'>) => api.put<{ success: boolean }>(`/wallets/${id}`, p),
  toggleWallet: (id: number) => api.patch<{ success: boolean }>(`/wallets/${id}/toggle`),
  transfer: (fromId: number, toId: number, amount: number) => api.post<{ success: boolean }>('/wallets/transfer', { fromId, toId, amount }),
  deposit: (id: number, amount: number, note: string) => api.post<{ success: boolean }>(`/wallets/${id}/deposit`, { amount, note }),
  deleteWallet: (id: number) => api.delete<{ success: boolean }>(`/wallets/${id}`),

  fixedDeposits: () => api.get<FixedDeposit[]>('/fixed-deposits'),
  createFixedDeposit: (p: FixedDepositPayload) => api.post<{ success: boolean; id: number }>('/fixed-deposits', p),
  withdrawFixedDeposit: (id: number) => api.patch<{ success: boolean }>(`/fixed-deposits/${id}/withdraw`),
  deleteFixedDeposit: (id: number) => api.delete<{ success: boolean }>(`/fixed-deposits/${id}`),

  assets: () => api.get<PhysicalAsset[]>('/assets'),
  createAsset: (p: AssetPayload) => api.post<{ success: boolean; id: number }>('/assets', p),
  updateAsset: (id: number, p: AssetPayload) => api.put<{ success: boolean }>(`/assets/${id}`, p),
  deleteAsset: (id: number) => api.delete<{ success: boolean }>(`/assets/${id}`)
}
