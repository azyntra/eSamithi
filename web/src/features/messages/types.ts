// Everything the member mobile app receives from the office: notices, the
// review queue for member-submitted requests, and moderation of the Puruka
// community exchange.
export type AnnouncementType = 'death' | 'meeting' | 'general'

export interface Announcement {
  id: number
  type: AnnouncementType
  title: string
  body: string | null
  deceased_name: string | null
  deceased_member_id: number | null
  deceased_member_name?: string | null
  funeral_date: string | null
  funeral_location: string | null
  event_date: string | null
  is_active: number
  created_at: string
}

export interface AnnouncementPayload {
  type: AnnouncementType
  title: string
  body: string | null
  deceased_name: string | null
  deceased_member_id: number | null
  funeral_date: string | null
  funeral_location: string | null
  event_date: string | null
}

export type RequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Done'

export interface MemberRequest {
  id: number
  member_id: number
  member_name: string
  member_society_id: string
  member_phone: string | null
  type: 'loan' | 'correction'
  amount: number | null
  purpose: string | null
  message: string | null
  status: RequestStatus
  staff_note: string | null
  created_at: string
  reviewed_at?: string | null
}

export interface PurukaPost {
  id: number
  title: string
  price: number | null
  negotiable: number
  location: string | null
  status: string
  report_count: number
  created_at: string
  expires_at: string
  category_label: string
  category_id: number
  seller_name: string
  seller_society_id: string
  seller_phone: string | null
  report_reasons: string | null
}

export interface PurukaCategory {
  id: number
  code: string
  label_en: string
  label_si: string
  is_active: number
  sort_order: number
}

export interface PurukaFilters {
  status?: string
  category?: number
  q?: string
  reported?: '1'
}

// The server rejects an incomplete notice; catching it here keeps the member
// app from ever showing a death notice without a name or a meeting without
// a date.
export function announcementError(p: AnnouncementPayload): 'title' | 'deceased' | 'eventDate' | null {
  if (!p.title.trim()) return 'title'
  if (p.type === 'death' && !(p.deceased_name ?? '').trim()) return 'deceased'
  if (p.type === 'meeting' && !p.event_date) return 'eventDate'
  return null
}

// Fields only belong to their own notice type; sending the leftovers of a
// type the user switched away from would store contradictory rows.
export function scrubAnnouncement(p: AnnouncementPayload): AnnouncementPayload {
  return {
    type: p.type,
    title: p.title.trim(),
    body: p.body?.trim() ? p.body.trim() : null,
    deceased_name: p.type === 'death' && p.deceased_name?.trim() ? p.deceased_name.trim() : null,
    deceased_member_id: p.type === 'death' ? (p.deceased_member_id ?? null) : null,
    funeral_date: p.type === 'death' && p.funeral_date ? p.funeral_date : null,
    funeral_location: p.type === 'death' && p.funeral_location?.trim() ? p.funeral_location.trim() : null,
    event_date: p.type === 'meeting' && p.event_date ? p.event_date : null
  }
}
