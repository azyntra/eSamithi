import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/queryKeys'
import { messagesApi } from './api'
import type { AnnouncementPayload, PurukaFilters, RequestStatus } from './types'

export function useAnnouncements() {
  return useQuery({ queryKey: qk.announcements, queryFn: messagesApi.announcements, staleTime: 30_000 })
}

function useAnnouncementMutation<TVars>(fn: (v: TVars) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: qk.announcements }) })
}

export function useCreateAnnouncement() {
  return useAnnouncementMutation((p: AnnouncementPayload) => messagesApi.create(p))
}
export function useUpdateAnnouncement() {
  return useAnnouncementMutation(({ id, payload }: { id: number; payload: AnnouncementPayload }) => messagesApi.update(id, payload))
}
export function useToggleAnnouncement() {
  return useAnnouncementMutation((id: number) => messagesApi.toggle(id))
}
export function useDeleteAnnouncement() {
  return useAnnouncementMutation((id: number) => messagesApi.remove(id))
}

// Pending is the working queue; the filter is part of the key so switching
// back to it is instant.
export function useMemberRequests(status?: string) {
  return useQuery({ queryKey: qk.memberRequests(status), queryFn: () => messagesApi.requests(status), staleTime: 15_000 })
}

export function useReviewRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, staff_note }: { id: number; status: RequestStatus; staff_note?: string }) => messagesApi.review(id, { status, staff_note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.memberRequests() })
  })
}

export function usePurukaPosts(filters: PurukaFilters) {
  return useQuery({ queryKey: qk.purukaPosts(filters), queryFn: () => messagesApi.posts(filters), staleTime: 15_000 })
}

export function usePurukaCategories() {
  return useQuery({ queryKey: qk.purukaCategories, queryFn: messagesApi.categories, staleTime: 5 * 60_000 })
}

function usePurukaMutation<TVars>(fn: (v: TVars) => Promise<unknown>, alsoCategories = false) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([qc.invalidateQueries({ queryKey: qk.purukaPosts() }), ...(alsoCategories ? [qc.invalidateQueries({ queryKey: qk.purukaCategories })] : [])])
  })
}

export function useTakeDownPost() {
  return usePurukaMutation((id: number) => messagesApi.takeDown(id))
}
export function useRestorePost() {
  return usePurukaMutation((id: number) => messagesApi.restore(id))
}
export function useCreateCategory() {
  return usePurukaMutation((b: { code: string; label_en: string; label_si: string }) => messagesApi.createCategory(b), true)
}
export function useUpdateCategory() {
  return usePurukaMutation(({ id, ...b }: { id: number; label_en?: string; label_si?: string; is_active?: boolean }) => messagesApi.updateCategory(id, b), true)
}
