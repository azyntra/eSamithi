import { contextBridge, ipcRenderer } from 'electron'

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

// Electron wraps errors thrown in the main process as
// "Error invoking remote method 'channel': Error: <message>".
// Strip that noise once here so every toast shows a clean message.
function invoke(channel: string, ...args: unknown[]): Promise<any> {
  return ipcRenderer.invoke(channel, ...args).catch((err: Error) => {
    const cleaned = String(err?.message || err).replace(
      /^Error invoking remote method '[^']+': (Error: )?/,
      ''
    )
    throw new Error(cleaned)
  })
}

const api = {
  auth: {
    login: (username: string, password: string) => invoke('auth:login', username, password),
    logout: () => invoke('auth:logout'),
    onSessionExpired: (callback: () => void) => {
      const handler = (): void => callback()
      ipcRenderer.on('auth:session-expired', handler)
      return () => ipcRenderer.removeListener('auth:session-expired', handler)
    }
  },
  network: {
    ping: () => invoke('network:ping'),
    onOffline: (callback: () => void) => {
      const handler = (): void => callback()
      ipcRenderer.on('network:offline', handler)
      return () => ipcRenderer.removeListener('network:offline', handler)
    },
    onOnline: (callback: () => void) => {
      const handler = (): void => callback()
      ipcRenderer.on('network:online', handler)
      return () => ipcRenderer.removeListener('network:online', handler)
    }
  },
  users: {
    getAll: () => invoke('users:getAll'),
    create: (data: { username: string; password: string; full_name: string; role: string }) =>
      invoke('users:create', data),
    delete: (id: number) => invoke('users:delete', id)
  },
  members: {
    getAll: (params: GetAllParams) => invoke('members:getAll', params),
    getAllSlim: () => invoke('members:getAllSlim'),
    getById: (id: number) => invoke('members:getById', id),
    create: (data: MemberFormData) => invoke('members:create', data),
    update: (id: number, data: MemberFormData) => invoke('members:update', id, data),
    delete: (id: number) => invoke('members:delete', id),
    getStatement: (id: number) => invoke('members:getStatement', id),
    setAppAccess: (id: number, data: { app_enabled?: number; reset_pin?: boolean }) =>
      invoke('members:setAppAccess', id, data),
    checkUnique: (field: string, value: string, excludeId?: number) =>
      invoke('members:checkUnique', field, value, excludeId)
  },
  announcements: {
    getAll: () => invoke('announcements:getAll'),
    create: (data: unknown) => invoke('announcements:create', data),
    update: (id: number, data: unknown) => invoke('announcements:update', id, data),
    toggle: (id: number) => invoke('announcements:toggle', id),
    delete: (id: number) => invoke('announcements:delete', id)
  },
  memberRequests: {
    getAll: (status?: string) => invoke('memberRequests:getAll', status),
    review: (id: number, data: { status: string; staff_note?: string }) =>
      invoke('memberRequests:review', id, data)
  },
  events: {
    getAll: () => invoke('events:getAll'),
    create: (data: unknown) => invoke('events:create', data),
    delete: (id: number) => invoke('events:delete', id),
    getAttendance: (id: number) => invoke('events:getAttendance', id),
    mark: (id: number, societyId: string) => invoke('events:mark', id, societyId),
    unmark: (id: number, memberId: number) => invoke('events:unmark', id, memberId)
  },
  puruka: {
    getAll: (params?: { status?: string; category?: number; q?: string; reported?: string }) =>
      invoke('puruka:getAll', params),
    deactivate: (id: number) => invoke('puruka:deactivate', id),
    reactivate: (id: number) => invoke('puruka:reactivate', id),
    getCategories: () => invoke('puruka:getCategories'),
    createCategory: (data: { code: string; label_en: string; label_si: string }) =>
      invoke('puruka:createCategory', data),
    updateCategory: (id: number, data: { label_en?: string; label_si?: string; is_active?: boolean }) =>
      invoke('puruka:updateCategory', id, data)
  },
  wallets: {
    getAll: () => invoke('wallets:getAll'),
    create: (data: any) => invoke('wallets:create', data),
    update: (id: number, data: any) => invoke('wallets:update', id, data),
    toggleActive: (id: number) => invoke('wallets:toggleActive', id),
    transfer: (fromId: number, toId: number, amount: number) => invoke('wallets:transfer', fromId, toId, amount),
    deposit: (id: number, amount: number, note: string) => invoke('wallets:deposit', id, amount, note),
    delete: (id: number) => invoke('wallets:delete', id)
  },
  fixedDeposits: {
    getAll: () => invoke('fixedDeposits:getAll'),
    create: (data: any) => invoke('fixedDeposits:create', data),
    update: (id: number, data: any) => invoke('fixedDeposits:update', id, data),
    withdraw: (id: number) => invoke('fixedDeposits:withdraw', id)
  },
  assets: {
    getAll: () => invoke('assets:getAll'),
    create: (data: any) => invoke('assets:create', data),
    update: (id: number, data: any) => invoke('assets:update', id, data),
    delete: (id: number) => invoke('assets:delete', id)
  },
  settings: {
    getAll: () => invoke('settings:getAll'),
    updateBulk: (updates: Record<string, string>) => invoke('settings:updateBulk', updates)
  },
  incomeTypes: {
    getAll: () => invoke('incomeTypes:getAll'),
    create: (data: any) => invoke('incomeTypes:create', data),
    update: (id: number, data: any) => invoke('incomeTypes:update', id, data),
    delete: (id: number) => invoke('incomeTypes:delete', id)
  },
  expenseTypes: {
    getAll: () => invoke('expenseTypes:getAll'),
    create: (data: any) => invoke('expenseTypes:create', data),
    update: (id: number, data: any) => invoke('expenseTypes:update', id, data),
    delete: (id: number) => invoke('expenseTypes:delete', id)
  },
  income: {
    getAll: (params?: any) => invoke('income:getAll', params),
    create: (data: any) => invoke('income:create', data),
    void: (id: number, reason: string) => invoke('income:void', id, reason),
    delete: (id: number) => invoke('income:delete', id)
  },
  expenses: {
    getAll: (params?: any) => invoke('expenses:getAll', params),
    create: (data: any) => invoke('expenses:create', data),
    void: (id: number, reason: string) => invoke('expenses:void', id, reason),
    delete: (id: number) => invoke('expenses:delete', id)
  },
  loans: {
    getAll: () => invoke('loans:getAll'),
    getById: (id: number) => invoke('loans:getById', id),
    issue: (data: any) => invoke('loans:issue', data),
    repay: (id: number, data: any) => invoke('loans:repay', id, data),
    migrate: (data: any) => invoke('loans:migrate', data),
    getPayments: (id: number) => invoke('loans:getPayments', id),
    delete: (id: number) => invoke('loans:delete', id)
  },
  dashboard: {
    getStats: () => invoke('dashboard:getStats')
  },
  reports: {
    monthly: (year: number, month: number) => invoke('reports:monthly', year, month),
    annual: (year: number) => invoke('reports:annual', year),
    arrears: () => invoke('reports:arrears')
  },
  exporter: {
    csv: (defaultFilename: string, csvContent: string) =>
      invoke('export:csv', defaultFilename, csvContent)
  },
  updater: {
    checkForUpdates: () => invoke('updater:check'),
    downloadUpdate: () => invoke('updater:download'),
    installUpdate: () => invoke('updater:install'),
    onUpdateEvent: (callback: (event: any) => void) => {
      const handler = (_event: any, data: any): void => callback(data)
      ipcRenderer.on('updater:event', handler)
      // Return cleanup function
      return () => ipcRenderer.removeListener('updater:event', handler)
    },
    getVersion: () => invoke('updater:getVersion')
  }
}

contextBridge.exposeInMainWorld('api', api)
