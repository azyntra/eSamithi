import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'fs'
import { apiClient } from './api-client'

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
  dependents: any[]
}

interface GetAllParams {
  search?: string
  page: number
  limit: number
}

export function registerIpcHandlers(): void {
  
  // ── Authentication ────────────────────────────────────────────
  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    try {
      const data = await apiClient.post('/auth/login', { username, password })
      if (data.success && data.token) {
        apiClient.setToken(data.token)
      }
      return data
    } catch (err: any) {
      const message = err.response?.data?.error || err.message
      throw new Error(message)
    }
  })

  ipcMain.handle('auth:logout', async () => {
    apiClient.setToken(null)
    return { success: true }
  })

  // Reachability probe for the renderer's offline bar
  ipcMain.handle('network:ping', async () => {
    return apiClient.ping()
  })

  // ── User Management (admin only) ──────────────────────────────
  ipcMain.handle('users:getAll', async () => {
    try {
      return await apiClient.get('/users')
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('users:create', async (_event, data: any) => {
    try {
      return await apiClient.post('/users', data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('users:delete', async (_event, id: number) => {
    try {
      return await apiClient.delete(`/users/${id}`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  // ── Members ───────────────────────────────────────────────────
  ipcMain.handle('members:getAll', async (_event, params: GetAllParams) => {
    try {
      return await apiClient.get('/members', params)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('members:getAllSlim', async () => {
    try {
      return await apiClient.get('/members/slim')
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('members:getById', async (_event, id: number) => {
    try {
      return await apiClient.get(`/members/${id}`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('members:create', async (_event, data: MemberFormData) => {
    try {
      return await apiClient.post('/members', data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('members:update', async (_event, id: number, data: MemberFormData) => {
    try {
      return await apiClient.put(`/members/${id}`, data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('members:delete', async (_event, id: number) => {
    try {
      return await apiClient.delete(`/members/${id}`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('members:getStatement', async (_event, id: number) => {
    try {
      return await apiClient.get(`/members/${id}/statement`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('members:setAppAccess', async (_event, id: number, data: { app_enabled?: number; reset_pin?: boolean }) => {
    try {
      return await apiClient.put(`/members/${id}/app-access`, data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  // ─── Announcements (Message Portal) ───────────────────────────
  ipcMain.handle('announcements:getAll', async () => {
    try {
      return await apiClient.get('/announcements')
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('announcements:create', async (_event, data: any) => {
    try {
      return await apiClient.post('/announcements', data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('announcements:update', async (_event, id: number, data: any) => {
    try {
      return await apiClient.put(`/announcements/${id}`, data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('announcements:toggle', async (_event, id: number) => {
    try {
      return await apiClient.patch(`/announcements/${id}/toggle`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('announcements:delete', async (_event, id: number) => {
    try {
      return await apiClient.delete(`/announcements/${id}`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  // ─── Member requests (review queue) ───────────────────────────
  ipcMain.handle('memberRequests:getAll', async (_event, status?: string) => {
    try {
      return await apiClient.get('/member-requests', status ? { status } : undefined)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('memberRequests:review', async (_event, id: number, data: { status: string; staff_note?: string }) => {
    try {
      return await apiClient.patch(`/member-requests/${id}`, data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  // ─── Attendance register (events + card scans) ────────────────
  ipcMain.handle('events:getAll', async () => {
    try {
      return await apiClient.get('/events')
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('events:create', async (_event, data: any) => {
    try {
      return await apiClient.post('/events', data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('events:delete', async (_event, id: number) => {
    try {
      return await apiClient.delete(`/events/${id}`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('events:getAttendance', async (_event, id: number) => {
    try {
      return await apiClient.get(`/events/${id}/attendance`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('events:mark', async (_event, id: number, societyId: string) => {
    try {
      return await apiClient.post(`/events/${id}/attendance`, { society_id: societyId })
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('events:unmark', async (_event, id: number, memberId: number) => {
    try {
      return await apiClient.delete(`/events/${id}/attendance/${memberId}`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  // ─── Puruka (community exchange) admin ────────────────────────
  ipcMain.handle('puruka:getAll', async (_event, params?: any) => {
    try {
      return await apiClient.get('/puruka-admin', params)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('puruka:deactivate', async (_event, id: number) => {
    try {
      return await apiClient.patch(`/puruka-admin/${id}/deactivate`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('puruka:reactivate', async (_event, id: number) => {
    try {
      return await apiClient.patch(`/puruka-admin/${id}/reactivate`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('puruka:getCategories', async () => {
    try {
      return await apiClient.get('/puruka-admin/categories')
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('puruka:createCategory', async (_event, data: any) => {
    try {
      return await apiClient.post('/puruka-admin/categories', data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('puruka:updateCategory', async (_event, id: number, data: any) => {
    try {
      return await apiClient.patch(`/puruka-admin/categories/${id}`, data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('members:checkUnique', async (_event, field: string, value: string, excludeId?: number) => {
    try {
      return await apiClient.get('/members/check-unique', { field, value, excludeId })
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  // ── Wallets & Assets ──────────────────────────────
  
  ipcMain.handle('wallets:getAll', async () => {
    try {
      return await apiClient.get('/wallets')
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('wallets:create', async (_event, data: any) => {
    try {
      return await apiClient.post('/wallets', data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('wallets:deposit', async (_event, id: number, amount: number, note: string) => {
    try {
      return await apiClient.post(`/wallets/${id}/deposit`, { amount, note })
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('wallets:update', async (_event, id: number, data: any) => {
    try {
      return await apiClient.put(`/wallets/${id}`, data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('wallets:toggleActive', async (_event, id: number) => {
    try {
      return await apiClient.patch(`/wallets/${id}/toggle`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('wallets:transfer', async (_event, fromId: number, toId: number, amount: number) => {
    try {
      return await apiClient.post('/wallets/transfer', { fromId, toId, amount })
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('fixedDeposits:getAll', async () => {
    try {
      return await apiClient.get('/fixed-deposits')
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('fixedDeposits:create', async (_event, data: any) => {
    try {
      return await apiClient.post('/fixed-deposits', data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('fixedDeposits:update', async (_event, id: number, data: any) => {
    try {
      return await apiClient.put(`/fixed-deposits/${id}`, data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('fixedDeposits:withdraw', async (_event, id: number) => {
    try {
      return await apiClient.patch(`/fixed-deposits/${id}/withdraw`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('assets:getAll', async () => {
    try {
      return await apiClient.get('/assets')
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('assets:create', async (_event, data: any) => {
    try {
      return await apiClient.post('/assets', data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('assets:update', async (_event, id: number, data: any) => {
    try {
      return await apiClient.put(`/assets/${id}`, data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('assets:delete', async (_event, id: number) => {
    try {
      return await apiClient.delete(`/assets/${id}`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  // ── Settings ────────────────────────────────────────────

  ipcMain.handle('settings:getAll', async () => {
    try {
      return await apiClient.get('/settings')
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('settings:updateBulk', async (_event, updates: Record<string, string>) => {
    try {
      return await apiClient.put('/settings', updates)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  // ── Income Types ────────────────────────────────
  ipcMain.handle('incomeTypes:getAll', async () => {
    try {
      return await apiClient.get('/income-types')
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('incomeTypes:create', async (_event, data: any) => {
    try {
      return await apiClient.post('/income-types', data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('incomeTypes:update', async (_event, id: number, data: any) => {
    try {
      return await apiClient.put(`/income-types/${id}`, data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('incomeTypes:delete', async (_event, id: number) => {
    try {
      return await apiClient.delete(`/income-types/${id}`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  // ── Expense Types ───────────────────────────────
  ipcMain.handle('expenseTypes:getAll', async () => {
    try {
      return await apiClient.get('/expense-types')
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('expenseTypes:create', async (_event, data: any) => {
    try {
      return await apiClient.post('/expense-types', data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('expenseTypes:update', async (_event, id: number, data: any) => {
    try {
      return await apiClient.put(`/expense-types/${id}`, data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('expenseTypes:delete', async (_event, id: number) => {
    try {
      return await apiClient.delete(`/expense-types/${id}`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  // ── Income Ledger ───────────────────────────────────
  ipcMain.handle('income:getAll', async (_event, params?: any) => {
    try {
      return await apiClient.get('/income', params)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('income:create', async (_event, data: any) => {
    try {
      return await apiClient.post('/income', data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('income:void', async (_event, id: number, reason: string) => {
    try {
      return await apiClient.patch(`/income/${id}/void`, { reason })
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('income:delete', async (_event, id: number) => {
    try {
      return await apiClient.delete(`/income/${id}`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  // ── Expense Ledger ──────────────────────────────────
  ipcMain.handle('expenses:getAll', async (_event, params?: any) => {
    try {
      return await apiClient.get('/expenses', params)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('expenses:create', async (_event, data: any) => {
    try {
      return await apiClient.post('/expenses', data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('expenses:void', async (_event, id: number, reason: string) => {
    try {
      return await apiClient.patch(`/expenses/${id}/void`, { reason })
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('expenses:delete', async (_event, id: number) => {
    try {
      return await apiClient.delete(`/expenses/${id}`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  // ── Loan Engine ─────────────────────────────────────
  ipcMain.handle('loans:getAll', async () => {
    try {
      return await apiClient.get('/loans')
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('loans:delete', async (_event, id: number) => {
    try {
      return await apiClient.delete(`/loans/${id}`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('loans:issue', async (_event, data: any) => {
    try {
      return await apiClient.post('/loans', data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('loans:repay', async (_event, id: number, data: any) => {
    try {
      return await apiClient.post(`/loans/${id}/repay`, data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('loans:migrate', async (_event, data: any) => {
    try {
      return await apiClient.post('/loans/migrate', data)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('loans:getPayments', async (_event, id: number) => {
    try {
      return await apiClient.get(`/loans/${id}/payments`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('loans:getById', async (_event, id: number) => {
    try {
      return await apiClient.get(`/loans/${id}`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  // ── CSV Export ─────────────────────────────────────────────────
  ipcMain.handle('export:csv', async (event, defaultFilename: string, csvContent: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showSaveDialog(win!, {
      title: 'Export CSV',
      defaultPath: defaultFilename,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })
    if (result.canceled || !result.filePath) return { success: false, canceled: true }
    // BOM so Excel opens UTF-8 (Sinhala names etc.) correctly
    fs.writeFileSync(result.filePath, '﻿' + csvContent, 'utf-8')
    return { success: true, path: result.filePath }
  })

  // ── Wallet Delete ──────────────────────────────────────────────
  ipcMain.handle('wallets:delete', async (_event, id: number) => {
    try {
      return await apiClient.delete(`/wallets/${id}`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  // ── Dashboard Analytics ────────────────────────────────────────
  ipcMain.handle('dashboard:getStats', async () => {
    try {
      return await apiClient.get('/dashboard/stats')
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  // ── Reports ───────────────────────────────────────────────────
  ipcMain.handle('reports:monthly', async (_e, year: number, month: number) => {
    try {
      return await apiClient.get('/reports/monthly', { year, month })
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('reports:annual', async (_e, year: number) => {
    try {
      return await apiClient.get('/reports/annual', { year })
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })

  ipcMain.handle('reports:arrears', async () => {
    try {
      return await apiClient.get('/reports/arrears')
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message)
    }
  })
}
