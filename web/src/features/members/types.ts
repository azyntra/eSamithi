export interface Dependent {
  id: number
  member_id: number
  name: string | null
  relationship: string | null
  date_of_birth?: string | null
  nic?: string | null
  age?: number | null
}

export interface Member {
  id: number
  society_id: string
  nic: string | null
  full_name: string | null
  date_of_birth: string | null
  gender: string | null
  marital_status: string | null
  occupation: string | null
  address: string | null
  phone: string | null
  date_of_joining: string | null
  father_name: string | null
  mother_name: string | null
  father_in_law_name: string | null
  mother_in_law_name: string | null
  bank_name: string | null
  bank_account_holder_name: string | null
  bank_account_number: string | null
  is_active?: number | null
  created_at: string
  app_enabled?: number | null
  pin_set_at?: string | null
  // Nominated to mark attendance from the mobile app (migration 018)
  app_staff_attendance?: number | null
  app_staff_granted_at?: string | null
}

export interface MemberWithDependents extends Member {
  dependents: Dependent[]
  app_staff_granted_by_name?: string | null
}

// One row of the Attendance page's "Mobile staff" panel
export interface AppStaffMember {
  id: number
  society_id: string
  full_name: string | null
  phone: string | null
  enrolled: boolean
  app_enabled: boolean
  is_active: boolean
  granted_at: string | null
  granted_by_name: string | null
  last_seen_at: string | null
}

// All a printed QR card needs — see features/members/cards.ts
export interface QrCardMember {
  id: number
  society_id: string
  full_name: string | null
}
export type QrCardScope = 'all' | 'not_enrolled' | 'ids'

export interface MembersPage {
  members: Member[]
  total: number
}

// full_name is nullable because it is nullable in production: members
// entered from paper can carry nothing but a society ID (see lib/members.ts).
export interface SlimMember {
  id: number
  society_id?: string | null
  nic?: string | null
  full_name: string | null
}

export interface DependentInput {
  name: string
  relationship: string
  date_of_birth: string
  nic: string
  age: string
}

// Wire format of POST/PUT /members (all strings; the server nulls blanks)
export interface MemberPayload {
  society_id: string
  nic: string
  full_name: string
  date_of_birth: string
  gender: string
  marital_status: string
  occupation: string
  address: string
  phone: string
  date_of_joining: string
  father_name: string
  mother_name: string
  father_in_law_name: string
  mother_in_law_name: string
  bank_name: string
  bank_account_holder_name: string
  bank_account_number: string
  dependents: DependentInput[]
}

export interface MemberStatement {
  income: Array<{ id: number; date: string; amount: number; status: string; payment_method: string; loan_id: number | null; type_name: string; type_code: string | null }>
  expenses: Array<{ id: number; date: string; amount: number; status: string; payment_method: string; type_name: string; type_code: string | null }>
  loans: Array<{ id: number; principal_amount: number; principal_owed: number; interest_owed: number; fines_owed: number; date_issued: string; status: string; is_migrated: number }>
  guarantees: Array<{ id: number; date_issued: string; status: string; borrower_name: string | null }>
}

export const isMemberActive = (m: Pick<Member, 'is_active'>): boolean => m.is_active == null || Number(m.is_active) === 1
export const isAppEnabled = (m: Pick<Member, 'app_enabled'>): boolean => m.app_enabled == null || Number(m.app_enabled) === 1
export const isAttendanceStaff = (m: Pick<Member, 'app_staff_attendance'>): boolean => Number(m.app_staff_attendance ?? 0) === 1
