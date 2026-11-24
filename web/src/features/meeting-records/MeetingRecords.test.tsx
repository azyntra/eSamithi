import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithApp } from '@/test/render'
import { api, http, HttpResponse, mockApi } from '@/test/msw'
import { MeetingRecordsPage } from './MeetingRecordsPage'
import { ReportDetail } from './components/ReportDetail'
import { formatDuration, threads, type MinutesComment } from './types'

// Meeting Records in the office web (docs/MEETING-MINUTES-REQUIREMENTS.md §8.3)

const CAN_ALL = { publish: true, moderate: true, withdraw: true }

const LIST = {
  years: [2026],
  has_more: false,
  can: CAN_ALL,
  items: [
    { id: 5, title: 'Monthly general meeting', meeting_date: '2026-11-16', version_no: 2, state: 'published', published_at: '2026-11-18T14:12:00Z', updated_at: '2026-11-18T14:12:00Z', page_count: 12, audio_ms: 1900000, has_audio: true, author_name: 'Kamal Perera', withdrawn_at: null, comment_count: 5, open_comment_count: 2 },
    { id: 6, title: 'Special meeting: funeral fund', meeting_date: '2026-11-03', version_no: 1, state: 'published', published_at: '2026-11-05T09:00:00Z', updated_at: '2026-11-05T09:00:00Z', page_count: 4, audio_ms: null, has_audio: false, author_name: 'Office Admin', withdrawn_at: null, comment_count: 0, open_comment_count: 0 }
  ]
}

const page = (n: number) => ({ id: n, n, url: `/api/v1/files/p${n}.x`, thumb_url: `/api/v1/files/t${n}.x`, width: 1500, height: 2000 })

const REPORT = {
  report: { id: 5, category: 'minutes', latest_version_no: 2, has_draft: false },
  version: {
    version_no: 2, state: 'published', published_at: '2026-11-18T14:12:00Z', author_name: 'Kamal Perera', author_position: 'secretary',
    change_summary: 'Corrected the figure on page 3', withdrawn_at: null, withdrawn_reason: null,
    title: 'Monthly general meeting', meeting_date: '2026-11-16', page_count: 3, pages: [page(1), page(2), page(3)],
    pdf_url: '/api/v1/files/pdf.x', pdf_bytes: 6_000_000, audio_url: '/api/v1/files/a.x', audio_ms: 1900000, audio_bytes: 15_000_000, audio_mime: 'audio/mp4'
  },
  versions: [
    { version_no: 2, state: 'published', published_at: '2026-11-18T14:12:00Z', author_name: 'Kamal Perera', author_position: 'secretary', change_summary: 'Corrected the figure on page 3', withdrawn_at: null, withdrawn_reason: null },
    { version_no: 1, state: 'published', published_at: '2026-11-17T15:40:00Z', author_name: 'Kamal Perera', author_position: 'secretary', change_summary: null, withdrawn_at: null, withdrawn_reason: null }
  ],
  can: CAN_ALL
}

const COMMENTS = {
  items: [
    { id: 31, parent_id: null, author_name: 'Nimali Fernando', is_secretary: false, is_office: false, is_mine: false, body: 'At 12:34 the next meeting date is wrong.', version_no: 2, status: 'open', addressed_in_version_no: null, addressed_by_name: null, created_at: '2026-11-20T08:00:00Z', hidden: false, hidden_reason: null, hidden_by_name: null, deleted: false },
    { id: 30, parent_id: null, author_name: 'Sunil Silva', is_secretary: false, is_office: false, is_mine: false, body: 'On page 3 the figure should be 12,500.', version_no: 1, status: 'addressed', addressed_in_version_no: 2, addressed_by_name: 'Kamal Perera', created_at: '2026-11-19T08:00:00Z', hidden: false, hidden_reason: null, hidden_by_name: null, deleted: false },
    { id: 32, parent_id: 30, author_name: 'Kamal Perera', is_secretary: true, is_office: false, is_mine: false, body: 'Thank you, corrected.', version_no: 2, status: 'open', addressed_in_version_no: null, addressed_by_name: null, created_at: '2026-11-19T09:00:00Z', hidden: false, hidden_reason: null, hidden_by_name: null, deleted: false }
  ]
}

const addressed: Array<{ id: string; body: unknown }> = []

mockApi(
  http.post(api('/auth/refresh'), () => HttpResponse.json({ error: 'No session' }, { status: 401 })),
  http.get(api('/meeting-records'), () => HttpResponse.json(LIST)),
  http.get(api('/meeting-records/5'), () => HttpResponse.json(REPORT)),
  http.get(api('/meeting-records/5/comments'), () => HttpResponse.json(COMMENTS)),
  http.post(api('/meeting-records/comments/:cid/addressed'), async ({ params, request }) => {
    addressed.push({ id: String(params.cid), body: await request.json() })
    return HttpResponse.json({ success: true })
  })
)

describe('helpers', () => {
  it('formats recording lengths and groups replies under their comment', () => {
    expect(formatDuration(1900000)).toBe('31:40')
    expect(formatDuration(3_725_000)).toBe('1:02:05')
    expect(formatDuration(null)).toBe('—')
    const grouped = threads(COMMENTS.items as MinutesComment[])
    expect(grouped.map((c) => c.id)).toEqual([31, 30])
    expect(grouped[1].replies.map((r) => r.id)).toEqual([32])
  })
})

describe('the Meeting Minutes list', () => {
  it('lists reports by meeting date with version, recording and open corrections', async () => {
    const onChange = vi.fn()
    renderWithApp(<MeetingRecordsPage view={{}} onChange={onChange} />)
    const row = (await screen.findByText('Monthly general meeting')).closest('tr') as HTMLElement
    expect(within(row).getByText('v2')).toBeInTheDocument()
    expect(within(row).getByText('31:40')).toBeInTheDocument()
    expect(within(row).getByText('2 open of 5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /New meeting minutes/ })).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Monthly general meeting' }))
    expect(onChange).toHaveBeenCalledWith({ report: 5, v: undefined })
  })
})

describe('a report', () => {
  it('shows pages, recording, versions and the comment thread, and marks a correction fixed', async () => {
    addressed.length = 0
    const user = userEvent.setup()
    renderWithApp(<ReportDetail id={5} onBack={() => {}} onVersion={() => {}} onEditDraft={() => {}} />)

    expect(await screen.findByRole('heading', { name: 'Monthly general meeting' })).toBeInTheDocument()
    expect(screen.getAllByText('Page 1 of 3').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Recording')).toHaveAttribute('src', '/api/v1/files/a.x')
    expect(screen.getByRole('link', { name: /Download PDF/ })).toHaveAttribute('href', '/api/v1/files/pdf.x')
    expect(screen.getByText(/Corrected the figure on page 3/, { selector: 'p' })).toBeInTheDocument()

    expect(await screen.findByText('On page 3 the figure should be 12,500.')).toBeInTheDocument()
    expect(screen.getByText('Fixed in v2')).toBeInTheDocument()
    expect(screen.getByText('Thank you, corrected.')).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Mark addressed in…' }), '2')
    await waitFor(() => expect(addressed).toEqual([{ id: '31', body: { version_no: 2 } }]))
  })
})
