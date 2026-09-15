// Members entered from paper records can arrive with nothing but a society
// ID. Production has rows whose name, NIC and phone are all NULL — the base
// schema's NOT NULLs were relaxed long ago — and MySQL sorts NULL first, so
// the very first rows any picker shows are the nameless ones. Every place
// that shows, searches or sorts a member goes through here: a missing name
// is a label, never an exception.
export interface MemberLike {
  id: number
  society_id?: string | null
  nic?: string | null
  full_name?: string | null
}

/** Case-folded text for matching; null and undefined fold to ''. */
export const fold = (v: unknown): string =>
  String(v ?? '')
    .trim()
    .toLowerCase()

/** "ID · NIC" — what tells two namesakes apart, and how a card scan finds a person. */
export function memberSublabel(m: MemberLike): string {
  return [m.society_id, m.nic].filter(Boolean).join(' · ')
}

/** The name to print, or the caller's word for a record that has none. */
export function memberLabel(m: Pick<MemberLike, 'full_name'>, unnamed: string): string {
  return (m.full_name ?? '').trim() || unnamed
}

/** Name, member ID or NIC — substring, case-insensitive, like the desktop's SearchableSelect. */
export function matchesMember(m: MemberLike, query: string): boolean {
  const q = fold(query)
  if (!q) return true
  return fold(m.full_name).includes(q) || fold(memberSublabel(m)).includes(q)
}

/** Sort key: named members alphabetically, nameless ones after them by ID. */
export function compareMembers(a: MemberLike, b: MemberLike): number {
  const an = (a.full_name ?? '').trim()
  const bn = (b.full_name ?? '').trim()
  if (an && bn) return an.localeCompare(bn)
  if (an !== bn) return an ? -1 : 1
  return String(a.society_id ?? '').localeCompare(String(b.society_id ?? ''), undefined, { numeric: true })
}
