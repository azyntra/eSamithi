import { useState, useEffect, useCallback, useRef } from 'react'

export interface LedgerFilters {
  page: number
  limit: number
  from: string
  to: string
  search: string
  type_id: number | ''
}

export interface UseLedgerReturn<T> {
  transactions: T[]
  total: number
  activeTotal: number
  loading: boolean
  error: string | null
  filters: LedgerFilters
  setFilters: (update: Partial<LedgerFilters>) => void
  refresh: () => Promise<void>
  fetchAllForExport: () => Promise<T[]>
}

export const PAGE_SIZE_OPTIONS = [25, 50, 100]

export const EMPTY_FILTERS: LedgerFilters = { page: 1, limit: 25, from: '', to: '', search: '', type_id: '' }

// Shared server-side-paginated ledger hook for the Income and Expense pages.
// `api` is window.api.income or window.api.expenses.
export function useLedger<T>(api: {
  getAll: (params?: any) => Promise<{ transactions: T[]; total: number; active_total: number }>
}): UseLedgerReturn<T> {
  const [transactions, setTransactions] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [activeTotal, setActiveTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<LedgerFilters>({ ...EMPTY_FILTERS })
  const requestSeq = useRef(0)

  const buildParams = useCallback((f: LedgerFilters, paginated: boolean) => {
    const params: Record<string, string | number> = {}
    if (paginated) {
      params.page = f.page
      params.limit = f.limit
    }
    if (f.from) params.from = f.from
    if (f.to) params.to = f.to
    if (f.search.trim()) params.search = f.search.trim()
    if (f.type_id !== '') params.type_id = f.type_id
    return params
  }, [])

  const fetchData = useCallback(async (f: LedgerFilters): Promise<void> => {
    const seq = ++requestSeq.current
    setLoading(true)
    try {
      const result = await api.getAll(buildParams(f, true))
      if (seq !== requestSeq.current) return // a newer request superseded this one
      setTransactions(result.transactions)
      setTotal(result.total)
      setActiveTotal(result.active_total)
      setError(null)
    } catch (err: any) {
      if (seq === requestSeq.current) setError(err.message)
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [api, buildParams])

  // Debounce typing in search; date/page changes apply immediately
  useEffect(() => {
    const timer = setTimeout(() => fetchData(filters), filters.search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [filters, fetchData])

  const setFilters = (update: Partial<LedgerFilters>): void => {
    setFiltersState((prev) => ({
      ...prev,
      ...update,
      // any filter change other than page jumps back to page 1
      page: update.page !== undefined ? update.page : 1
    }))
  }

  const refresh = async (): Promise<void> => fetchData(filters)

  const fetchAllForExport = async (): Promise<T[]> => {
    const result = await api.getAll(buildParams(filters, false))
    return result.transactions
  }

  return { transactions, total, activeTotal, loading, error, filters, setFilters, refresh, fetchAllForExport }
}
