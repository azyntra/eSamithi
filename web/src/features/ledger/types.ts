export type LedgerKind = 'income' | 'expenses'
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Cheque'
export type TxStatus = 'Active' | 'Void'

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
  payment_method: PaymentMethod
  wallet_id: number
  asset_id: number | null
  loan_id: number | null
  notes: string | null
  status: TxStatus
  void_reason: string | null
  created_at: string
  wallet_name?: string
  income_type_name?: string
  income_type_code?: string | null
  payer_name?: string
  member_nic?: string | null
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
  payment_method: PaymentMethod
  wallet_id: number
  voucher_no: string | null
  notes: string | null
  status: TxStatus
  void_reason: string | null
  created_at: string
  wallet_name?: string
  expense_type_name?: string
  expense_type_code?: string | null
  recipient_name?: string
  member_nic?: string | null
}

export type LedgerTx = IncomeTransaction | ExpenseTransaction

export interface LedgerPageData<T> {
  transactions: T[]
  total: number
  active_total: number
}

export interface IncomePayload {
  date: string
  payer_type: 'Member' | 'Guest'
  member_id: number | null
  guest_name: string | null
  income_type_id: number
  amount: number
  fine_reason: string | null
  payment_method: PaymentMethod
  wallet_id: number
  asset_id: number | null
  notes: string | null
}

export interface ExpensePayload {
  date: string
  recipient_type: 'Member' | 'Vendor'
  member_id: number | null
  vendor_name: string | null
  expense_type_id: number
  amount: number
  payment_method: PaymentMethod
  wallet_id: number
  voucher_no: string | null
  notes: string | null
}

// Adaptive-form vocabularies (ported from the desktop modals). Display strings
// are translated; the canonical English text is what gets stored in `notes`.
export const HIDDEN_INCOME_CODES = ['loan_interest', 'loan_fine']
export const MEMBER_INCOME_CODES = ['membership_fee', 'entrance_fee', 'fine']
export const ONE_TIME_INCOME_CODES = ['membership_fee', 'entrance_fee']
export const BUILDING_SOURCES = ['Building Rental', 'Electricity Bill Reimbursement', 'Water Bill Reimbursement', 'Damage Compensation', 'Other Building-related Charges'] as const
export const ASSET_SOURCES = ['Asset Rental', 'Asset Sale'] as const
export const MEMBER_BENEFIT_CODES = ['funeral_benefit', 'inlaw_funeral_benefit', 'hospital_assistance', 'grade5_scholarship', 'year_end_bonus']
export const BILL_CATEGORIES = ['Electricity Bill', 'Water Bill', 'Telephone Bill', 'Internet Bill', 'Building Maintenance', 'Operational Expenses'] as const
