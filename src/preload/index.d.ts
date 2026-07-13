interface DependentInput {
  name: string
  relationship: string
  date_of_birth: string
  nic: string
  age: string
}

interface MemberFormData {
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

interface GetAllParams {
  search?: string
  page: number
  limit: number
}

interface Member {
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
}

interface Dependent {
  id: number
  member_id: number
  name: string
  relationship: string
  date_of_birth?: string | null
  nic?: string | null
  age?: number | null
}

interface MemberWithDependents extends Member {
  dependents: Dependent[]
}

interface AuthUser {
  id: number
  username: string
  full_name: string
  role: string
}

interface SystemUser {
  id: number
  username: string
  full_name: string
  role: string
}

interface CreateUserData {
  username: string
  password: string
  full_name: string
  role: string
}

interface ElectronAPI {
  auth: {
    login: (username: string, password: string) => Promise<{ success: boolean; user: AuthUser }>
    logout: () => Promise<{ success: boolean }>
    onSessionExpired: (callback: () => void) => () => void
  }
  network: {
    ping: () => Promise<boolean>
    onOffline: (callback: () => void) => () => void
    onOnline: (callback: () => void) => () => void
  }
  users: {
    getAll: () => Promise<SystemUser[]>
    create: (data: CreateUserData) => Promise<{ success: boolean; id: number }>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  members: {
    getAll: (params: GetAllParams) => Promise<{ members: Member[]; total: number }>
    getAllSlim: () => Promise<Array<{ id: number; nic: string; full_name: string }>>
    getById: (id: number) => Promise<MemberWithDependents>
    create: (data: MemberFormData) => Promise<{ success: boolean; id: number }>
    update: (id: number, data: MemberFormData) => Promise<{ success: boolean }>
    delete: (id: number) => Promise<{ success: boolean }>
    getStatement: (id: number) => Promise<{
      income: any[]
      expenses: any[]
      loans: any[]
      guarantees: any[]
    }>
    setAppAccess: (id: number, data: { app_enabled?: number; reset_pin?: boolean }) => Promise<{ success: boolean }>
    checkUnique: (field: string, value: string, excludeId?: number) => Promise<boolean>
  }
  announcements: {
    getAll: () => Promise<any[]>
    create: (data: unknown) => Promise<{ success: boolean; id: number }>
    update: (id: number, data: unknown) => Promise<{ success: boolean }>
    toggle: (id: number) => Promise<{ success: boolean }>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  memberRequests: {
    getAll: (status?: string) => Promise<any[]>
    review: (id: number, data: { status: string; staff_note?: string }) => Promise<{ success: boolean }>
  }
  events: {
    getAll: () => Promise<any[]>
    create: (data: unknown) => Promise<{ success: boolean; id: number }>
    delete: (id: number) => Promise<{ success: boolean }>
    getAttendance: (id: number) => Promise<any>
    mark: (id: number, societyId: string) => Promise<{ success: boolean; member: any; already: boolean }>
    unmark: (id: number, memberId: number) => Promise<{ success: boolean }>
  }
  puruka: {
    getAll: (params?: { status?: string; category?: number; q?: string; reported?: string }) => Promise<any[]>
    deactivate: (id: number) => Promise<{ success: boolean }>
    reactivate: (id: number) => Promise<{ success: boolean }>
    getCategories: () => Promise<any[]>
    createCategory: (data: { code: string; label_en: string; label_si: string }) => Promise<{ success: boolean; id: number }>
    updateCategory: (id: number, data: { label_en?: string; label_si?: string; is_active?: boolean }) => Promise<{ success: boolean }>
  }
  wallets: {
    getAll: () => Promise<any[]>
    create: (data: any) => Promise<{ success: boolean; id: number }>
    update: (id: number, data: any) => Promise<{ success: boolean }>
    toggleActive: (id: number) => Promise<{ success: boolean }>
    transfer: (fromId: number, toId: number, amount: number) => Promise<{ success: boolean }>
    deposit: (id: number, amount: number, note: string) => Promise<{ success: boolean }>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  fixedDeposits: {
    getAll: () => Promise<any[]>
    create: (data: any) => Promise<{ success: boolean; id: number }>
    update: (id: number, data: any) => Promise<{ success: boolean }>
    withdraw: (id: number) => Promise<{ success: boolean }>
  }
  assets: {
    getAll: () => Promise<any[]>
    create: (data: any) => Promise<{ success: boolean; id: number }>
    update: (id: number, data: any) => Promise<{ success: boolean }>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  settings: {
    getAll: () => Promise<Record<string, string>>
    updateBulk: (updates: Record<string, string>) => Promise<{ success: boolean }>
  }
  incomeTypes: {
    getAll: () => Promise<any[]>
    create: (data: any) => Promise<{ success: boolean; id: number }>
    update: (id: number, data: any) => Promise<{ success: boolean }>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  expenseTypes: {
    getAll: () => Promise<any[]>
    create: (data: any) => Promise<{ success: boolean; id: number }>
    update: (id: number, data: any) => Promise<{ success: boolean }>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  income: {
    getAll: (params?: any) => Promise<{ transactions: any[]; total: number; active_total: number }>
    create: (data: any) => Promise<{ success: boolean; id: number }>
    void: (id: number, reason: string) => Promise<{ success: boolean }>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  expenses: {
    getAll: (params?: any) => Promise<{ transactions: any[]; total: number; active_total: number }>
    create: (data: any) => Promise<{ success: boolean; id: number }>
    void: (id: number, reason: string) => Promise<{ success: boolean }>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  loans: {
    getAll: () => Promise<any[]>
    getById: (id: number) => Promise<any>
    issue: (data: any) => Promise<{ success: boolean; id: number }>
    repay: (id: number, data: any) => Promise<{ success: boolean; allocation: { fines_paid: number; interest_paid: number; principal_paid: number }; status: string }>
    migrate: (data: any) => Promise<{ success: boolean; id: number }>
    getPayments: (id: number) => Promise<any[]>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  dashboard: {
    getStats: () => Promise<any>
  }
  reports: {
    monthly: (year: number, month: number) => Promise<any>
    annual: (year: number) => Promise<any>
    arrears: () => Promise<any>
  }
  exporter: {
    csv: (defaultFilename: string, csvContent: string) => Promise<{ success: boolean; canceled?: boolean; path?: string }>
  }
  updater: {
    checkForUpdates: () => Promise<{ success: boolean; version?: string; error?: string }>
    downloadUpdate: () => Promise<{ success: boolean; error?: string }>
    installUpdate: () => void
    onUpdateEvent: (callback: (event: UpdateEvent) => void) => () => void
    getVersion: () => Promise<string>
  }
}

interface UpdateEvent {
  type: 'checking' | 'available' | 'not-available' | 'progress' | 'downloaded' | 'error'
  version?: string
  releaseDate?: string
  percent?: number
  bytesPerSecond?: number
  transferred?: number
  total?: number
  message?: string
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
