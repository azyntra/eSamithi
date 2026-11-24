import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { api, photoUrl } from './client'

// Meeting minutes in the member app (docs/MEETING-MINUTES-REQUIREMENTS.md
// §7.1–§7.2, §8.1–§8.2). File links from the server are signed, relative and
// valid for 30 minutes; absolute() makes them loadable from the phone.

const BASE = '/me/meeting-records'

export interface MinutesRow {
  id: number
  title: string
  meeting_date: string
  version_no: number | null
  published_at: string | null
  page_count: number
  audio_ms: number | null
  has_audio: boolean
  comment_count: number
  open_comment_count: number
}

export interface MinutesPage {
  id: number
  n: number
  url: string
  thumb_url: string
  width: number
  height: number
}

export interface MinutesVersionSummary {
  version_no: number | null
  state: 'draft' | 'published' | 'withdrawn'
  published_at: string | null
  author_name: string | null
  author_position: 'secretary' | 'office' | null
  change_summary: string | null
}

export interface MinutesVersion extends MinutesVersionSummary {
  title: string
  meeting_date: string
  page_count: number
  pages: MinutesPage[]
  pdf_url: string | null
  pdf_bytes: number | null
  audio_url: string | null
  audio_ms: number | null
}

export interface MinutesReport {
  report: { id: number; latest_version_no: number | null; has_draft: boolean }
  version: MinutesVersion
  versions: MinutesVersionSummary[]
  can: { publish: boolean; moderate: boolean; withdraw: boolean }
}

export interface MinutesDraft extends Omit<MinutesVersion, 'pages'> {
  report_id: number
  is_revision: boolean
  next_version_no: number
  pages: Array<MinutesPage & { rotation: number; client_ref: string }>
  pdf_stale: boolean
  audio_uploads: Array<{ id: string; total_bytes: number; received_bytes: number }>
  max_pages: number
}

export interface MinutesComment {
  id: number
  parent_id: number | null
  author_name: string | null
  is_secretary: boolean
  is_office: boolean
  is_mine: boolean
  body: string | null
  version_no: number
  status: 'open' | 'addressed'
  addressed_in_version_no: number | null
  created_at: string
  hidden: boolean
  deleted: boolean
}

export interface SecretaryHub {
  drafts: Array<{ report_id: number; title: string; meeting_date: string; page_count: number; audio_ms: number | null; updated_at: string; is_revision: boolean }>
  published: MinutesRow[]
  open_comments: number
}

export const absolute = (path: string | null | undefined): string | null => (path ? photoUrl(path) : null)

// A stable code from the server, for choosing what to tell the member
export function errorCode(err: unknown): string | null {
  if (axios.isAxiosError(err)) return ((err.response?.data as { code?: string } | undefined)?.code) ?? null
  return null
}

export const minutesKeys = {
  all: ['me', 'minutes'] as const,
  list: (year?: number) => ['me', 'minutes', 'list', year ?? 'all'] as const,
  report: (id: number, v?: number) => ['me', 'minutes', 'report', id, v ?? 'latest'] as const,
  comments: (id: number) => ['me', 'minutes', 'comments', id] as const,
  hub: ['me', 'minutes', 'hub'] as const,
  draft: (id: number) => ['me', 'minutes', 'draft', id] as const
}

// Signed links last 30 minutes; reading screens refetch well before that
const LINK_STALE = 10 * 60 * 1000

export function useMinutesList(year?: number) {
  return useQuery({
    queryKey: minutesKeys.list(year),
    queryFn: async () => (await api.get<{ years: number[]; items: MinutesRow[] }>(BASE, { params: { year } })).data,
    staleTime: 60 * 1000
  })
}

export function useMinutesReport(id: number, versionNo?: number) {
  return useQuery({
    queryKey: minutesKeys.report(id, versionNo),
    queryFn: async () => (await api.get<MinutesReport>(versionNo ? `${BASE}/${id}/versions/${versionNo}` : `${BASE}/${id}`)).data,
    enabled: Number.isFinite(id),
    staleTime: LINK_STALE,
    retry: (count, err) => count < 1 && errorCode(err) === null
  })
}

export function useMinutesComments(id: number) {
  return useQuery({
    queryKey: minutesKeys.comments(id),
    queryFn: async () => (await api.get<{ items: MinutesComment[] }>(`${BASE}/${id}/comments`)).data.items,
    enabled: Number.isFinite(id),
    staleTime: 30 * 1000
  })
}

export function useSecretaryHub(enabled: boolean) {
  return useQuery({
    queryKey: minutesKeys.hub,
    queryFn: async () => (await api.get<SecretaryHub>(`${BASE}/secretary`)).data,
    enabled,
    staleTime: 30 * 1000
  })
}

export function useMinutesDraft(id: number) {
  return useQuery({
    queryKey: minutesKeys.draft(id),
    queryFn: async () => (await api.get<MinutesDraft>(`${BASE}/${id}/draft`)).data,
    enabled: Number.isFinite(id),
    staleTime: LINK_STALE,
    retry: false
  })
}

