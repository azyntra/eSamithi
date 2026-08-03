// Every member picker in the app is built from these helpers, so a member can
// always be found the same three ways: by name, by NIC, or by the member ID
// printed on their card. SearchableSelect matches on label + sublabel, so
// putting the ID and NIC in the sublabel makes both searchable *and* visible —
// which is what distinguishes two members who share a name.

export interface SlimMember {
  id: number
  society_id?: string | null
  nic?: string | null
  full_name: string
}

export interface MemberOption {
  value: number
  label: string
  sublabel: string
}

export function memberOption(m: SlimMember): MemberOption {
  return {
    value: m.id,
    label: m.full_name,
    sublabel: [m.society_id, m.nic].filter(Boolean).join(' · ')
  }
}

export function memberOptions(list: SlimMember[]): MemberOption[] {
  return list.map(memberOption)
}
