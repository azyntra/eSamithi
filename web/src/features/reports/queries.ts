import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/queryKeys'
import { reportsApi } from './api'

// Reports are always read fresh: officers print them as the record of a moment
export function useMonthlyReport(year: number, month: number, enabled: boolean) {
  return useQuery({ queryKey: qk.reports('monthly', { year, month }), queryFn: () => reportsApi.monthly(year, month), enabled, staleTime: 0 })
}
export function useAnnualReport(year: number, enabled: boolean) {
  return useQuery({ queryKey: qk.reports('annual', { year }), queryFn: () => reportsApi.annual(year), enabled, staleTime: 0 })
}
export function useArrearsReport(enabled: boolean) {
  return useQuery({ queryKey: qk.reports('arrears', {}), queryFn: reportsApi.arrears, enabled, staleTime: 0 })
}
