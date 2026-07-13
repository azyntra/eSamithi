import { useState, useEffect } from 'react'
import { registerCache } from '../utils/cache'
import type { Loan } from '../types'

interface UseLoansReturn {
  loans: Loan[]
  loading: boolean
  error: string | null
  fetchData: (forceRefresh?: boolean) => Promise<void>
  issueLoan: (data: any) => Promise<{ success: boolean; id: number }>
}

let loansCache: Loan[] | null = null
let loansCacheTime = 0
const CACHE_TTL = 1000 * 60 * 5 // 5 minutes

registerCache(() => { loansCache = null; loansCacheTime = 0 })

export function useLoans(): UseLoansReturn {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async (forceRefresh = false): Promise<void> => {
    if (!forceRefresh && loansCache && Date.now() - loansCacheTime < CACHE_TTL) {
      setLoans(loansCache)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await window.api.loans.getAll()
      loansCache = data
      loansCacheTime = Date.now()
      setLoans(data)
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

  const issueLoan = async (data: any): Promise<{ success: boolean; id: number }> => {
    const res = await window.api.loans.issue(data)
    await fetchData(true)
    return res
  }

  return {
    loans,
    loading,
    error,
    fetchData,
    issueLoan
  }
}
