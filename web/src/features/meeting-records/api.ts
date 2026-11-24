import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import { apiFetch } from '@/lib/api/session'
import type { BrowseResult, DraftView, MinutesComment, PublishResult, RecordStatus, ReportResult } from './types'

const base = '/meeting-records'

export interface BrowseFilters {
  year?: number
  month?: number
  status?: RecordStatus
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text()
  const body = text ? (JSON.parse(text) as unknown) : null
  if (!res.ok) {
    const err = (body as { error?: string; code?: string } | null) ?? {}
    throw new ApiError(res.status, err.error || `Request failed (${res.status})`, body, err.code ?? null)
  }
  return body as T
}

export const meetingRecordsApi = {
  browse: (f: BrowseFilters) => api.get<BrowseResult>(base, { year: f.year, month: f.month, status: f.status }),
  report: (id: number, versionNo?: number) => api.get<ReportResult>(versionNo ? `${base}/${id}/versions/${versionNo}` : `${base}/${id}`),
  comments: (id: number) => api.get<{ items: MinutesComment[] }>(`${base}/${id}/comments`),

  create: (p: { client_ref: string; title: string; meeting_date: string }) => api.post<DraftView>(base, p),
  startRevision: (id: number) => api.post<DraftView>(`${base}/${id}/revision`),
  draft: (id: number) => api.get<DraftView>(`${base}/${id}/draft`),
  updateDraft: (id: number, p: { title?: string; meeting_date?: string; change_summary?: string | null }) => api.patch<DraftView>(`${base}/${id}/draft`, p),
  discardDraft: (id: number) => api.delete<{ success: boolean }>(`${base}/${id}/draft`),

  // One page per request, so a failure never costs the pages already sent
  addPage: (id: number, p: { clientRef: string; photo: Blob; replacePageId?: number }) => {
    const form = new FormData()
    form.append('client_ref', p.clientRef)
    if (p.replacePageId) form.append('replace_page_id', String(p.replacePageId))
    form.append('photo', p.photo, 'page.jpg')
    return apiFetch(`${base}/${id}/draft/pages`, { method: 'POST', body: form }).then((r) => parse<DraftView>(r))
  },
  reorder: (id: number, pageIds: number[]) => api.put<DraftView>(`${base}/${id}/draft/pages/order`, { page_ids: pageIds }),
  rotate: (id: number, pageId: number, degrees: 90 | 180 | 270) => api.patch<DraftView>(`${base}/${id}/draft/pages/${pageId}`, { rotate: degrees }),
  removePage: (id: number, pageId: number) => api.delete<DraftView>(`${base}/${id}/draft/pages/${pageId}`),

  audioInit: (id: number, p: { upload_id: string; total_bytes: number; duration_ms: number | null }) =>
    api.post<{ upload_id: string; received_bytes: number; total_bytes: number; completed: boolean }>(`${base}/${id}/draft/audio/uploads`, p),
  audioChunk: (id: number, uploadId: string, start: number, chunk: Blob, total: number) =>
    apiFetch(`${base}/${id}/draft/audio/uploads/${uploadId}`, {
      method: 'PUT',
      body: chunk,
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Range': `bytes ${start}-${start + chunk.size - 1}/${total}` }
    }).then((r) => parse<{ received_bytes: number; total_bytes: number }>(r)),
  audioComplete: (id: number, uploadId: string) => api.post<DraftView>(`${base}/${id}/draft/audio/uploads/${uploadId}/complete`),
  removeAudio: (id: number) => api.delete<DraftView>(`${base}/${id}/draft/audio`),

  previewPdf: (id: number) => api.post<{ pdf_url: string; pdf_bytes: number; page_count: number }>(`${base}/${id}/draft/pdf`),
  publish: (id: number, p: { publish_ref: string; change_summary?: string; notify?: boolean }) => api.post<PublishResult>(`${base}/${id}/draft/publish`, p),

  reply: (commentId: number, body: string) => api.post<{ id: number }>(`${base}/comments/${commentId}/reply`, { body }),
  addressed: (commentId: number, versionNo: number) => api.post<{ success: boolean }>(`${base}/comments/${commentId}/addressed`, { version_no: versionNo }),
  reopen: (commentId: number) => api.post<{ success: boolean }>(`${base}/comments/${commentId}/addressed`, { status: 'open' }),
  hide: (commentId: number, reason: string) => api.post<{ success: boolean }>(`${base}/comments/${commentId}/hide`, { reason }),
  unhide: (commentId: number) => api.post<{ success: boolean }>(`${base}/comments/${commentId}/unhide`),

  withdraw: (id: number, versionNo: number, reason: string) => api.post<{ success: boolean }>(`${base}/${id}/versions/${versionNo}/withdraw`, { reason }),
  restore: (id: number, versionNo: number) => api.post<{ success: boolean }>(`${base}/${id}/versions/${versionNo}/restore`)
}

const CHUNK = 5 * 1024 * 1024

// Upload a recording in 5 MB pieces. A dropped connection resumes from the
// server's offset (OFFSET_MISMATCH carries received_bytes); each piece is
// retried a few times before giving up, and the same uploadId resumes later.
export async function uploadAudio(reportId: number, file: Blob, uploadId: string, durationMs: number | null, onProgress: (sent: number, total: number) => void): Promise<DraftView> {
  const init = await meetingRecordsApi.audioInit(reportId, { upload_id: uploadId, total_bytes: file.size, duration_ms: durationMs })
  let offset = init.received_bytes
  onProgress(offset, file.size)
  let failures = 0
  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + CHUNK, file.size))
    try {
      const r = await meetingRecordsApi.audioChunk(reportId, uploadId, offset, chunk, file.size)
      offset = r.received_bytes
      failures = 0
      onProgress(offset, file.size)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'OFFSET_MISMATCH') {
        offset = (err.body as { received_bytes?: number } | null)?.received_bytes ?? offset
        continue
      }
      failures += 1
      if (failures >= 3) throw err
      await new Promise((resolve) => setTimeout(resolve, 1500 * failures))
    }
  }
  return meetingRecordsApi.audioComplete(reportId, uploadId)
}

// Office scans can be huge; send at most 2400 px JPEG so uploads stay quick.
// The server normalises again; anything the browser cannot decode goes as is.
export async function preparePhoto(file: File): Promise<Blob> {
  if (file.size < 2.5 * 1024 * 1024) return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob ?? file
  } catch {
    return file
  }
}
