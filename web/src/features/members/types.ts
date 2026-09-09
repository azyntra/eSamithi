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
}

export interface MemberWithDependents extends Member {
  dependents: Dependent[]
}

export interface MembersPage {
  members: Member[]
  total: number
}

export interface SlimMember {
  id: number
  society_id?: string | null
  nic?: string | null
  full_name: string
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
  guarantees: Array<{ id: number; date_issued: string; status: string; borrower_name: string }>
}

export const isMemberActive = (m: Pick<Member, 'is_active'>): boolean => m.is_active == null || Number(m.is_active) === 1
export const isAppEnabled = (m: Pick<Member, 'app_enabled'>): boolean => m.app_enabled == null || Number(m.app_enabled) === 1
