import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/queryKeys'
import { membersApi, type MembersListParams } from './api'
import type { MemberPayload } from './types'

export function useMembersList(params: MembersListParams) {
  return useQuery({
    queryKey: qk.members({ search: params.search ?? '', page: params.page ?? 1, limit: params.limit ?? 15 }),
    queryFn: () => membersApi.list(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000
  })
}

export function useMember(id: number, enabled = true) {
  return useQuery({ queryKey: qk.member(id), queryFn: () => membersApi.get(id), enabled: enabled && Number.isFinite(id) && id > 0, staleTime: 60_000 })
}

export function useMemberStatement(id: number, enabled: boolean) {
  return useQuery({ queryKey: qk.memberStatement(id), queryFn: () => membersApi.statement(id), enabled, staleTime: 0 })
}

export function useMembersSlim(enabled = true) {
  return useQuery({ queryKey: qk.membersSlim, queryFn: membersApi.slim, enabled, staleTime: 5 * 60_000 })
}

function useInvalidateMembers() {
  const qc = useQueryClient()
  return async (id?: number) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.members() }),
      qc.invalidateQueries({ queryKey: qk.membersSlim }),
      qc.invalidateQueries({ queryKey: qk.dashboard }),
      ...(id ? [qc.invalidateQueries({ queryKey: qk.member(id) }), qc.invalidateQueries({ queryKey: qk.memberStatement(id) })] : [])
    ])
  }
}

export function useCreateMember() {
  const invalidate = useInvalidateMembers()
  return useMutation({ mutationFn: (payload: MemberPayload) => membersApi.create(payload), onSuccess: () => invalidate() })
}

export function useUpdateMember(id: number) {
  const invalidate = useInvalidateMembers()
  return useMutation({ mutationFn: (payload: MemberPayload) => membersApi.update(id, payload), onSuccess: () => invalidate(id) })
}

export function useDeleteMember() {
  const qc = useQueryClient()
  const invalidate = useInvalidateMembers()
  return useMutation({
    mutationFn: (id: number) => membersApi.remove(id),
    onSuccess: async (_r, id) => {
      qc.removeQueries({ queryKey: qk.member(id) })
      await invalidate()
    }
  })
}

export function useSetAppAccess(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { app_enabled?: 0 | 1; reset_pin?: boolean }) => membersApi.setAppAccess(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.member(id) })
  })
}
