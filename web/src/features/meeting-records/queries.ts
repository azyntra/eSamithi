import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/queryKeys'
import { meetingRecordsApi, type BrowseFilters } from './api'
import type { DraftView } from './types'

// Signed file links last 30 minutes; refetching after 10 keeps them fresh
const LINK_STALE = 10 * 60_000

export function useMeetingRecords(filters: BrowseFilters) {
  return useQuery({ queryKey: qk.meetingRecords(filters), queryFn: () => meetingRecordsApi.browse(filters), staleTime: 30_000 })
}

export function useMeetingRecord(id: number | null, versionNo?: number) {
  return useQuery({
    queryKey: qk.meetingRecord(id ?? 0, versionNo),
    queryFn: () => meetingRecordsApi.report(id as number, versionNo),
    enabled: id !== null,
    staleTime: LINK_STALE,
    retry: false
  })
}

export function useMinutesComments(id: number | null) {
  return useQuery({ queryKey: qk.meetingComments(id ?? 0), queryFn: () => meetingRecordsApi.comments(id as number), enabled: id !== null, staleTime: 15_000 })
}

export function useDraft(id: number | null) {
  return useQuery({ queryKey: qk.meetingDraft(id ?? 0), queryFn: () => meetingRecordsApi.draft(id as number), enabled: id !== null, staleTime: LINK_STALE, retry: false })
}

// Everything under meeting-records is refreshed after a change
export function useInvalidateRecords() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: qk.meetingRecordsRoot })
}

// Draft mutations answer with the whole draft: put it straight in the cache
export function useSetDraft() {
  const qc = useQueryClient()
  return (draft: DraftView) => qc.setQueryData(qk.meetingDraft(draft.report_id), draft)
}

export function useCommentAction() {
  const invalidate = useInvalidateRecords()
  return useMutation({ mutationFn: (run: () => Promise<unknown>) => run(), onSuccess: () => invalidate() })
}
