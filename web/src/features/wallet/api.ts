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
}
export interface PhysicalAsset {
  id: number
  name: string
  quantity: number
  description: string | null
  is_active: number
  created_at: string
}

export const walletApi = {
  wallets: () => api.get<Wallet[]>('/wallets'),
  fixedDeposits: () => api.get<FixedDeposit[]>('/fixed-deposits'),
  assets: () => api.get<PhysicalAsset[]>('/assets')
}