export function useRefreshMinutes(): () => Promise<void> {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: minutesKeys.all })
}

export function putDraft(qc: QueryClient, draft: MinutesDraft): void {
  qc.setQueryData(minutesKeys.draft(draft.report_id), draft)
}

// ── Actions ─────────────────────────────────────────────────

export const minutesApi = {
  create: async (p: { client_ref: string; title: string; meeting_date: string }) => (await api.post<MinutesDraft>(BASE, p)).data,
  startRevision: async (id: number) => (await api.post<MinutesDraft>(`${BASE}/${id}/revision`)).data,
  updateDraft: async (id: number, p: { title?: string; meeting_date?: string; change_summary?: string | null }) => (await api.patch<MinutesDraft>(`${BASE}/${id}/draft`, p)).data,
  discard: async (id: number) => (await api.delete(`${BASE}/${id}/draft`)).data,

  // One page per request with its own client_ref: a retry never adds it twice
  addPage: async (id: number, p: { uri: string; clientRef: string; replacePageId?: number }) => {
    const form = new FormData()
    form.append('client_ref', p.clientRef)
    if (p.replacePageId) form.append('replace_page_id', String(p.replacePageId))
    form.append('photo', { uri: p.uri, name: 'page.jpg', type: 'image/jpeg' } as unknown as Blob)
    return (await api.post<MinutesDraft>(`${BASE}/${id}/draft/pages`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90000 })).data
  },
  reorder: async (id: number, pageIds: number[]) => (await api.put<MinutesDraft>(`${BASE}/${id}/draft/pages/order`, { page_ids: pageIds })).data,
  rotate: async (id: number, pageId: number) => (await api.patch<MinutesDraft>(`${BASE}/${id}/draft/pages/${pageId}`, { rotate: 90 }, { timeout: 60000 })).data,
  removePage: async (id: number, pageId: number) => (await api.delete<MinutesDraft>(`${BASE}/${id}/draft/pages/${pageId}`)).data,
  removeAudio: async (id: number) => (await api.delete<MinutesDraft>(`${BASE}/${id}/draft/audio`)).data,
  previewPdf: async (id: number) => (await api.post<{ pdf_url: string; pdf_bytes: number; page_count: number }>(`${BASE}/${id}/draft/pdf`, undefined, { timeout: 90000 })).data,
  publish: async (id: number, p: { publish_ref: string; change_summary?: string; notify?: boolean }) =>
    (await api.post<{ already: boolean; report_id: number; version_no: number; notified: boolean }>(`${BASE}/${id}/draft/publish`, p, { timeout: 90000 })).data,

  comment: async (id: number, p: { client_ref: string; body: string; version_no?: number; parent_id?: number }) => (await api.post<{ id: number }>(`${BASE}/${id}/comments`, p)).data,
  reply: async (commentId: number, body: string, clientRef: string) => (await api.post<{ id: number }>(`${BASE}/comments/${commentId}/reply`, { body, client_ref: clientRef })).data,
  addressed: async (commentId: number, versionNo: number) => (await api.post(`${BASE}/comments/${commentId}/addressed`, { version_no: versionNo })).data,
  reopen: async (commentId: number) => (await api.post(`${BASE}/comments/${commentId}/addressed`, { status: 'open' })).data,
  hide: async (commentId: number, reason: string) => (await api.post(`${BASE}/comments/${commentId}/hide`, { reason })).data,
  removeOwn: async (commentId: number) => (await api.delete(`${BASE}/comments/${commentId}`)).data,
  report: async (commentId: number) => (await api.post(`${BASE}/comments/${commentId}/report`)).data
}

// ── Comment text: page and time mentions become tappable (§8.1.4) ─────────

export type CommentPart = { kind: 'text'; text: string } | { kind: 'page'; text: string; page: number } | { kind: 'time'; text: string; ms: number }

const MENTION = /(\b(?:page|p\.)\s?(\d{1,3})\b|පිටුව\s?(\d{1,3})|\b(\d{1,2}):([0-5]\d)(?::([0-5]\d))?\b)/giu

export function commentParts(body: string, pageCount: number): CommentPart[] {
  const parts: CommentPart[] = []
  let last = 0
  for (const m of body.matchAll(MENTION)) {
    const at = m.index ?? 0
    const pageNo = Number(m[2] ?? m[3])
    let part: CommentPart | null = null
    if (Number.isFinite(pageNo) && pageNo >= 1 && pageNo <= pageCount) part = { kind: 'page', text: m[0], page: pageNo }
    else if (m[4] !== undefined) {
      const ms = m[6] !== undefined
        ? (Number(m[4]) * 3600 + Number(m[5]) * 60 + Number(m[6])) * 1000
        : (Number(m[4]) * 60 + Number(m[5])) * 1000
      part = { kind: 'time', text: m[0], ms }
    }
    if (!part) continue
    if (at > last) parts.push({ kind: 'text', text: body.slice(last, at) })
    parts.push(part)
    last = at + m[0].length
  }
  if (last < body.length) parts.push({ kind: 'text', text: body.slice(last) })
  return parts
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return ''
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
