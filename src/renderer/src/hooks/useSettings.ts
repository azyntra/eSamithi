import { useState, useEffect } from 'react'
import { registerCache } from '../utils/cache'
import type { IncomeType, ExpenseType } from '../types'

interface UseSettingsReturn {
  settings: Record<string, string>
  incomeTypes: IncomeType[]
  expenseTypes: ExpenseType[]
  loading: boolean
  error: string | null
  fetchData: (forceRefresh?: boolean) => Promise<void>
  updateSettings: (updates: Record<string, string>) => Promise<{ success: boolean }>
  createIncomeType: (data: any) => Promise<{ success: boolean }>
  updateIncomeType: (id: number, data: any) => Promise<{ success: boolean }>
  deleteIncomeType: (id: number) => Promise<{ success: boolean }>
  createExpenseType: (data: any) => Promise<{ success: boolean }>
  updateExpenseType: (id: number, data: any) => Promise<{ success: boolean }>
  deleteExpenseType: (id: number) => Promise<{ success: boolean }>
}

let settingsCache: { settings: Record<string, string>; incomeTypes: IncomeType[]; expenseTypes: ExpenseType[] } | null = null
let settingsCacheTime = 0
const CACHE_TTL = 1000 * 60 * 5 // 5 minutes

registerCache(() => {
  settingsCache = null
  settingsCacheTime = 0
})

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [incomeTypes, setIncomeTypes] = useState<IncomeType[]>([])
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async (forceRefresh = false): Promise<void> => {
    if (!forceRefresh && settingsCache && Date.now() - settingsCacheTime < CACHE_TTL) {
      setSettings(settingsCache.settings)
      setIncomeTypes(settingsCache.incomeTypes)
      setExpenseTypes(settingsCache.expenseTypes)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const s = await window.api.settings.getAll()
      const i = await window.api.incomeTypes.getAll()
      const e = await window.api.expenseTypes.getAll()
      
      settingsCache = { settings: s, incomeTypes: i, expenseTypes: e }
      settingsCacheTime = Date.now()
      
      setSettings(s)
      setIncomeTypes(i)
      setExpenseTypes(e)
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

  const updateSettings = async (updates: Record<string, string>): Promise<{ success: boolean }> => {
    const res = await window.api.settings.updateBulk(updates)
    await fetchData(true)
    return res
  }

  const createIncomeType = async (data: any): Promise<{ success: boolean }> => {
    const res = await window.api.incomeTypes.create(data)
    await fetchData(true)
    return res
  }

  const updateIncomeType = async (id: number, data: any): Promise<{ success: boolean }> => {
    const res = await window.api.incomeTypes.update(id, data)
    await fetchData(true)
    return res
  }

  const deleteIncomeType = async (id: number): Promise<{ success: boolean }> => {
    const res = await window.api.incomeTypes.delete(id)
    await fetchData(true)
    return res
  }

  const createExpenseType = async (data: any): Promise<{ success: boolean }> => {
    const res = await window.api.expenseTypes.create(data)
    await fetchData(true)
    return res
  }

  const updateExpenseType = async (id: number, data: any): Promise<{ success: boolean }> => {
    const res = await window.api.expenseTypes.update(id, data)
    await fetchData(true)
    return res
  }

  const deleteExpenseType = async (id: number): Promise<{ success: boolean }> => {
    const res = await window.api.expenseTypes.delete(id)
    await fetchData(true)
    return res
  }

  return {
    settings,
    incomeTypes,
    expenseTypes,
    loading,
    error,
    fetchData,
    updateSettings,
    createIncomeType,
    updateIncomeType,
    deleteIncomeType,
    createExpenseType,
    updateExpenseType,
    deleteExpenseType
  }
}
