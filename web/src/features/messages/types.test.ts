import { describe, expect, it } from 'vitest'
import { scrubAnnouncement, type AnnouncementPayload } from './types'

const base: AnnouncementPayload = {
  type: 'general',
  title: ' Notice ',
  body: null,
  deceased_name: 'left over',
  deceased_member_id: 7,
  funeral_date: '2026-11-30',
  funeral_location: null,
  event_date: '2026-12-01',
  show_until: null
}

describe('scrubAnnouncement', () => {
  it('keeps a staff "show until" date whatever the type', () => {
    expect(scrubAnnouncement({ ...base, show_until: '2026-12-24' }).show_until).toBe('2026-12-24')
    expect(scrubAnnouncement({ ...base, type: 'death', deceased_name: 'X', show_until: '2026-12-24' }).show_until).toBe('2026-12-24')
  })

  it('sends a cleared date as null, so the server uses the automatic period', () => {
    expect(scrubAnnouncement({ ...base, show_until: '' }).show_until).toBeNull()
    expect(scrubAnnouncement(base).show_until).toBeNull()
  })

  it('still drops fields that belong to another notice type', () => {
    const s = scrubAnnouncement(base)
    expect(s.title).toBe('Notice')
    expect(s.deceased_name).toBeNull()
    expect(s.funeral_date).toBeNull()
    expect(s.event_date).toBeNull()
  })
})
