// Meeting Records (docs/MEETING-MINUTES-REQUIREMENTS.md §7). File URLs are
// signed, same-origin paths (/api/v1/files/…) valid for 30 minutes.

export interface Can {
  publish: boolean
  moderate: boolean
  withdraw: boolean
}

export type RecordStatus = 'published' | 'drafts' | 'withdrawn'

export interface RecordRow {
  id: number
  title: string
  meeting_date: string
  version_no: number | null
  state: 'draft' | 'published' | 'withdrawn'
  published_at: string | null
  updated_at: string
  page_count: number
  audio_ms: number | null
  has_audio: boolean
  author_name: string | null
  withdrawn_at: string | null
  comment_count: number
  open_comment_count: number
}

export interface BrowseResult {
  years: number[]
  items: RecordRow[]
  has_more: boolean
  can: Can
}

export interface PageImage {
  id: number
  n: number
  url: string
  thumb_url: string
  width: number
  height: number
}

export interface VersionSummary {
  version_no: number | null
  state: 'draft' | 'published' | 'withdrawn'
  published_at: string | null
  author_name: string | null
  author_position: 'secretary' | 'office' | null
  change_summary: string | null
  withdrawn_at: string | null
  withdrawn_reason: string | null
}

export interface VersionView extends VersionSummary {
  title: string
  meeting_date: string
  page_count: number
  pages: PageImage[]
  pdf_url: string | null
  pdf_bytes: number | null
  audio_url: string | null
  audio_ms: number | null
  audio_bytes: number | null
  audio_mime: string | null
}

export interface ReportResult {
  report: { id: number; category: 'minutes'; latest_version_no: number | null; has_draft: boolean }
  version: VersionView
  versions: VersionSummary[]
  can: Can
}

export interface DraftPage extends PageImage {
  rotation: number
  client_ref: string
}

export interface DraftView extends Omit<VersionView, 'pages'> {
  report_id: number
  is_revision: boolean
  next_version_no: number
  updated_at: string
  pages: DraftPage[]
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
  addressed_by_name: string | null
  created_at: string
  hidden: boolean
  hidden_reason: string | null
  hidden_by_name: string | null
  deleted: boolean
}

export interface PublishResult {
  already: boolean
  report_id: number
  version_no: number
  published_at: string
  notified: boolean
}

// mm:ss or h:mm:ss for a recording length
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—'
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Top-level comments with their replies, oldest first
export function threads(items: MinutesComment[]): Array<MinutesComment & { replies: MinutesComment[] }> {
  const tops = items.filter((c) => c.parent_id === null)
  return tops.map((c) => ({ ...c, replies: items.filter((r) => r.parent_id === c.id) }))
}
