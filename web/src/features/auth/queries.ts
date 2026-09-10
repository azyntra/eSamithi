import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from './api'

export function useMe(enabled = true) {
  return useQuery({ queryKey: ['me'], queryFn: authApi.me, enabled, staleTime: 60_000 })
}
export function useSessions(enabled = true) {
  return useQuery({ queryKey: ['sessions'], queryFn: authApi.sessions, enabled, staleTime: 15_000 })
}
export function useRevokeSession() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => authApi.revokeSession(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }) })
}
export function useChangePassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { current: string; next: string }) => authApi.changePassword(v.current, v.next),
    // Changing the password ends every other session
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] })
  })
}
