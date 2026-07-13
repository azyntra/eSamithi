import { useState, useEffect } from 'react'
import { registerCache } from '../utils/cache'
import { Wallet, FixedDeposit, PhysicalAsset } from '../types'

interface UseWalletsReturn {
  wallets: Wallet[]
  fixedDeposits: FixedDeposit[]
  assets: PhysicalAsset[]
  loading: boolean
  error: string | null
  fetchData: (forceRefresh?: boolean) => Promise<void>
  createWallet: (data: any) => Promise<{ success: boolean }>
  updateWallet: (id: number, data: any) => Promise<{ success: boolean }>
  toggleWalletActive: (id: number) => Promise<{ success: boolean }>
  transferFunds: (fromId: number, toId: number, amount: number) => Promise<{ success: boolean }>
  depositToWallet: (id: number, amount: number, note: string) => Promise<{ success: boolean }>
  createFixedDeposit: (data: any) => Promise<{ success: boolean }>
  updateFixedDeposit: (id: number, data: any) => Promise<{ success: boolean }>
  withdrawFixedDeposit: (id: number) => Promise<{ success: boolean }>
  createAsset: (data: any) => Promise<{ success: boolean }>
  updateAsset: (id: number, data: any) => Promise<{ success: boolean }>
  deleteAsset: (id: number) => Promise<{ success: boolean }>
}

let walletsCache: { wallets: Wallet[]; fixedDeposits: FixedDeposit[]; assets: PhysicalAsset[] } | null = null
let walletsCacheTime = 0
const CACHE_TTL = 1000 * 60 * 5 // 5 minutes

registerCache(() => { walletsCache = null; walletsCacheTime = 0 }, 'wallets')

export function useWallets(): UseWalletsReturn {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [fixedDeposits, setFixedDeposits] = useState<FixedDeposit[]>([])
  const [assets, setAssets] = useState<PhysicalAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async (forceRefresh = false): Promise<void> => {
    if (!forceRefresh && walletsCache && Date.now() - walletsCacheTime < CACHE_TTL) {
      setWallets(walletsCache.wallets)
      setFixedDeposits(walletsCache.fixedDeposits)
      setAssets(walletsCache.assets)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const w = await window.api.wallets.getAll()
      const fd = await window.api.fixedDeposits.getAll()
      const a = await window.api.assets.getAll()
      
      walletsCache = { wallets: w, fixedDeposits: fd, assets: a }
      walletsCacheTime = Date.now()
      
      setWallets(w)
      setFixedDeposits(fd)
      setAssets(a)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const createWallet = async (data: any): Promise<{ success: boolean }> => {
    const res = await window.api.wallets.create(data)
    await fetchData(true)
    return res
  }

  const updateWallet = async (id: number, data: any): Promise<{ success: boolean }> => {
    const res = await window.api.wallets.update(id, data)
    await fetchData(true)
    return res
  }

  const toggleWalletActive = async (id: number): Promise<{ success: boolean }> => {
    const res = await window.api.wallets.toggleActive(id)
    await fetchData(true)
    return res
  }

  const transferFunds = async (fromId: number, toId: number, amount: number): Promise<{ success: boolean }> => {
    const res = await window.api.wallets.transfer(fromId, toId, amount)
    await fetchData(true)
    return res
  }

  const depositToWallet = async (id: number, amount: number, note: string): Promise<{ success: boolean }> => {
    const res = await window.api.wallets.deposit(id, amount, note)
    await fetchData(true)
    return res
  }

  const createFixedDeposit = async (data: any): Promise<{ success: boolean }> => {
    const res = await window.api.fixedDeposits.create(data)
    await fetchData(true)
    return res
  }

  const updateFixedDeposit = async (id: number, data: any): Promise<{ success: boolean }> => {
    const res = await window.api.fixedDeposits.update(id, data)
    await fetchData(true)
    return res
  }

  const withdrawFixedDeposit = async (id: number): Promise<{ success: boolean }> => {
    const res = await window.api.fixedDeposits.withdraw(id)
    await fetchData(true)
    return res
  }

  const createAsset = async (data: any): Promise<{ success: boolean }> => {
    const res = await window.api.assets.create(data)
    await fetchData(true)
    return res
  }

  const updateAsset = async (id: number, data: any): Promise<{ success: boolean }> => {
    const res = await window.api.assets.update(id, data)
    await fetchData(true)
    return res
  }

  const deleteAsset = async (id: number): Promise<{ success: boolean }> => {
    const res = await window.api.assets.delete(id)
    await fetchData(true)
    return res
  }

  return {
    wallets,
    fixedDeposits,
    assets,
    loading,
    error,
    fetchData,
    createWallet,
    updateWallet,
    toggleWalletActive,
    transferFunds,
    depositToWallet,
    createFixedDeposit,
    updateFixedDeposit,
    withdrawFixedDeposit,
    createAsset,
    updateAsset,
    deleteAsset
  }
}
