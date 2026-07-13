export interface Dependent {
  id: number
  member_id: number
  name: string
  relationship: string
  date_of_birth?: string | null
  nic?: string | null
  age?: number | null
}

export interface Member {
  id: number
  society_id: string
  nic: string
  full_name: string
  date_of_birth: string
  gender: string
  marital_status: string
  occupation: string | null
  address: string | null
  phone: string
  date_of_joining: string
  father_name: string | null
  mother_name: string | null
  father_in_law_name: string | null
  mother_in_law_name: string | null
  bank_name: string | null
  bank_account_holder_name: string | null
  bank_account_number: string | null
  created_at: string
  // Member mobile app access (migration 005)
  app_enabled?: number | null
  pin_set_at?: string | null
}

export interface MemberWithDependents extends Member {
  dependents: Dependent[]
}

export interface DependentInput {
  name: string
  relationship: string
  date_of_birth: string
  nic: string
  age: string
}

export interface MemberFormData {
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

export interface FormErrors {
  [key: string]: string
}

export interface ToastMessage {
  id: string
  type: 'success' | 'error'
  message: string
}

export interface Wallet {
  id: number
  name: string
  wallet_type: 'Cash' | 'Bank'
  balance: number
  is_active: number
  created_at: string
}

export interface FixedDeposit {
  id: number
  fd_number: string
  bank_name: string
  principal: number
  interest_rate: number
  term_months: number
  start_date: string
  maturity_date: string
  status: 'Active' | 'Matured' | 'Withdrawn'
  notes: string | null
  linked_wallet_id: number | null
}

export interface PhysicalAsset {
  id: number
  name: string
  quantity: number
  description: string | null
  is_active: number
  created_at: string
}

export interface IncomeType {
  id: number
  name: string
  standard_amount: number
  category_group: string
  code: string | null
  is_active: number
}

export interface ExpenseType {
  id: number
  name: string
  standard_payout: number
  code: string | null
  is_active: number
}

export interface IncomeTransaction {
  id: number
  date: string
  payer_type: 'Member' | 'Guest'
  member_id: number | null
  guest_name: string | null
  income_type_id: number
  amount: number
  principal_part: number
  interest_part: number
  months_covered: string | null
  fine_reason: string | null
  payment_method: 'Cash' | 'Bank Transfer' | 'Cheque'
  wallet_id: number
  asset_id: number | null
  loan_id: number | null
  notes: string | null
  status: 'Active' | 'Void'
  void_reason: string | null
  created_at: string
  
  // Joined fields
  wallet_name?: string
  income_type_name?: string
  payer_name?: string
  member_nic?: string
}

export interface ExpenseTransaction {
  id: number
  date: string
  recipient_type: 'Member' | 'Vendor'
  member_id: number | null
  vendor_name: string | null
  expense_type_id: number
  amount: number
  quantity: number
  unit_price: number
  death_reference: string | null
  payment_method: 'Cash' | 'Bank Transfer' | 'Cheque'
  wallet_id: number
  voucher_no: string | null
  notes: string | null
  status: 'Active' | 'Void'
  void_reason: string | null
  created_at: string
  
  // Joined fields
  wallet_name?: string
  expense_type_name?: string
  recipient_name?: string
  member_nic?: string
}

export interface Loan {
  id: number
  member_id: number
  principal_amount: number
  principal_owed: number
  interest_owed: number
  fines_owed: number
  purpose: string | null
  date_issued: string
  status: 'Active' | 'Paid' | 'Defaulted' | 'Overdue'
  is_migrated: number
  last_accrual_date: string | null
  disbursement_wallet_id: number | null
  created_at: string
  
  // Joined fields
  member_name?: string
  member_nic?: string
  disbursement_wallet_name?: string
  guarantor_count?: number
}
